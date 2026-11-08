// Aristos Sync — MV3 service worker.
// Fetches deadlines/grades from Canvas under the user's live session
// (host_permissions bypass CORS; CSRF comes from the _csrf_token cookie)
// and pushes the payload into an open Aristos tab via postMessage.

import { platonusCardParser, platonusCardClick, platonusCardProbe, platonusCardExtract } from './platonus-inpage.js'

const CANVAS_ORIGIN = 'https://canvas.yu.edu.kz'

const ports = new Set()

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'aristos-popup') return
  ports.add(port)
  port.onMessage.addListener((msg) => {
    if (!msg) return
    if (msg.type === 'sync') runSync(port).catch(() => {})
    if (msg.type === 'platonus-discover') runPlatonusDiscover(port).catch(() => {})
    if (msg.type === 'platonus-sync') runPlatonusSync(port, msg.periods || []).catch(() => {})
  })
  port.onDisconnect.addListener(() => ports.delete(port))
})

function post(port, message) {
  try {
    port.postMessage(message)
  } catch (err) {
    // Popup closed mid-sync — the flow continues, results go to storage.
  }
}

// Live sync state, mirrored to storage.session so a reopened popup can show it.
let activeSync = null
async function mirrorSyncState(extra = {}) {
  activeSync = { ...(activeSync || { kind: null }), updatedAt: Date.now(), ...extra }
  try { await chrome.storage.session.set({ syncState: activeSync }) } catch (err) { /* session unavailable */ }
}

async function finishSyncState(summary) {
  activeSync = { active: false, ...summary }
  try { await chrome.storage.session.set({ syncState: activeSync }) } catch (err) { /* session unavailable */ }
}

async function csrfToken() {
  const cookie = await chrome.cookies.get({ url: CANVAS_ORIGIN + '/', name: '_csrf_token' })
  return cookie ? decodeURIComponent(cookie.value) : null
}

async function apiPage(path) {
  const token = await csrfToken()
  const res = await fetch(CANVAS_ORIGIN + path, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(token ? { 'X-CSRF-Token': token } : {}),
    },
  })
  if (res.status === 401) throw new Error('Сессия Canvas истекла — перезайдите в canvas.yu.edu.kz')
  if (res.status === 403) throw new Error('Canvas запретил доступ к ' + path.split('?')[0])
  if (!res.ok) throw new Error('Canvas API ' + res.status + ' для ' + path.split('?')[0])
  return { data: await res.json(), next: parseNextLink(res.headers.get('Link')) }
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  return match ? match[1] : null
}

