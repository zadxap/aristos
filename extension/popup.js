const DEFAULT_URL = 'https://aristoss.vercel.app'

// ---- i18n (KK дефолт, RU переключается в шапке попапа) ----
const I18N = {
  kk: {
    urlLabel: 'Aristos дашбордының адресі',
    saveTitle: 'Сақтау және осы адреске рұқсат беру',
    syncBtn: 'Синхрондау',
    platonusLabel: 'Платонус · бағалар журналы',
    platonusDiscover: 'Қолжетімді кезеңдерді табу',
    platonusImport: 'Таңдалғандарды импорттау',
    exportBtn: 'JSON жүктеу (қосалқы жол)',
    debugHtml: 'HTML журналы (жөндеу үшін жүктеу)',
    statusReady: 'Синкке дайын',
    lastSyncLabel: 'Соңғы синк:',
    openDashboard: 'Дашбордты ашық ↗',
    badUrl: 'URL қате',
    noAccess: (origin) => `«${origin}» қолжетімділік берілмеген — синк жұмыс істемейді`,
    urlSaved: (raw) => `Адрес сақталды: ${raw}`,
    connecting: 'Жалғануда...',
    bgHint: '(жабуға болады — синк фонде жалғасады)',
    bgRunningSuffix: ' (фонде)',
    syncDoneCanvas: (c, a) => `Синктелді: ${c} курс, ${a} тапсырма`,
    periodsFound: (n) => `Табылды: ${n} кезең. Қажеттілерін белгіле және импортта.`,
    pushFailed: (m) => `Пуш сәтсіз (${m}). JSON жүктеп ал, дашбордта импортта.`,
    errorPrefix: 'Қате: ',
    lastErrorPrefix: 'Соңғы қате: ',
    staleSync: 'Синк тоқтап қалды — қайталап көр',
    assumedDone: 'Деректер жөнелтілді — дашбордты жаңарт (F5). Келмесе — синкті қайтала.',
    platonusSearching: 'Платонус: кезеңдерді іздеп жатырмыз...',
    platonusImporting: 'Платонус: импорт...',
    doneRecords: (r, s) => `Дайын: ${r} жазба, ${s} пән`,
    popupClosedHint: 'Попап жабылды — синк фонде жалғасады',
    periodLabel: (year, term) => `${year} · термин ${term}`,
    platonusPrefix: 'Платонус: ',
    stageConnecting: 'Жалғануда...',
    stageCourses: 'Курстар...',
    stageAssignments: (i, n) => `Тапсырмалар ${i}/${n}...`,
    stagePushing: 'Aristos-қа жөнелтілуде...',
    stagePlatonusOpening: 'Платонус: журнал ашылуда...',
    stagePlatonusPeriod: (y, term, i, n) => `Платонус: ${y}/${term} (${i}/${n})...`,
    stagePlatonusMarks: (y, term, i, n) => `Платонус: ${y}/${term} — бағалар ${i}/${n}...`,
    // ошибки воркера (background.js бросает готовые русские строки —
    // попап узнаёт их по шаблонам ERROR_MATCHERS и переводит)
    errBusy: (s) => `Синк әлі жүріп тұр (${s}) — аяқталуын күт`,
    errCanvasSession: 'Canvas сессиясы аяқталды — canvas.yu.edu.kz сайтына қайта кір',
    errCanvasForbidden: (p) => `Canvas «${p}» сұрауына рұқсат бермеді`,
    errCanvasApi: (st, p) => `Canvas API қатесі ${st} (${p})`,
    errNoUrl: 'Алдымен попапта Aristos адресін сақта',
    errNoAccess: (o) => `«${o}» үшін рұқсат жоқ — адресді попапта қайта сақта`,
    errTabMissing: (id, m) => `Aristos қойындысы табылмады (id=${id}): ${m}`,
    errTabStuck: 'Aristos қойындысы жүктелмеді — оны қолмен ашып, синкті қайтала',
    errStorageWrite: 'Aristos қойындысына деректер жазылмады — бетті жаңарт (F5) және синкті қайтала',
    errNoAck30: 'Қосымша 30 с ішінде жауап бермеді — Aristos ашық тұр ма?',
    errNoAck60: 'Қосымша қабылдауды 60 с ішінде растамады — дашбордты жаңарт (F5) және синкті қайтала',
    errTabNotResponding: 'Aristos қойындысы жауап бермейді — бетті жаңарт (F5) және синкті қайтала',
    errNoStudentIdHint: 'studentID табылмады — Платонусқа кіріп, «Бағалар журналын» бір рет аш, сосын қайталап көр',
    errNoStudentIdDiscover: 'studentID табылмады — алдымен «Қолжетімді кезеңдерді табу» батырмасын бас',
    errParserFailed: 'Парсер Платонус қойындысын оқи алмады',
    errJournalEmpty: 'Таңдалған кезеңдердің бірде-бірінде журнал бос — жыл/семестрді тексер',
    errRejected: 'Aristos деректерді қабылдамады',
    warnScoresMissing: 'балдар жүктелмеді — Canvas-синкті қайтала',
  },
  ru: {
    urlLabel: 'Адрес дашборда Aristos',
    saveTitle: 'Сохранить и дать доступ к этому адресу',
    syncBtn: 'Синхронизировать',
    platonusLabel: 'Платонус · журнал оценок',
    platonusDiscover: 'Найти доступные периоды',
    platonusImport: 'Импорт выбранных',
    exportBtn: 'Скачать JSON (запасной путь)',
    debugHtml: 'HTML журнала (скачать для отладки)',
    statusReady: 'Готов к синхронизации',
    lastSyncLabel: 'Последний синк:',
    openDashboard: 'Открыть дашборд ↗',
    badUrl: 'Некорректный URL',
    noAccess: (origin) => `Доступ к ${origin} не выдан — синк не сработает`,
    urlSaved: (raw) => `Адрес сохранён: ${raw}`,
    connecting: 'Подключение...',
    bgHint: '(можно закрыть — синк продолжится)',
    bgRunningSuffix: ' (идёт в фоне)',
    syncDoneCanvas: (c, a) => `Синхронизировано: ${c} курсов, ${a} заданий`,
    periodsFound: (n) => `Найдено периодов: ${n}. Отметь нужные и импортируй.`,
    pushFailed: (m) => `Push не удался (${m}). Скачайте JSON и импортируйте в дашборде.`,
    errorPrefix: 'Ошибка: ',
    lastErrorPrefix: 'Последняя ошибка: ',
    staleSync: 'Синк перестал отвечать — попробуй ещё раз',
    assumedDone: 'Данные отправлены — обнови дашборд (F5). Не пришли — повтори синк.',
    platonusSearching: 'Платонус: ищем периоды...',
    platonusImporting: 'Платонус: импорт...',
    doneRecords: (r, s) => `Готово: ${r} записей, ${s} предметов`,
    popupClosedHint: 'Попап закрыт — синк продолжается в фоне',
    periodLabel: (year, term) => `${year} · термин ${term}`,
    platonusPrefix: 'Платонус: ',
    stageConnecting: 'Подключение...',
    stageCourses: 'Курсы...',
    stageAssignments: (i, n) => `Задания ${i}/${n}...`,
    stagePushing: 'Отправка в Aristos...',
    stagePlatonusOpening: 'Платонус: открываю журнал...',
    stagePlatonusPeriod: (y, term, i, n) => `Платонус: ${y}/${term} (${i}/${n})...`,
    stagePlatonusMarks: (y, term, i, n) => `Платонус: ${y}/${term} — оценки ${i}/${n}...`,
    errBusy: (s) => `Синк уже идёт (${s}) — дождись завершения`,
    errCanvasSession: 'Сессия Canvas истекла — перезайдите в canvas.yu.edu.kz',
    errCanvasForbidden: (p) => `Canvas запретил доступ к ${p}`,
    errCanvasApi: (st, p) => `Canvas API ${st} для ${p}`,
    errNoUrl: 'Сначала укажите адрес Aristos в настройках расширения',
    errNoAccess: (o) => `Доступ к ${o} не выдан — сохраните адрес в попапе ещё раз`,
    errTabMissing: (id, m) => `Вкладка не найдена (id=${id}): ${m}`,
    errTabStuck: 'Вкладка Aristos не загрузилась — открой её вручную и повтори',
    errStorageWrite: 'Не удалось записать данные во вкладку Aristos — обнови её (F5) и повтори синк',
    errNoAck30: 'Приложение не ответило за 30 с — открывается ли Aristos?',
    errNoAck60: 'Приложение не подтвердило приём за 60 с — обнови вкладку дашборда (F5) и повтори синк',
    errTabNotResponding: 'Вкладка Aristos не отвечает — обнови её (F5) и повтори синк',
    errNoStudentIdHint: 'Не удалось определить studentID — откройте «Журнал оценок» в Платонусе один раз и повторите',
    errNoStudentIdDiscover: 'Не удалось определить studentID — сначала «Найти доступные периоды»',
    errParserFailed: 'Парсер не смог прочитать вкладку Платонуса',
    errJournalEmpty: 'Журнал пуст во всех выбранных периодах — проверьте год/семестр',
    errRejected: 'Aristos отклонил данные',
    warnScoresMissing: 'баллы не загрузились — повтори Canvas-синк',
  },
}

