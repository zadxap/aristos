// Инжект-скрипт для webview на platonus.yu.edu.kz (нативный синк Aristos).
// Порт функций из extension/platonus-inpage.js (парсер карточек, click/probe/
// extract #marksModal) + page-side драйвер: в отличие от MV3-расширения здесь
// НЕ нужно выносить ожидания в воркер — это обычная страница в webview
// приложения, setTimeout не троттлится до минуты. Параметры подмешивает
// native-sync.ts: window.__ARISTOS_PARAMS__ = {...}; затем текст этого файла.
// Результат — через window.__TAURI__.core.invoke('sync_payload').
(function () {
  'use strict'

  const P = window.__ARISTOS_PARAMS__ || {}

  // Доставка результата — канал заголовка окна (title): ARISTOS_D|idx|total|chunk.
  // Host подтверждает чтение eval-ом (window.__ARISTOS_ACK = прочитано чанков).
  // Single-chunk сообщения (прогресс, need-login, discover) идут без ACK —
  // драйвер всё равно молчит до следующего emit, host успевает прочитать.
  // IPC-путь убран: remote-IPC оказался ненадёжен, title работает всегда,
  // где работает сам инжект.
  function emit(msg) {
    const payload = JSON.stringify(msg)
    const chunks = payload.match(/[\s\S]{1,1400}/g) || ['']
    if (chunks.length === 1) {
      document.title = 'ARISTOS_D|0|1|' + chunks[0]
      return Promise.resolve()
    }
    return (async () => {
      for (let i = 0; i < chunks.length; i++) {
        document.title = 'ARISTOS_D|' + i + '|' + chunks.length + '|' + chunks[i]
        const deadline = Date.now() + 15000
        while ((window.__ARISTOS_ACK || -1) <= i && Date.now() < deadline) {
          await sleep(100)
        }
        if ((window.__ARISTOS_ACK || -1) <= i) {
          throw new Error('title-ack-timeout')
        }
      }
    })()
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  /** Парсер карточек журнала (страница /student_register после рендера).
   *  Структура карточки (проверено на живом HTML):
   *    div.card.border[data-id=subjectID]
   *      .project-box-header > .name[title="Название(КОД)"]  ← текст обрезается «...»,
   *                                                      полное имя — только в title
   *      div[align="center"]  ← преподаватель
   *      .chart[data-percent] ← донут «Итог %» (span.percent всегда 0 — анимируется JS)
   *      .project-box-footer > a > (.value + .label) ← пары «87.00 / Ср.тек. 1» */
  function cardParser() {
    const html = document.documentElement.innerHTML
    const studentMatch = html.match(/window\.student\s*=\s*\{\s*studentID:\s*(\d+)/)
    const years = [...document.querySelectorAll('#year option')].map((o) => Number(o.value)).filter((v) => Number.isFinite(v))
    const terms = [...document.querySelectorAll('select[name="term"] option')].map((o) => Number(o.value)).filter((v) => Number.isFinite(v))

    const num = (raw) => {
      if (raw === null || raw === undefined) return null
      const s = String(raw).replace(',', '.').trim()
      if (!s || s === '-') return null
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }

    const subjects = []
    for (const card of document.querySelectorAll('.card')) {
      if (card.getAttribute('data-id') === null) continue // обёртки («card mb-4») — не карточки предметов
      const nameEl = card.querySelector('.project-box-header .name')
      if (!nameEl) continue // не карточка предмета (страничные обёртки, модалки)
      const full = (nameEl.getAttribute('title') || nameEl.textContent || '').replace(/\s+/g, ' ').trim()
      if (!full) continue
      // lastIndexOf('('): у «Казахский (русский) язык 1(KRYa …)» первая скобка — часть названия
      const parenIdx = full.lastIndexOf('(')
      const name = parenIdx > 0 ? full.slice(0, parenIdx).trim() : full
      const code = parenIdx > 0 ? full.slice(parenIdx + 1).replace(/\)\s*$/, '').trim() : ''

      const teacherEl = card.querySelector('div[align="center"]')
      const teacher = teacherEl ? (teacherEl.textContent || '').replace(/\s+/g, ' ').trim() || null : null

      const values = {}
      let hasAnyValue = false
      for (const a of card.querySelectorAll('.project-box-footer a')) {
        const valueEl = a.querySelector('.value')
        const labelEl = a.querySelector('.label')
        if (!labelEl) continue
        const label = (labelEl.textContent || '').replace(/\s+/g, ' ').trim()
        const value = num(valueEl ? valueEl.textContent : null)
        if (value !== null) hasAnyValue = true
        if (/^Ср\.?\s*тек\.?\s*1/.test(label)) values.srTek1 = value
        else if (/^Ср\.?\s*тек\.?\s*2/.test(label)) values.srTek2 = value
        else if (/^РК\s*1/.test(label)) values.rk1 = value
        else if (/^РК\s*2/.test(label)) values.rk2 = value
        else if (/^Рейтинг/.test(label)) values.rating = value
        else if (/^Экз/.test(label)) values.exam = value
      }

      const chart = card.querySelector('.chart[data-percent]')
      let final = chart ? num(chart.getAttribute('data-percent')) : null
      // донут «0» у ещё неоцененного предмета показываем как «—», а не «0%»
      if (final === 0 && !hasAnyValue) final = null

      subjects.push({
        subjectID: card.getAttribute('data-id') !== null ? Number(card.getAttribute('data-id')) : null,
        name,
        code,
        teacher,
        final,
        srTek1: values.srTek1 !== undefined ? values.srTek1 : null,
        rk1: values.rk1 !== undefined ? values.rk1 : null,
        srTek2: values.srTek2 !== undefined ? values.srTek2 : null,
        rk2: values.rk2 !== undefined ? values.rk2 : null,
        rating: values.rating !== undefined ? values.rating : null,
        exam: values.exam !== undefined ? values.exam : null,
      })
    }

    return {
      studentID: studentMatch ? Number(studentMatch[1]) : null,
      years,
      terms,
      subjects,
    }
  }

  /** Шаг 1: снимок состояния #marksModal ДО клика + сам клик по карточке.
   *  Platonus грузит таблицы оценок XHR-ом getMarks только по клику на карточку. */
  function cardClick(subjectID) {
    const modal = document.getElementById('marksModal')
    if (!modal) return { ok: false }

    // хвост прошлого открытия: зачищаем, чтобы клик не попал в открытую модалку
    if (modal.classList.contains('show')) {
      modal.classList.remove('show')
      modal.style.display = 'none'
      modal.setAttribute('aria-hidden', 'true')
      document.body.classList.remove('modal-open')
      document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove())
    }

    const cards = [...document.querySelectorAll('.card')].filter(
      (c) => c.getAttribute('data-id') !== null && c.querySelector('.project-box-header .name'),
    )
    const card = cards.find((c) => Number(c.getAttribute('data-id')) === Number(subjectID))
    const header = card ? card.querySelector('.project-box-header') : null
    if (!header) return { ok: false }

    const titleEl = modal.querySelector('.modal-title')
    const bodyEl = modal.querySelector('.modal-body')
    const prevTitle = titleEl ? titleEl.textContent : ''
    const prevText = bodyEl ? bodyEl.textContent : ''
    header.click()
    return { ok: true, prevTitle, prevText }
  }

  /** Шаг 2: появились ли СВЕЖИЕ таблицы оценок.
   *  'ready' — таблицы есть и контент изменился; 'empty' — контент изменился,
   *  но таблиц Месяц/Дата/Оценка нет; 'pending' — контент ещё прежний. */
  function cardProbe(prevTitle, prevText) {
    const modal = document.getElementById('marksModal')
    if (!modal) return { state: 'pending' }
    const titleEl = modal.querySelector('.modal-title')
    const bodyEl = modal.querySelector('.modal-body')
    const title = titleEl ? titleEl.textContent : ''
    const text = bodyEl ? bodyEl.textContent : ''
    if (title === prevTitle && text === prevText) return { state: 'pending', title, text }
    const isJournalTable = (table) => {
      const firsts = [...table.querySelectorAll('tr')].map((r) => (r.cells[0] ? r.cells[0].textContent.trim() : ''))
      const hasMonth = firsts.some((t) => /^Месяц|^Ай/.test(t))
      const hasDate = firsts.some((t) => /^Дата|^Күн/.test(t))
      const hasMark = firsts.some((t) => /^Оценка|^Баға/.test(t))
      return hasMonth && hasDate && hasMark
    }
    const tables = bodyEl ? [...bodyEl.querySelectorAll('table')] : []
    const hasJournal = tables.some(isJournalTable)
    return { state: hasJournal ? 'ready' : 'empty', title, text }
  }

  /** Шаг 3: снять оценки из #marksModal и зачистить модалку. */
  function cardExtract(year) {
    const modal = document.getElementById('marksModal')
    if (!modal) return []
    const bodyEl = modal.querySelector('.modal-body')

    const MONTHS = {
      'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'май': 5, 'мая': 5, 'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12,
      'қаң': 1, 'ақп': 2, 'нау': 3, 'сәу': 4, 'мам': 5, 'мау': 6, 'шіл': 7, 'там': 8, 'қыр': 9, 'қаз': 10, 'қар': 11, 'жел': 12,
    }
    const monthOf = (raw) => {
      const s = String(raw || '').toLowerCase().trim()
      for (const prefix in MONTHS) if (s.startsWith(prefix)) return MONTHS[prefix]
      return null
    }
    const kindOf = (code) => {
      const suf = (code.match(/-([A-Za-zА-Яа-яЁё0-9]+)$/) || ['', ''])[1].toLowerCase()
      if (suf === 'l') return 'lecture'
      if (suf === 'p' || suf === 'р') return 'practice' // «-Р» бывает кириллической
      if (suf === 'srsp' || suf === 'срсп') return 'srsp'
      return 'other'
    }
    const CODE_RE = /[A-Za-zА-Яа-яЁё]{2,10}\s*\d{4,6}-\d+(?:-[A-Za-zА-Яа-яЁё0-9]+)?/
    const isJournalTable = (table) => {
      const firsts = [...table.querySelectorAll('tr')].map((r) => (r.cells[0] ? r.cells[0].textContent.trim() : ''))
      const hasMonth = firsts.some((t) => /^Месяц|^Ай/.test(t))
      const hasDate = firsts.some((t) => /^Дата|^Күн/.test(t))
      const hasMark = firsts.some((t) => /^Оценка|^Баға/.test(t))
      return hasMonth && hasDate && hasMark
    }

    const marks = []
    if (bodyEl) {
      let currentCode = ''
      let currentKind = 'other'

      const parseTable = (table) => {
        const monthByCol = []
        const dateByCol = []
        const markByCol = []
        for (const row of table.querySelectorAll('tr')) {
          const cells = [...row.cells]
          const label = cells[0] ? cells[0].textContent.trim() : ''
          const isMonth = /^Месяц|^Ай/.test(label)
          const isDate = /^Дата|^Күн/.test(label)
          const isMark = /^Оценка|^Баға/.test(label)
          const target = isMonth ? monthByCol : isDate ? dateByCol : isMark ? markByCol : null
          if (!target) continue
          let col = 0
          for (const cell of cells.slice(1)) {
            const span = Math.max(1, Number(cell.getAttribute('colspan')) || 1)
            const text = (cell.textContent || '').replace(/\s+/g, ' ').trim()
            for (let k = 0; k < span; k++) target[col++] = isMonth ? monthOf(text) : text
          }
        }
        const out = []
        const nCols = Math.max(monthByCol.length, dateByCol.length, markByCol.length)
        for (let col = 0; col < nCols; col++) {
          const mark = Number(String(markByCol[col] !== undefined ? markByCol[col] : '').replace(',', '.'))
          const day = Number(dateByCol[col])
          const month = monthByCol[col]
          if (!Number.isFinite(mark) || !Number.isFinite(day) || !month) continue
          // учебный год начинается с сентября: месяцы 1–8 относятся к year+1
          const y = month >= 9 ? year : year + 1
          out.push({
            code: currentCode,
            kind: currentKind,
            date: y + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
            mark,
          })
        }
        return out
      }

      const walk = (el) => {
        for (const child of el.children) {
          if (child.tagName === 'TABLE') {
            if (isJournalTable(child)) marks.push(...parseTable(child))
            continue
          }
          const text = (child.textContent || '').replace(/\s+/g, ' ').trim()
          const cm = text.match(CODE_RE)
          if (cm) {
            currentCode = cm[0].replace(/\s+/g, ' ').trim()
            currentKind = kindOf(currentCode)
          }
          if (child.children.length) walk(child)
        }
      }
      walk(bodyEl)
    }

    // зачистка хвостов Bootstrap (переходы могли не доиграть)
    modal.classList.remove('show')
    modal.style.display = 'none'
    modal.setAttribute('aria-hidden', 'true')
    modal.removeAttribute('role')
    modal.removeAttribute('aria-modal')
    document.body.classList.remove('modal-open')
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('padding-right')
    document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove())

    // дедуп (залипшая анимация ng-repeat может оставить старые секции —
    // у предмета не бывает двух одинаковых код+дата)
    const seen = new Set()
    return marks.filter((m) => {
      const key = m.code + '|' + m.date + '|' + m.mark
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /** Ждём, пока страница сама догрузит журнал (XHR после boot). */
  async function waitForJournal() {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (document.body && document.body.textContent.includes('Ср.тек')) return true
      await sleep(700)
    }
    return false
  }

  /** Оценки по дням одной карточки: клик → поллинг модалки → съём таблиц. */
  async function cardMarks(subjectID, year) {
    const clicked = cardClick(subjectID)
    if (!clicked || !clicked.ok) return []
    // ждём СВЕЖИЙ контент модалки, устоявшийся два опроса подряд
    let lastReady = null
    let probe = null
    for (let attempt = 0; attempt < 24; attempt++) {
      await sleep(500)
      probe = cardProbe(clicked.prevTitle, clicked.prevText)
      if (probe.state === 'empty') return []
      if (probe.state === 'ready' && lastReady && lastReady.text === probe.text) break
      if (probe.state === 'ready') lastReady = probe
    }
    if (!probe || probe.state !== 'ready') return []
    let extracted = cardExtract(year)
    // контент мог доехать после первого съёма — если модалка изменилась, снимаем ещё раз
    const verify = cardProbe(clicked.prevTitle, clicked.prevText)
    if (verify.state === 'ready' && verify.text !== probe.text) extracted = cardExtract(year)
    return extracted
  }

  async function discover() {
    await waitForJournal()
    const parsed = cardParser()
    if (!parsed.studentID) {
      await emit({ type: 'need-login', kind: 'platonus' })
      return
    }
    const periods = []
    for (const year of parsed.years.length ? parsed.years : []) {
      for (const term of parsed.terms.length ? parsed.terms : [1, 2]) {
        if (term > 0) periods.push({ year, term }) // extra terms (-1/-2) — по запросу позже
      }
    }
    await emit({ type: 'platonus-discovered', studentID: parsed.studentID, periods, previewCount: parsed.subjects.length })
  }

  async function harvest() {
    const year = Number(P.year)
    const term = Number(P.term)
    await waitForJournal()
    const parsed = cardParser()
    if (!parsed.studentID) {
      await emit({ type: 'need-login', kind: 'platonus' })
      return
    }
    const subjects = parsed.subjects || []
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i]
      await emit({
        type: 'progress',
        stage: 'platonus-marks',
        year,
        term,
        idx: i + 1,
        total: subjects.length,
        name: subject.name,
      })
      if (subject.subjectID === null || subject.subjectID === undefined) {
        subject.marks = []
        continue
      }
      subject.marks = await cardMarks(subject.subjectID, year)
    }
    await emit({
      type: 'platonus-period',
      record: {
        id: year + '-' + term,
        year,
        term,
        syncedAt: new Date().toISOString(),
        subjects,
      },
    })
  }

  ;(async () => {
    try {
      if (P.mode === 'discover') await discover()
      else await harvest()
    } catch (err) {
      await emit({ type: 'error', message: String((err && err.message) || err) })
    }
  })()
})()