async function apiAll(path, onStage) {
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

/**
 * Overall course grades live on the enrollments endpoint. Some Canvas instances
 * don't return them via courses?include[]=total_scores, so fetch them separately.
 */
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

async function collectPayload(onStage) {
  onStage('stageCourses', [], 'Курсы...')
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
    onStage('stageAssignments', [i + 1, rawCourses.length], 'Задания ' + (i + 1) + '/' + rawCourses.length + '...')
    let rawAssignments
    try {
      rawAssignments = await apiAll(
        '/api/v1/courses/' + course.id + '/assignments?include[]=submission&order_by=due_at&per_page=100'
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
        points_possible: a.points_possible || 0,
        html_url: a.html_url || CANVAS_ORIGIN + '/courses/' + a.course_id + '/assignments/' + a.id,
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
    source: 'extension',
    courses,
    assignments,
  }
}

/** Runs INSIDE the Aristos page (MAIN world): posts the payload and awaits the app's ack. */
function pageInject(payload, origin, msgType) {
  return new Promise((resolve) => {
    function onMessage(event) {
      if (event.origin !== origin) return
      if (event.data && event.data.type === 'aristos-canvas-sync-result') {
        window.removeEventListener('message', onMessage)
        clearInterval(retry)
        resolve(event.data)
      }
    }
    window.addEventListener('message', onMessage)
    const started = Date.now()
    const retry = setInterval(() => {
      window.postMessage({ type: msgType, payload }, origin)
      if (Date.now() - started > 30000) {
        clearInterval(retry)
        window.removeEventListener('message', onMessage)
        resolve({ ok: false, error: 'Приложение не ответило за 30 с — открывается ли Aristos?' })
      }
    }, 1500)
    window.postMessage({ type: msgType, payload }, origin)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** executeScript может зависнуть навсегда (вкладка навигируется/заморожена) —
 *  без гонки на таймаут проверочный цикл pushToAristos висел бесконечно. */
function withTimeout(promise, ms, message) {
  let timer = null
  const timeout = sleep(ms).then(() => {
    throw new Error(message)
  })
  return Promise.race([
    promise.then((v) => { clearTimeout(timer); return v }),
    timeout.finally(() => clearTimeout(timer)),
  ]).finally(() => clearTimeout(timer))
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  const started = Date.now()
  let lastStatus = 'unknown'
  let lastUrl = ''
  for (;;) {
    let tabInfo
    try {
      tabInfo = await chrome.tabs.get(tabId)
    } catch (err) {
      throw new Error('Вкладка не найдена (id=' + tabId + '): ' + (err && err.message))
    }
    lastStatus = tabInfo.status
    lastUrl = tabInfo.url || lastUrl
    if (tabInfo.status === 'complete') {
      await sleep(1000) // let React mount and the sync listener attach
      return
    }
    if (Date.now() - started > timeoutMs) {
      // One retry: a stuck/discarded tab usually loads after an explicit reload
      console.warn('[Aristos][platonus] tab stuck, reloading', tabId, lastStatus, lastUrl)
      try { await chrome.tabs.reload(tabId) } catch (err) { /* ignore */ }
      const retryStart = Date.now()
      for (;;) {
        const t2 = await chrome.tabs.get(tabId)
        lastStatus = t2.status
        lastUrl = t2.url || lastUrl
        if (t2.status === 'complete') { await sleep(1000); return }
        if (Date.now() - retryStart > 15000) break
        await sleep(400)
      }
      throw new Error('Вкладка Aristos не загрузилась (status=' + lastStatus + ', url=' + lastUrl + ') — открой её вручную и повтори')
    }
    await sleep(400)
  }
}

async function pushToAristos(payload) {
  const { aristosUrl } = await chrome.storage.local.get('aristosUrl')
  if (!aristosUrl) throw new Error('Сначала укажите адрес Aristos в настройках расширения')
  const origin = new URL(aristosUrl).origin
  console.info('[Aristos][platonus] push target', origin)

  const granted = await chrome.permissions.contains({ origins: [origin + '/*'] })
  if (!granted) throw new Error('Нет доступа к ' + origin + ' — сохраните адрес в попапе ещё раз')

  const existingTabs = await chrome.tabs.query({ url: origin + '/*' })
  console.info('[Aristos][platonus] matching tabs', existingTabs.map((t) => ({ id: t.id, status: t.status, url: t.url })))
  let tab
  if (existingTabs.length > 0) {
    tab = await chrome.tabs.update(existingTabs[0].id, { active: true })
    await waitForTabComplete(tab.id)
  } else {
    tab = await chrome.tabs.create({ url: aristosUrl, active: true })
    await waitForTabComplete(tab.id)
  }

  // Reliable path: hand the payload over via localStorage — the dashboard picks it
  // up within a few seconds regardless of postMessage timing.
  // ВАЖНО: ключ зависит от формата — сайт слушает aristosCanvasSync только под
  // Canvas-формат и aristosPlatonusSync под Платонус. Раньше Платонус писался
  // в канвас-ключ, сайт его молча отбрасывал — «синк прошёл, а данных нет».
  const storageKey = payload.format === 'aristos-platonus-sync' ? 'aristosPlatonusSync' : 'aristosCanvasSync'
  const msgType = payload.format === 'aristos-platonus-sync' ? 'aristos-platonus-sync' : 'aristos-canvas-sync'
  await withTimeout(
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (key, payloadStr) => { localStorage.setItem(key, payloadStr) },
      args: [storageKey, JSON.stringify(payload)],
    }),
    10000,
    'Не удалось записать данные во вкладку Aristos — обнови её (F5) и повтори синк',
  )

  // Fast path: postMessage straight into the page and wait for its ack.
  let ackResult = null
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: pageInject,
    args: [payload, origin, msgType],
  }).then((results) => {
    ackResult = (results && results[0] && results[0].result) || null
  }).catch(() => {})

  // Success = ack from postMessage ИЛИ квитанция сайта: после успешного
  // применения дашборд пишет aristosSyncReceipt {format, syncedAt}. Удаление
  // ключа успехом НЕ считается — сайт удаляет ключ ДО валидации, и старый
  // детект рапортовал успех даже когда сайт данные отбрасывал.
  const started = Date.now()
  let failures = 0
  for (;;) {
    if (Date.now() - started > 60000) {
      throw new Error('Приложение не подтвердило приём за 60 с — обнови вкладку дашборда (F5) и повтори синк')
    }
    await sleep(2000)
    if (ackResult) {
      if (ackResult.ok) return
      throw new Error(ackResult.error || 'Aristos отклонил данные')
    }
    try {
      const check = await withTimeout(
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (key, fmt, syncedAt) => {
            const remaining = localStorage.getItem(key)
            const receiptRaw = localStorage.getItem('aristosSyncReceipt')
            let receipt = null
            try { receipt = receiptRaw ? JSON.parse(receiptRaw) : null } catch { receipt = null }
            return { remaining, matched: Boolean(receipt && receipt.format === fmt && receipt.syncedAt === syncedAt) }
          },
          args: [storageKey, payload.format, payload.syncedAt],
        }),
        8000,
        'check timeout',
      )
      const result = check && check[0] && check[0].result
      if (result && result.matched) return
      const remaining = result ? result.remaining : 'unknown'
      if (remaining === null || remaining === undefined) {
        // Ключ исчез без квитанции: сайт мог упасть на валидации — ждём до лимита,
        // вдруг квитанция придёт позже; иначе упадём с понятной ошибкой.
      }
      failures = 0
    } catch (err) {
      failures += 1
      if (failures >= 3) {
        throw new Error('Вкладка Aristos не отвечает — обнови её (F5) и повтори синк')
      }
    }
  }
}