let lang = 'kk'
/** Возвращает ЗНАЧЕНИЕ ключа. Ключи-функции (urlSaved, periodLabel, ...)
 *  НЕ вызываются автоматически — вызывай со скобками: t('urlSaved')(raw).
 *  Раньше t() вызывал функцию без аргументов, получал строку, и последующий
 *  вызов падал «t(...) is not a function», убивая обработчики попапа. */
function t(key) {
  return (I18N[lang] || I18N.kk)[key] ?? I18N.kk[key] ?? key
}
function renderStage(source) {
  const key = source.stageKey
  if (key && typeof I18N[lang]?.[key] === 'function') return I18N[lang][key](...(source.params || []))
  if (key && I18N[lang]?.[key] !== undefined) return I18N[lang][key]
  return source.stage
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n) })
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle) })
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.langBtn === lang)
  })
}

// Ошибки воркера — готовые русские строки (Error.message из background.js,
// воркер не знает языка попапа). Знакомые шаблоны переводим на язык попапа,
// незнакомые (напр. сырой сетевой сбой) показываем как есть.
// ВАЖНО: при смене текста ошибки в background.js синхронизировать regex здесь.
const ERROR_MATCHERS = [
  [/^Синк уже идёт \((.+)\) — дождись завершения$/, 'errBusy', (m) => [m[1]]],
  [/^Сессия Canvas истекла/, 'errCanvasSession'],
  [/^Canvas запретил доступ к (.+)$/, 'errCanvasForbidden', (m) => [m[1]]],
  [/^Canvas API (\d+) для (.+)$/, 'errCanvasApi', (m) => [m[1], m[2]]],
  [/^Сначала укажите адрес Aristos/, 'errNoUrl'],
  [/^Нет доступа к (.+) — сохраните адрес в попапе ещё раз$/, 'errNoAccess', (m) => [m[1]]],
  [/^Вкладка не найдена \(id=(\d+)\): (.+)$/, 'errTabMissing', (m) => [m[1], m[2]]],
  [/^Вкладка Aristos не загрузилась/, 'errTabStuck'],
  [/^Не удалось записать данные во вкладку Aristos/, 'errStorageWrite'],
  [/^Приложение не ответило за 30 с/, 'errNoAck30'],
  [/^Приложение не подтвердило приём за 60 с/, 'errNoAck60'],
  [/^Вкладка Aristos не отвечает/, 'errTabNotResponding'],
  [/^Не удалось определить studentID — откройте/, 'errNoStudentIdHint'],
  [/^Не удалось определить studentID — сначала/, 'errNoStudentIdDiscover'],
  [/^Парсер не смог прочитать вкладку Платонуса/, 'errParserFailed'],
  [/^Журнал пуст во всех выбранных периодах/, 'errJournalEmpty'],
  [/^Aristos отклонил данные/, 'errRejected'],
]

