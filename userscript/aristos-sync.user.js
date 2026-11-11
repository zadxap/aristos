// ==UserScript==
// @name         Aristos Sync (canvas.yu.edu.kz)
// @namespace    aristos.yu
// @version      1.0.0
// @description  Экспорт дедлайнов и оценок из Canvas в студенческий дашборд Aristos. Кнопка «Aristos Sync» в правом нижнем углу.
// @author       Aristos
// @match        https://canvas.yu.edu.kz/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict'

  const ARISTOS_URL_KEY = 'aristos_sync_url'
  // Change via right-click on the button. Use your deployed URL or http://localhost:5173 for dev.
  let aristosUrl = localStorage.getItem(ARISTOS_URL_KEY) || 'http://localhost:5173'

  const state = { busy: false }

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
    if (res.status === 401) throw new Error('Сессия Canvas истекла — перезайдите в аккаунт')
    if (!res.ok) throw new Error(`Canvas API ${res.status} для ${path}`)
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

  // Overall course grades live on the enrollments endpoint; some Canvas instances
  // don't return them via courses?include[]=total_scores. Запрос «мягкий»
  // (падение не валит синк), поэтому ретраим до 3 раз — и при ошибке, и при
  // 200-пустышке; после этого последний шанс — per-course enrollments.
  async function fetchGradeMap(courseIds = []) {
    const map = new Map()
    const parseScore = (raw) => {
      if (typeof raw === 'number') return raw
      if (raw === null || raw === undefined || raw === '') return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    const delay = (ms) => new Promise((r) => setTimeout(r, ms))
    let lastErr = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await delay(1500 * attempt)
      try {
        const enrollments = await apiAll('/api/v1/users/self/enrollments?include[]=total_scores&per_page=100')
        for (const e of enrollments) {
          if (!e || !e.course_id) continue
          const g = e.grades || {}
          map.set(e.course_id, {
            current_score: parseScore(g.current_score),
            current_grade: typeof g.current_grade === 'string' ? g.current_grade : null,
          })
        }
        if (map.size > 0) return map
        lastErr = new Error('enrollments: 200 без оценок')
        const e0 = enrollments[0]
        console.warn(
          '[Aristos] enrollments response shape:',
          JSON.stringify({
            len: enrollments.length,
            sampleKeys: e0 ? Object.keys(e0) : null,
            gradesKeys: e0 && e0.grades ? Object.keys(e0.grades) : null,
            type: e0 ? e0.type : null,
            state: e0 ? e0.enrollment_state : null,
            currentScore: e0 && e0.grades ? e0.grades.current_score : null,
          }),
        )
      } catch (err) {
        lastErr = err
      }
    }
    // последний шанс: per-course enrollments
    try {
      for (const id of courseIds) {
        const ens = await apiAll('/api/v1/courses/' + id + '/enrollments?include[]=total_scores&per_page=100')
        for (const e of ens) {
          if (!e || e.course_id !== id) continue
          const g = e.grades || {}
          const score = parseScore(g.current_score)
          if (score !== null) {
            map.set(id, {
              current_score: score,
              current_grade: typeof g.current_grade === 'string' ? g.current_grade : null,
            })
            break
          }
        }
      }
      if (map.size > 0) {
        console.warn('[Aristos] self/enrollments failed, rescued from per-course enrollments for', map.size, 'courses')
        return map
      }
    } catch (err) {
      console.warn('[Aristos] per-course enrollments fallback failed too', err)
    }
    console.warn('[Aristos] enrollments failed after retries and per-course fallback, course scores will be empty', lastErr)
    return map
  }

  async function collectPayload() {
    setUi('syncing', 'Курсы...')
    // include[]=enrollments — явно: grades курса живут в c.enrollments[0].grades,
    // не полагаемся на неявное поведение Canvas при include[]=total_scores
    const rawCourses = await apiAll('/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=enrollments&per_page=100')
    const gradeMap = await fetchGradeMap(rawCourses.map((c) => c.id))

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
      setUi('syncing', `Задания ${i + 1}/${rawCourses.length}...`)
      let rawAssignments
      try {
        rawAssignments = await apiAll(
          `/api/v1/courses/${course.id}/assignments?include[]=submission&order_by=due_at&per_page=100`
        )
      } catch (err) {
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
          lock_at: a.lock_at || null, // «Доступно до» — фолбэк-дедлайн без Срока
          points_possible: a.points_possible || 0,
          html_url: a.html_url || `https://canvas.yu.edu.kz/courses/${a.course_id}/assignments/${a.id}`,
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
      source: 'userscript',
      courses,
      assignments,
    }
  }

  function downloadJson(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `canvas-sync-${new Date().toISOString().slice(0, 10)}.json`
    link.style.position = 'fixed'
    link.style.left = '-10000px'
    document.body.appendChild(link)
    link.click()
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      link.remove()
    }, 1000)
  }

  /** Push to an Aristos tab: opens one, retries the postMessage until the app acks. */
  function pushToAristos(payload) {
    return new Promise((resolve, reject) => {
      const targetOrigin = new URL(aristosUrl).origin
      let win
      try {
        win = window.open(aristosUrl, '_blank')
      } catch (err) {
        /* popup blocked */
      }
      if (!win) {
        reject(new Error('Всплывающее окно заблокировано — разрешите попапы для canvas.yu.edu.kz'))
        return
      }

      function onMessage(event) {
        if (event.source !== win) return
        if (!event.data || event.data.type !== 'aristos-canvas-sync-result') return
        window.removeEventListener('message', onMessage)
        clearTimeout(timer)
        if (event.data.ok) resolve()
        else reject(new Error(event.data.error || 'Aristos отклонил данные'))
      }
      window.addEventListener('message', onMessage)

      const started = Date.now()
      const timer = setInterval(() => {
        if (Date.now() - started > 30000) {
          clearInterval(timer)
          window.removeEventListener('message', onMessage)
          reject(new Error('Aristos не ответил за 30 c — вкладка открыта?'))
          return
        }
        try {
          win.postMessage({ type: 'aristos-canvas-sync', payload }, targetOrigin)
        } catch (err) {
          clearInterval(timer)
          window.removeEventListener('message', onMessage)
          reject(err)
        }
      }, 1500)
    })
  }

  async function runSync() {
    if (state.busy) return
    state.busy = true
    try {
      const payload = await collectPayload()
      setUi('syncing', `Отправка: ${payload.assignments.length} тапсырма...`)
      try {
        await pushToAristos(payload)
        setUi('done', `Синктелді: ${payload.courses.length} курс, ${payload.assignments.length} тапсырма`)
      } catch (pushErr) {
        console.warn('[Aristos] push failed, falling back to file export', pushErr)
        downloadJson(payload)
        setUi('error', `Файл жүктелді (push сәтсіз: ${pushErr.message})`)
      }
    } catch (err) {
      console.error('[Aristos] sync failed', err)
      setUi('error', err.message || 'Белгісіз қате')
    } finally {
      state.busy = false
    }
  }

  function setUi(status, text) {
    if (!button || !label) return
    button.dataset.status = status
    label.textContent = text
    icon.style.display = status === 'syncing' ? 'none' : ''
    spinner.style.display = status === 'syncing' ? '' : 'none'
    if (status === 'done' || status === 'error') {
      window.setTimeout(() => {
        if (button && button.dataset.status === status) setUi('idle', 'Aristos Sync')
      }, 6000)
    }
  }

  // ---- UI ----
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;align-items:center;gap:8px;font-family:system-ui,-apple-system,sans-serif;'

  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.status = 'idle'
  button.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:9999px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);transition:transform .15s,background .15s;'
  button.addEventListener('mouseenter', () => { button.style.transform = 'scale(1.04)' })
  button.addEventListener('mouseleave', () => { button.style.transform = 'scale(1)' })
  button.addEventListener('click', runSync)
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    const next = window.prompt('Aristos URL:', aristosUrl)
    if (next) {
      aristosUrl = next.replace(/\/+$/, '')
      localStorage.setItem(ARISTOS_URL_KEY, aristosUrl)
    }
  })

  const icon = document.createElement('span')
  icon.textContent = '⇄'
  icon.style.cssText = 'font-size:15px;line-height:1;'

  const spinner = document.createElement('span')
  spinner.style.cssText = 'display:none;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:aristos-spin .8s linear infinite;'
  const style = document.createElement('style')
  style.textContent = '@keyframes aristos-spin{to{transform:rotate(360deg)}}'

  const label = document.createElement('span')
  label.textContent = 'Aristos Sync'

  button.append(icon, spinner, label)
  container.append(style, button)
  document.body.appendChild(container)
})()