async function runSync(port) {
  if (activeSync && activeSync.active && Date.now() - (activeSync.updatedAt || 0) < 120000) {
    post(port, { type: 'error', message: 'Синк уже идёт (' + activeSync.stage + ') — дождись завершения' })
    return
  }
  try {
    await mirrorSyncState({ active: true, kind: 'canvas', stage: 'Подключение...', stageKey: 'stageConnecting', params: [] })
    const payload = await collectPayload(async (stageKey, params, ru) => {
      post(port, { type: 'progress', stage: ru, stageKey, params })
      await mirrorSyncState({ active: true, kind: 'canvas', stage: ru, stageKey, params })
    })
    post(port, { type: 'progress', stage: 'Отправка в Aristos...', stageKey: 'stagePushing', params: [] })
    await mirrorSyncState({ active: true, kind: 'canvas', stage: 'Отправка в Aristos...', stageKey: 'stagePushing', params: [] })
    try {
      await pushToAristos(payload)
      await chrome.storage.local.set({
        lastSync: payload.syncedAt,
        lastCounts: { courses: payload.courses.length, assignments: payload.assignments.length },
      })
      await finishSyncState({ kind: 'canvas', lastResult: `Canvas: ${payload.courses.length} курс, ${payload.assignments.length} тапсырма` })
      post(port, {
        type: 'done',
        kind: 'canvas',
        courses: payload.courses.length,
        assignments: payload.assignments.length,
      })
    } catch (pushErr) {
      console.warn('[Aristos] push failed, offering file export', pushErr)
      await finishSyncState({ kind: 'canvas', lastError: String((pushErr && pushErr.message) || pushErr) })
      post(port, { type: 'export', message: String((pushErr && pushErr.message) || pushErr), payload })
    }
  } catch (err) {
    await finishSyncState({ kind: 'canvas', lastError: String((err && err.message) || err) })
    post(port, { type: 'error', message: String((err && err.message) || err) })
  }
}