function localizeError(raw) {
  const s = String(raw || '')
  for (const [re, key, getArgs] of ERROR_MATCHERS) {
    const m = s.match(re)
    if (!m) continue
    const val = t(key)
    return typeof val === 'function' ? val(...(getArgs ? getArgs(m) : [])) : val
  }
  return s
}

const urlInput = document.getElementById('aristos-url')
const saveBtn = document.getElementById('save-url')
const syncBtn = document.getElementById('sync')
const exportBtn = document.getElementById('export')
const statusBox = document.getElementById('status')
const statusText = document.getElementById('status-text')
const spinner = document.getElementById('spinner')
const lastSync = document.getElementById('last-sync')
const platonusLast = document.getElementById('platonus-last')
const openLink = document.getElementById('open-aristos')
const platonusDiscoverBtn = document.getElementById('platonus-discover')
const platonusPeriodsBox = document.getElementById('platonus-periods')
const platonusImportBtn = document.getElementById('platonus-import')
const debugHtmlBtn = document.getElementById('debug-html')

let lastPayload = null
let busySince = null
let busyWatchdog = null
// Платонус-синк теперь кликает каждую карточку ради оценок по дням — идёт минуты,
// поэтому лимит busy для него отдельный (Canvas остаётся 75 с).
const BUSY_LIMIT_CANVAS = 75000
const BUSY_LIMIT_PLATONUS = 480000
let busyLimitMs = BUSY_LIMIT_CANVAS

