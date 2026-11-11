// Функции, исполняемые ВНУТРИ вкладки Платонуса: chrome.scripting.executeScript
// сериализует ТОЛЬКО саму функцию (замыкание и импорты не переносятся), поэтому
// каждая должна быть самодостаточной. Все функции СИНХРОННЫЕ — никаких setTimeout
// внутри страницы: скрытая вкладка агрессивно троттлится (таймеры раз в минуту
// после 5 минут в фоне), поэтому все ожидания делает background.js, опрашивая
// вкладку executeScript-ами. Файл — ES-модуль: его же импортируют тесты
// (tools/test-platonus-parser.mjs), прогоняя эти же тела через jsdom.

/** Парсер карточек журнала (страница /student_register после рендера).
 *  Структура карточки (проверено на живом HTML):
 *    div.card.border[data-id=subjectID]
 *      .project-box-header > .name[title="Название(КОД)"] > a  ← текст обрезается «...»,
 *                                                      полное имя — только в title
 *      div[align="center"]  ← преподаватель
 *      .chart[data-percent] ← донут «Итог %» (span.percent всегда 0 — анимируется JS)
 *      .project-box-footer > a > (.value + .label) ← пары «87.00 / Ср.тек. 1» */
export function platonusCardParser() {
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
    debug: { cardCount: document.querySelectorAll('.card').length, subjectCount: subjects.length, bodyLength: html.length },
  }
}

/** Шаг 1: снимок состояния #marksModal ДО клика + сам клик по карточке.
 *  Platonus грузит таблицы оценок XHR-ом getMarks только по клику на карточку.
 *  Модалку можно не «показывать»: getMarks заполняет .modal-body независимо от
 *  видимости, поэтому хвосты Bootstrap-переходов просто зачищаем. */
export function platonusCardClick(subjectID) {
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

/** Шаг 2 (поллинг из background): появились ли СВЕЖИЕ таблицы оценок.
 *  'ready' — таблицы есть и контент изменился; 'empty' — контент изменился, но
 *  таблиц Месяц/Дата/Оценка нет (XHR отработал пусто / только посещаемость);
 *  'pending' — контент ещё прежний (ждём XHR). */
export function platonusCardProbe(prevTitle, prevText) {
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

/** Шаг 3: снять оценки из #marksModal и зачистить модалку.
 *  Таблица: строка «Месяц» с colspan-ячейками названий месяцев, под ней «Дата»
 *  (дни) и «Оценка» (баллы); колонки выравниваются по накопленному colspan.
 *  Секции «КОД (преподаватель)» и таблицы идут вперемешку — держим код
 *  последнего встреченного заголовка. */
export function platonusCardExtract(year, withModalHtml) {
  const modal = document.getElementById('marksModal')
  if (!modal) return withModalHtml ? { marks: [], modalHtml: null } : []
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
        // выбранному году «2026» соответствует учебный 2026/27: авг–дек → year,
        // янв–июл → year+1. Раньше граница была на сентябре (month >= 9) и
        // августовские пары первого семестра (напр. 31.08) уезжали в year+1 —
        // «Август» вставал последним месяцем в сетке оценок по дням.
        const y = month >= 8 ? year : year + 1
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

  // зачистка хвостов Bootstrap (переходы в фоновой вкладке не доигрывают)
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
  const unique = marks.filter((m) => {
    const key = m.code + '|' + m.date + '|' + m.mark
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return withModalHtml ? { marks: unique, modalHtml: modal.outerHTML } : unique
}