// ---- Platonus journal ----
// The student journal is a server-rendered TEMPLATE whose data is filled by an XHR
// after page boot (a background fetch returns the bare template — verified via
// diagnostics: identical body, zero "Ср.тек"). So we open a hidden Platonus tab,
// let the page load its own data, then harvest the rendered DOM.
// Карточки читаются структурно (title-атрибут, data-percent, пары value/label) —
// см. platonus-inpage.js. Оценки по дням журнал кладёт в #marksModal ТОЛЬКО по
// клику на карточку (getMarks XHR): кликаем карточку и поллингом из воркера
// ждём свежий контент — все таймауты на стороне воркера, потому что таймеры
// скрытой вкладки Chrome троттлит до минуты после 5 минут в фоне.

const PLATONUS_ORIGIN = 'https://platonus.yu.edu.kz'

/** Оценки по дням одной карточки: клик → поллинг модалки → съём таблиц. */
async function platonusCardMarks(tabId, subjectID, year, captureModalHtml) {
  const exec = (func, args) =>
    withTimeout(
      chrome.scripting.executeScript({ target: { tabId }, func, args }),
      8000,
      'executeScript timeout',
    )

  let clicked
  try {
    const clickResults = await exec(platonusCardClick, [subjectID])
    clicked = clickResults && clickResults[0] && clickResults[0].result
  } catch (err) {
    console.warn('[Aristos][platonus] click failed', err && err.message)
    return null
  }
  if (!clicked || !clicked.ok) return null

  // ждём СВЕЖИЙ контент модалки (защита от таблиц предыдущей карточки),
  // устоявшийся два опроса подряд — ng-repeat может доезжать с анимацией
  let lastReady = null
  let probe = null
  for (let attempt = 0; attempt < 24; attempt++) {
    await sleep(500)
    try {
      const probeResults = await exec(platonusCardProbe, [clicked.prevTitle, clicked.prevText])
      probe = probeResults && probeResults[0] && probeResults[0].result
    } catch (err) {
      console.warn('[Aristos][platonus] probe failed', err && err.message)
      continue
    }
    if (!probe) continue
    if (probe.state === 'empty') return []
    if (probe.state === 'ready' && lastReady && lastReady.text === probe.text) break
    if (probe.state === 'ready') lastReady = probe
  }
  if (!probe || probe.state !== 'ready') return []

  try {
    const extractResults = await exec(platonusCardExtract, [year, Boolean(captureModalHtml)])
    let extracted = extractResults && extractResults[0] && extractResults[0].result

    // контент мог доехать после первого съёма (залипшая анимация ng-repeat) —
    // если модалка изменилась, снимаем ещё раз
    const verifyResults = await exec(platonusCardProbe, [clicked.prevTitle, clicked.prevText])
    const verify = verifyResults && verifyResults[0] && verifyResults[0].result
    if (verify && verify.state === 'ready' && verify.text !== probe.text) {
      const reResults = await exec(platonusCardExtract, [year, false])
      extracted = reResults && reResults[0] && reResults[0].result
    }
    return extracted || []
  } catch (err) {
    console.warn('[Aristos][platonus] extract failed', err && err.message)
    return []
  }
}

async function openPlatonusTab() {
  const tab = await chrome.tabs.create({ url: PLATONUS_ORIGIN + '/student_register', active: false })
  await waitForTabComplete(tab.id)
  return tab
}

/** Navigate a Platonus tab to a period and wait until the journal data is rendered.
 *  opts.onCardStage(i, n, name) — прогресс сбора оценок по дням;
 *  opts.withMarks — собирать ли оценки по дням (discover их не ждёт);
 *  opts.captureModalHtml — вернуть outerHTML #marksModal первой карточки (калибровка). */