/** Жёсткий лимит: попап не висит в «busy» дольше busyLimitMs. Сайт данные применяет
 *  (тост на дашборде), детект в воркере может лагать — завершаем оптимистично. */
function noteBusy(kind) {
  if (kind === 'busy') {
    if (!busySince) {
      busySince = Date.now()
      busyWatchdog = setInterval(() => {
        if (busySince && Date.now() - busySince > busyLimitMs) {
          setStatus(t('assumedDone'), 'ok')
        }
      }, 5000)
    }
  } else {
    busySince = null
    if (busyWatchdog) { clearInterval(busyWatchdog); busyWatchdog = null }
  }
}

init()

async function init() {
  lang = (await chrome.storage.local.get('popupLang')).popupLang || 'kk'
  applyLang()
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      lang = btn.dataset.langBtn
      await chrome.storage.local.set({ popupLang: lang })
      applyLang()
    })
  })

  const local = await chrome.storage.local.get(['aristosUrl', 'lastSync', 'platonusLastSync', 'platonusDebugHtml'])
  const { syncState } = await chrome.storage.session.get('syncState')
  urlInput.value = local.aristosUrl || DEFAULT_URL
  updateLastSync(local.lastSync)
  platonusLast.textContent = local.platonusLastSync ? new Date(local.platonusLastSync).toLocaleString('ru-RU') : '—'
  updateOpenLink(local.aristosUrl || DEFAULT_URL)
  if (local.platonusDebugHtml) debugHtmlBtn.style.display = 'block'

  // A sync may be running in the background from a previous popup session
  const finishedTimestamp = syncState && syncState.active
    ? (syncState.kind === 'platonus' ? local.platonusLastSync : local.lastSync)
    : null
  const alreadyFinished = Boolean(
    syncState && syncState.active && finishedTimestamp &&
    new Date(finishedTimestamp).getTime() > (syncState.updatedAt || 0),
  )
  const stale = syncState && syncState.active && Date.now() - (syncState.updatedAt || 0) > 120000
  if (syncState && syncState.active && !stale && !alreadyFinished) {
    busyLimitMs = syncState.kind === 'platonus' ? BUSY_LIMIT_PLATONUS : BUSY_LIMIT_CANVAS
    setStatus((syncState.kind === 'platonus' ? t('platonusPrefix') : '') + renderStage(syncState) + t('bgRunningSuffix'), 'busy')
    pollSyncState()
  } else if (alreadyFinished) {
    setStatus(t('assumedDone'), 'ok')
  } else if (stale) {
    setStatus(t('staleSync'), 'err')
  } else if (syncState && (syncState.lastResult || syncState.lastError)) {
    if (syncState.lastResult) setStatus(syncState.lastResult, 'ok')
    else setStatus(t('lastErrorPrefix') + localizeError(syncState.lastError), 'err')
  }

  // Восстановить найденные периоды Платонуса — попап закрывается при любом
  // клике мимо, и без этого «Найдено периодов: 6» висело без кнопки импорта.
  const { platonusPeriods } = await chrome.storage.session.get('platonusPeriods')
  if (!syncState?.active && Array.isArray(platonusPeriods) && platonusPeriods.length > 0) {
    renderPeriods(platonusPeriods)
  }
}

