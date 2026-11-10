// Инжект-скрипт для webview на canvas.yu.edu.kz (нативный синк Aristos).
// Порт сборщика из userscript/aristos-sync.user.js (same-origin fetch
// работает: живая сессия, CORS нет) с заменой доставки: результат уходит
// через window.__TAURI__.core.invoke('sync_payload') — IPC разрешён для
// этого домена в capabilities/remote-sync.json.
// Самодостаточный IIFE: инжектится как текст через sync_eval.
(function () {
  'use strict'

  // Breadcrumb для диагностики: native-sync.ts после инжекта проверяет title
  // harvest-окна (sync_diag) — если IPC не дошёл, увидим причину в тайтле.
  try { document.title = 'ARISTOS_INJ' } catch (_) { /* ignore */ }

  function emit(msg) {
    try {
      window.__TAURI__.core.invoke('sync_payload', { json: JSON.stringify(msg) })
    } catch (err) {
      // IPC недоступен — оставляем причину в title (читает sync_diag)
      try {
        document.title = 'ARISTOS_E|' + String((err && err.message) || err).slice(0, 120)
      } catch (_) { /* ignore */ }
      console.warn('[Aristos] IPC недоступен', err)
    }
  }

  function csrfToken() {
    if (window.ENV && window.ENV.csrfToken) return window.ENV.csrfToken
    const match = document.cookie.match(/_csrf_token=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  async function apiPage(path) {
    const token = csrfToken()
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: token ? { 'X-CSRF-Token': token, Accept: 'application/json' } : { Accept: 'application/json' },
    })
    if (res.status === 401) throw new Error('NEED-LOGIN')
    if (!res.ok) throw new Error('Canvas API ' + res.status + ' для ' + path)
    const next = parseNextLink(res.headers.get('Link'))
    return { data: await res.json(), next }
  }

  function parseNextLink(linkHeader) {
    if (!linkHeader) return null
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
    return match ? match[1] : null
  }

  async function apiAll(path) {
    const items = []
    let url = path
    for (let page = 0; page < 50 && url; page++) {
      const { data, next } = await apiPage(url)
      items.push(...data)
      url = next
    }
    return items
  }

  function itemType(assignment) {
    const types = assignment.submission_types || []
    if (assignment.is_quiz_assignment || types.includes('online_quiz')) return 'quiz'
    if (types.includes('discussion_topic')) return 'discussion'
    if (types.includes('none') || types.length === 0) return 'other'
    return 'assignment'
  }

  function extractCode(name, fallback) {
    const match = name.match(/\(([^()]+)\)\s*$/)
    return match ? match[1].trim() : fallback || name.trim()
  }

  // Общие оценки курса живут на enrollments: некоторые инстансы не отдают
  // их через courses?include[]=total_scores.
  async function fetchGradeMap() {
    const map = new Map()
    try {
      const enrollments = await apiAll('/api/v1/users/self/enrollments?include[]=total_scores&per_page=100')
      for (const e of enrollments) {
        if (!e || !e.course_id) continue
        const g = e.grades || {}
        map.set(e.course_id, {
          current_score: typeof g.current_score === 'number' ? g.current_score : null,
          current_grade: typeof g.current_grade === 'string' ? g.current_grade : null,
        })
      }
    } catch (err) {
      console.warn('[Aristos] enrollments fetch failed, course scores will be empty', err)
    }
    return map
  }

  async function collectPayload() {
    emit({ type: 'progress', stage: 'canvas-courses' })
    const rawCourses = await apiAll('/api/v1/courses?enrollment_state=active&include[]=total_scores&per_page=100')
    const gradeMap = await fetchGradeMap()

    const courses = rawCourses.map((c) => {
      const grades = gradeMap.get(c.id) || {}
      const viaInclude = (c.enrollments && c.enrollments[0] && c.enrollments[0].grades) || {}
      return {
        id: c.id,
        name: c.name || '',
        code: extractCode(c.name || '', c.course_code),
        current_score: grades.current_score ?? (typeof viaInclude.current_score === 'number' ? viaInclude.current_score : null),
        current_grade: grades.current_grade ?? (typeof viaInclude.current_grade === 'string' ? viaInclude.current_grade : null),
      }
    })

    const assignments = []
    for (let i = 0; i < rawCourses.length; i++) {
      const course = rawCourses[i]
      emit({ type: 'progress', stage: 'canvas-assignments', idx: i + 1, total: rawCourses.length })
      let rawAssignments
      try {
        rawAssignments = await apiAll(
          '/api/v1/courses/' + course.id + '/assignments?include[]=submission&order_by=due_at&per_page=100'
        )
      } catch (err) {
        if (String(err && err.message) === 'NEED-LOGIN') throw err
        console.warn('[Aristos] assignments fetch failed for course', course.id, err)
        continue
      }
      for (const a of rawAssignments) {
        if (a.published === false) continue
        const s = a.submission || {}
        assignments.push({
          id: a.id,
          course_id: a.course_id,
          title: a.name || 'Без названия',
          type: itemType(a),
          due_at: a.due_at || null,
          points_possible: a.points_possible || 0,
          html_url: a.html_url || 'https://canvas.yu.edu.kz/courses/' + a.course_id + '/assignments/' + a.id,
          submitted_at: s.submitted_at || null,
          score: s.score ?? null,
          graded: Boolean(s.graded_at) || s.workflow_state === 'graded',
          late: Boolean(s.late),
          missing: Boolean(s.missing),
        })
      }
    }

    return {
      format: 'aristos-canvas-sync',
      version: 1,
      syncedAt: new Date().toISOString(),
      source: 'app',
      courses,
      assignments,
    }
  }

  ;(async () => {
    try {
      const payload = await collectPayload()
      emit({ type: 'canvas', json: JSON.stringify(payload) })
    } catch (err) {
      if (String(err && err.message) === 'NEED-LOGIN') {
        emit({ type: 'need-login', kind: 'canvas' })
        return
      }
      emit({ type: 'error', message: String((err && err.message) || err) })
    }
  })()
})()