async function platonusHarvest(tabId, year, term, studentID, opts = {}) {
  const { onCardStage = null, withMarks = true, captureModalHtml = false } = opts
  const url = new URL(PLATONUS_ORIGIN + '/student_register')
  if (studentID) url.searchParams.set('studentID', String(studentID))
  url.searchParams.set('year', String(year))
  url.searchParams.set('term', String(term))
  await chrome.tabs.update(tabId, { url: url.toString() })
  await waitForTabComplete(tabId)

  // Wait for the page's own XHR to render the journal cards
  for (let attempt = 0; attempt < 25; attempt++) {
    const probe = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => (document.body ? document.body.textContent.includes('Ср.тек') : false),
    })
    if (probe && probe[0] && probe[0].result) break
    await sleep(700)
  }

  const parseResults = await chrome.scripting.executeScript({
    target: { tabId },
    func: platonusCardParser,
  })
  const parsed = parseResults && parseResults[0] && parseResults[0].result
  if (!parsed) throw new Error('Парсер не смог прочитать вкладку Платонуса')

  let firstModalHtml = null
  let needModalCapture = captureModalHtml
  const subjects = parsed.subjects || []
  if (withMarks) {
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i]
      if (onCardStage) await onCardStage(i + 1, subjects.length, subject.name)
      if (subject.subjectID === null || subject.subjectID === undefined) {
        subject.marks = []
        continue
      }
      const captureHere = needModalCapture
      const res = await platonusCardMarks(tabId, subject.subjectID, year, captureHere)
      if (captureHere && res && !Array.isArray(res)) {
        subject.marks = Array.isArray(res.marks) ? res.marks : []
        // для калибровки нужна модалка с РЕАЛЬНЫМИ таблицами: Платонус на старые
        // периоды сам отвечает «Нет текущих оценок» — пустую заменяем следующей
        if ((res.marks && res.marks.length > 0) || i === subjects.length - 1) needModalCapture = false
        firstModalHtml = res.modalHtml || firstModalHtml
      } else {
        subject.marks = Array.isArray(res) ? res : []
      }
    }
  } else {
    for (const subject of subjects) subject.marks = []
  }

  return { parsed, firstModalHtml }
}

async function runPlatonusDiscover(port) {
  if (activeSync && activeSync.active && Date.now() - (activeSync.updatedAt || 0) < 120000) {
    post(port, { type: 'error', message: 'Синк уже идёт (' + activeSync.stage + ') — дождись завершения' })
    return
  }
  let tab = null
  try {
    await mirrorSyncState({ active: true, kind: 'platonus', stage: 'Открываю журнал...', stageKey: 'stagePlatonusOpening', params: [] })
    post(port, { type: 'progress', stage: 'Платонус: открываю журнал...', stageKey: 'stagePlatonusOpening', params: [] })
    tab = await openPlatonusTab()
    const { parsed: base } = await platonusHarvest(tab.id, null, null, null, { withMarks: false })
    if (!base.studentID) {
      throw new Error('Не удалось определить studentID — откройте «Журнал оценок» в Платонусе один раз и повторите')
    }
    await chrome.storage.local.set({ platonusStudentID: base.studentID })
    const periods = []
    for (const year of base.years && base.years.length ? base.years : []) {
      for (const term of base.terms && base.terms.length ? base.terms : [1, 2]) {
        if (term > 0) periods.push({ year, term }) // extra terms (-1/-2) — по запросу позже
      }
    }
    await chrome.storage.session.set({ platonusPeriods: periods })
    await finishSyncState({ kind: 'platonus', lastResult: `Найдено периодов: ${periods.length}` })
    post(port, { type: 'platonus-periods', periods, previewCount: (base.subjects || []).length })
  } catch (err) {
    await finishSyncState({ kind: 'platonus', lastError: String((err && err.message) || err) })
    post(port, { type: 'error', message: String((err && err.message) || err) })
  } finally {
    if (tab) { try { await chrome.tabs.remove(tab.id) } catch (err) { /* already closed */ } }
  }
}