// While a background sync runs, keep the reopened popup informed
let statePoll = null
function pollSyncState() {
  if (statePoll) return
  statePoll = setInterval(async () => {
    const { syncState } = await chrome.storage.session.get('syncState')
    if (syncState && syncState.active && Date.now() - (syncState.updatedAt || 0) > 120000) {
      clearInterval(statePoll)
      statePoll = null
      setStatus(t('staleSync'), 'err')
      syncBtn.disabled = false
      saveBtn.disabled = false
      return
    }
    if (!syncState || !syncState.active) {
      clearInterval(statePoll)
      statePoll = null
      if (syncState && syncState.lastResult) setStatus(syncState.lastResult, 'ok')
      else if (syncState && syncState.lastError) setStatus(t('errorPrefix') + localizeError(syncState.lastError), 'err')
      syncBtn.disabled = false
      saveBtn.disabled = false
      return
    }
    setStatus((syncState.kind === 'platonus' ? t('platonusPrefix') : '') + renderStage(syncState) + t('bgRunningSuffix'), 'busy')
  }, 1500)
}

function updateLastSync(iso) {
  lastSync.textContent = iso ? new Date(iso).toLocaleString('ru-RU') : '—'
}

function updateOpenLink(url) {
  openLink.href = url
}

function setStatus(text, kind) {
  statusBox.className = 'status' + (kind ? ' ' + kind : '')
  statusText.textContent = text
  spinner.style.display = kind === 'busy' ? 'block' : 'none'
  syncBtn.disabled = kind === 'busy'
  saveBtn.disabled = kind === 'busy'
  noteBusy(kind)
}

saveBtn.addEventListener('click', async () => {
  const raw = urlInput.value.trim().replace(/\/+$/, '')
  let origin
  try {
    origin = new URL(raw).origin
  } catch (err) {
    setStatus(t('badUrl'), 'err')
    return
  }
  saveBtn.disabled = true
  // Grant the extension access to the dashboard origin (needed to inject the payload).
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] })
  if (!granted) {
    setStatus(t('noAccess')(origin), 'err')
    saveBtn.disabled = false
    return
  }
  await chrome.storage.local.set({ aristosUrl: raw })
  updateOpenLink(raw)
  setStatus(t('urlSaved')(raw), 'ok')
  saveBtn.disabled = false
})