async function runPlatonusSync(port, periods) {
  if (activeSync && activeSync.active && Date.now() - (activeSync.updatedAt || 0) < 120000) {
    post(port, { type: 'error', message: 'Синк уже идёт (' + activeSync.stage + ') — дождись завершения' })
    return
  }
  let tab = null
  try {
    await chrome.storage.session.remove('platonusPeriods')
    await mirrorSyncState({ active: true, kind: 'platonus', stage: 'Открываю журнал...', stageKey: 'stagePlatonusOpening', params: [] })
    const { platonusStudentID } = await chrome.storage.local.get('platonusStudentID')
    post(port, { type: 'progress', stage: 'Платонус: открываю журнал...', stageKey: 'stagePlatonusOpening', params: [] })
    tab = await openPlatonusTab()
    const { parsed: baseParsed } = await platonusHarvest(tab.id, null, null, platonusStudentID || null, { withMarks: false })
    const studentID = baseParsed.studentID || platonusStudentID
    if (!studentID) throw new Error('Не удалось определить studentID — сначала «Найти доступные периоды»')

    const records = []
    let firstModalHtml = null
    let debugSaved = false
    for (let i = 0; i < periods.length; i++) {
      const { year, term } = periods[i]
      const stage = `Платонус: ${year}/${term} (${i + 1}/${periods.length})...`
      post(port, { type: 'progress', stage, stageKey: 'stagePlatonusPeriod', params: [year, term, i + 1, periods.length] })
      await mirrorSyncState({ active: true, kind: 'platonus', stage, stageKey: 'stagePlatonusPeriod', params: [year, term, i + 1, periods.length] })
      const { parsed, firstModalHtml: modalHtml } = await platonusHarvest(tab.id, year, term, studentID, {
        captureModalHtml: records.length === 0 && firstModalHtml === null,
        onCardStage: async (cardIdx, cardTotal, cardName) => {
          const markStage = `Платонус: ${year}/${term} — оценки ${cardIdx}/${cardTotal}...`
          post(port, { type: 'progress', stage: markStage, stageKey: 'stagePlatonusMarks', params: [year, term, cardIdx, cardTotal] })
          await mirrorSyncState({ active: true, kind: 'platonus', stage: markStage, stageKey: 'stagePlatonusMarks', params: [year, term, cardIdx, cardTotal] })
        },
      })
      if (modalHtml && firstModalHtml === null) firstModalHtml = modalHtml
      if (parsed.subjects && parsed.subjects.length > 0) {
        records.push({
          id: `${year}-${term}`,
          year,
          term,
          syncedAt: new Date().toISOString(),
          subjects: parsed.subjects,
        })
      }
      if (records.length === 1 && firstModalHtml !== null && !debugSaved) {
        debugSaved = true
        // HTML первого периода (+ модалка оценок) — для калибровки парсера
        try {
          const dump = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.outerHTML.slice(0, 3000000),
          })
          const bodyHtml = (dump && dump[0] && dump[0].result) || ''
          await chrome.storage.local.set({
            platonusDebugHtml: bodyHtml + '\n\n<!-- MARKS MODAL (после клика по первой карточке) -->\n' + firstModalHtml,
          })
        } catch (err) { /* некритично */ }
      }
    }

    if (records.length === 0) throw new Error('Журнал пуст во всех выбранных периодах — проверьте год/семестр')

    const payload = {
      format: 'aristos-platonus-sync',
      version: 1,
      syncedAt: new Date().toISOString(),
      records,
    }
    const pushStage = 'Отправка в Aristos...'
    post(port, { type: 'progress', stage: pushStage, stageKey: 'stagePushing', params: [] })
    await mirrorSyncState({ active: true, kind: 'platonus', stage: pushStage, stageKey: 'stagePushing', params: [] })
    await pushToAristos(payload)
    await chrome.storage.local.set({ platonusLastSync: payload.syncedAt, platonusLastPeriods: records.length })
    await finishSyncState({ kind: 'platonus', lastResult: `Платонус: ${records.length} кезең, ${records.reduce((s, r) => s + r.subjects.length, 0)} пән` })
    post(port, { type: 'done', kind: 'platonus', courses: records.length, assignments: records.reduce((s, r) => s + r.subjects.length, 0) })
  } catch (err) {
    await finishSyncState({ kind: 'platonus', lastError: String((err && err.message) || err) })
    post(port, { type: 'error', message: String((err && err.message) || err) })
  } finally {
    if (tab) { try { await chrome.tabs.remove(tab.id) } catch (err) { /* already closed */ } }
  }
}