syncBtn.addEventListener('click', () => {
  lastPayload = null
  exportBtn.style.display = 'none'
  busyLimitMs = BUSY_LIMIT_CANVAS
  setStatus(t('connecting'), 'busy')

  const port = chrome.runtime.connect({ name: 'aristos-popup' })
  attachPortListeners(port)
  port.postMessage({ type: 'sync' })
})

debugHtmlBtn.addEventListener('click', async () => {
  const { platonusDebugHtml } = await chrome.storage.local.get('platonusDebugHtml')
  if (!platonusDebugHtml) return
  const blob = new Blob([platonusDebugHtml], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'platonus-journal-dump.html'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
})

exportBtn.addEventListener('click', () => {
  if (!lastPayload) return
  const blob = new Blob([JSON.stringify(lastPayload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'canvas-sync-' + new Date().toISOString().slice(0, 10) + '.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
})

// ---- Platonus ----

function renderPeriods(periods) {
  platonusPeriodsBox.innerHTML = ''
  for (const { year, term } of periods) {
    const label = document.createElement('label')
    label.className = 'period-item'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.dataset.year = String(year)
    checkbox.dataset.term = String(term)
    checkbox.addEventListener('change', updateImportButton)
    label.append(checkbox, document.createTextNode(t('periodLabel')(year, term)))
    platonusPeriodsBox.appendChild(label)
  }
  platonusPeriodsBox.style.display = 'block'
  platonusImportBtn.style.display = 'block'
}

function updateImportButton() {
  const any = [...platonusPeriodsBox.querySelectorAll('input[type=checkbox]')].some((c) => c.checked)
  platonusImportBtn.disabled = !any
}

platonusDiscoverBtn.addEventListener('click', () => {
  busyLimitMs = BUSY_LIMIT_PLATONUS
  setStatus(t('platonusSearching'), 'busy')
  const port = chrome.runtime.connect({ name: 'aristos-popup' })
  attachPortListeners(port)
  port.postMessage({ type: 'platonus-discover' })
})

platonusImportBtn.addEventListener('click', () => {
  const periods = [...platonusPeriodsBox.querySelectorAll('input[type=checkbox]:checked')].map((c) => ({
    year: Number(c.dataset.year),
    term: Number(c.dataset.term),
  }))
  if (periods.length === 0) return
  busyLimitMs = BUSY_LIMIT_PLATONUS
  setStatus(t('platonusImporting'), 'busy')
  const port = chrome.runtime.connect({ name: 'aristos-popup' })
  attachPortListeners(port)
  port.postMessage({ type: 'platonus-sync', periods })
})

// Shared port wiring so both Canvas and Platonus flows reuse one handler
function attachPortListeners(port) {
  port.onMessage.addListener((msg) => {
    if (!msg) return
    if (msg.type === 'progress') {
      setStatus(renderStage(msg) + ' ' + t('bgHint'), 'busy')
    } else if (msg.type === 'done') {
      updateLastSync(new Date().toISOString())
      const base = msg.kind === 'platonus'
        ? t('doneRecords')(msg.courses, msg.assignments)
        : t('syncDoneCanvas')(msg.courses, msg.assignments)
      // enrollments-запрос умер после ретраев — баллы курсов не приехали;
      // gradesDiag (статус/причина от Canvas) помогает понять, что сломалось
      const warn = msg.scoresMissing
        ? base + ' · ' + t('warnScoresMissing') + (msg.gradesDiag ? ` [${msg.gradesDiag}]` : '')
        : base
      setStatus(warn, 'ok')
    } else if (msg.type === 'platonus-periods') {
      renderPeriods(msg.periods)
      setStatus(t('periodsFound')(msg.periods.length), 'ok')
    } else if (msg.type === 'export') {
      lastPayload = msg.payload
      exportBtn.style.display = 'block'
      setStatus(t('pushFailed')(localizeError(msg.message)), 'err')
    } else if (msg.type === 'error') {
      setStatus(t('errorPrefix') + localizeError(msg.message), 'err')
    }
  })
}
