// Тесты парсера Платонуса (extension/platonus-inpage.js) через jsdom:
//  1) platonusCardParser — на РЕАЛЬНОМ дампе журнала (platonus-dump-sample.html):
//     раньше v2 терял карточки с обрезанным названием («Название ...») и предметы
//     без Ср.тек (физкультура), путал код у «Казахский (русский) язык 1(...)».
//  2) клик→probe→extract — на синтетической модалке по структуре скриншота журнала
//     (таблицы Месяц/Дата/Оценка с colspan, секции -L/-SRSP/-Р). Модалка заполняется
//     по клику на карточку (как XHR getMarks в реальном Платонусе).
//  3) контракты probe: pending/empty/ready, дедуп дубликатов, защита от stale.
import { readFileSync, existsSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { platonusCardParser, platonusCardClick, platonusCardProbe, platonusCardExtract } from '../extension/platonus-inpage.js'

// Живой дамп журнала — личные данные, лежит ВНЕ репо (../private-data).
// Нет дампа → секция 1 пропускается, синтетические тесты (2-3) работают везде.
const DUMP = new URL('../../private-data/platonus-dump-sample.html', import.meta.url)
const HAS_DUMP = existsSync(DUMP)

let failures = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) {
    failures++
    console.log(`FAIL ${label}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
  } else {
    console.log(`ok   ${label}`)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const NOOKTO_TABLES = `
  <div><b>NOOKTO 113142-1-L (Жангозиева М.С)</b>
    <table class="table">
      <tr><th>Месяц</th><th colspan="4">Сентябрь</th><th colspan="5">Октябрь</th><th colspan="4">Ноябрь</th><th colspan="2">Декабрь</th></tr>
      <tr><th>Дата</th><td>3</td><td>10</td><td>17</td><td>24</td><td>1</td><td>8</td><td>15</td><td>22</td><td>29</td><td>5</td><td>12</td><td>21</td><td>28</td><td>5</td><td>10</td></tr>
      <tr><th>Оценка</th><td>0</td><td>70</td><td>70</td><td>70</td><td>70</td><td>70</td><td>70</td><td>0</td><td>70</td><td>50</td><td>70</td><td>55</td><td>55</td><td>80</td><td>90</td></tr>
    </table>
  </div>
  <div><b>NOOKTO 112142-1-SRSP (Жангозиева М.С)</b>
    <table class="table">
      <tr><th>Месяц</th><th colspan="2">Октябрь</th><th colspan="2">Ноябрь</th></tr>
      <tr><th>Дата</th><td>6</td><td>20</td><td>19</td><td>26</td></tr>
      <tr><th>Оценка</th><td>70</td><td>70</td><td>83</td><td>70</td></tr>
    </table>
  </div>
  <div><b>NOOKTO 112142-2-Р (Жангозиева М.С)</b>
    <table class="table">
      <tr><th>Месяц</th><th>Сентябрь</th><th colspan="5">Октябрь</th></tr>
      <tr><th>Дата</th><td>26</td><td>3</td><td>10</td><td>17</td><td>24</td><td>31</td></tr>
      <tr><th>Оценка</th><td>0</td><td>0</td><td>55</td><td>60</td><td>60</td><td>50</td></tr>
    </table>
  </div>`

const SPRING_TABLE = `
  <div><b>IstK 1102-12-L (Ким Н.И)</b>
    <table><tr><th>Месяц</th><th colspan="2">Январь</th></tr>
    <tr><th>Дата</th><td>9</td><td>23</td></tr>
    <tr><th>Оценка</th><td>75</td><td>82</td></tr></table>
  </div>`

// Августовские пары первого семестра (как у «Инклюзивная образовательная среда»
// осени 2026/27: 31.08 = 100) — при year=2026 август должен остаться в 2026,
// а не уехать в 2027 (раньше уезжал — «Август» вставал последним в сетке).
const AUGUST_TABLE = `
  <div><b>IOS 112142-1-L (Шарипова А.Б)</b>
    <table><tr><th>Месяц</th><th>Август</th><th>Сентябрь</th></tr>
    <tr><th>Дата</th><td>31</td><td>7</td></tr>
    <tr><th>Оценка</th><td>100</td><td>100</td></tr></table>
  </div>`

// ---------- 1. Парсер карточек на реальном дампе ----------
if (HAS_DUMP) {
  const html = readFileSync(DUMP, 'utf8')
  const dom = new JSDOM(html)
  globalThis.document = dom.window.document
  const parsed = platonusCardParser()

  check('studentID', parsed.studentID, 208)
  check('years', parsed.years, [2024, 2025, 2026])
  check('terms', parsed.terms, [1, 2, -1, -2])
  check('все 7 предметов найдены', parsed.subjects.length, 7)

  const byName = Object.fromEntries(parsed.subjects.map((s) => [s.name, s]))

  // обрезанное в тексте название — должно взяться из title-атрибута целиком
  const ikt = byName['Информационно-коммуникационные технологии']
  check('ИКТ найдена (v2 теряла)', Boolean(ikt), true)
  check('ИКТ код', ikt && ikt.code, 'IKT 111152-1-L')
  check('ИКТ финал из data-percent', ikt && ikt.final, 85)
  check('ИКТ РК1 пуст (прочерк)', ikt && ikt.rk1, null)
  check('ИКТ рейтинг', ikt && ikt.rating, 75)

  const fk = byName['Физическая культура']
  check('Физкультура найдена (v2 теряла)', Boolean(fk), true)
  check('Физкультура рейтинг 0', fk && fk.rating, 0)

  const krya = byName['Казахский (русский) язык 1']
  check('Казахский: имя с внутренней скобкой', Boolean(krya), true)
  check('Казахский: код не «русский»', krya && krya.code, 'KRYa 111152-37-P')

  const fil = byName['Иностранный язык 1']
  check('Иностранный: значения', fil && [fil.srTek1, fil.rk1, fil.srTek2, fil.rk2, fil.rating, fil.exam], [87, 87, 93, 93, 90, 95])
  check('Иностранный: subjectID', fil && fil.subjectID, 63)
  check('Иностранный: преподаватель', fil && fil.teacher, 'Сапарова А.И')
}

// ---------- 2. клик → probe → extract (модалка заполняется «XHR»-ом по клику) ----------
{
  const fixture = `<!doctype html><html><body>
  <div class="card border" data-id="300">
    <div class="project-box-header"><div class="name" title="Наука об образовании и ключевые теории обучения(NOOKTO 113142-1-L)"><a>Наука об образовании и ключевые теории о ...</a></div></div>
  </div>
  <div class="card border" data-id="301">
    <div class="project-box-header"><div class="name" title="История Казахстана(IstK 1102-12-L)"><a>История Казахстана(IstK 1102-12-L)</a></div></div>
  </div>
  <div class="card border" data-id="302">
    <div class="project-box-header"><div class="name" title="Инклюзивная образовательная среда(IOS 112142-1-L)"><a>Инклюзивная образовательная среда(IOS 112142-1-L)</a></div></div>
  </div>
  <div class="modal fade" id="marksModal" aria-hidden="true">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLabel"></h5>
        <button type="button" class="btn-close"></button>
      </div>
      <div class="modal-body"></div>
    </div>
  </div>
  </body></html>`
  const dom = new JSDOM(fixture)
  globalThis.document = dom.window.document
  // «сервер»: по клику на карточку заполняет модалку, как getMarks-XHR
  const fill = (title, bodyHtml) =>
    setTimeout(() => {
      document.querySelector('#marksModal .modal-title').textContent = title
      document.querySelector('#marksModal .modal-body').innerHTML = bodyHtml
    }, 120)
  document.querySelector(".card[data-id='300'] .project-box-header").addEventListener('click', () =>
    fill('Наука об образовании и ключевые теории обучения(NOOKTO 113142-1-L)', NOOKTO_TABLES))
  document.querySelector(".card[data-id='301'] .project-box-header").addEventListener('click', () =>
    fill('История Казахстана(IstK 1102-12-L)', SPRING_TABLE))
  document.querySelector(".card[data-id='302'] .project-box-header").addEventListener('click', () =>
    fill('Инклюзивная образовательная среда(IOS 112142-1-L)', AUGUST_TABLE))

  const clicked = platonusCardClick(300)
  check('click: ok + пустые базлайны', [clicked.ok, clicked.prevTitle, clicked.prevText], [true, '', ''])
  check('probe до XHR: pending', platonusCardProbe(clicked.prevTitle, clicked.prevText).state, 'pending')
  await sleep(200)
  const probe = platonusCardProbe(clicked.prevTitle, clicked.prevText)
  check('probe после XHR: ready', probe.state, 'ready')

  const marks = platonusCardExtract(2025, false)
  check('всего оценок в модалке', marks.length, 25)

  check('лекция: первая (0 в журнале — сохраняем)', marks[0], { code: 'NOOKTO 113142-1-L', kind: 'lecture', date: '2025-09-03', mark: 0 })
  check('лекция: вторая', marks[1].date, '2025-09-10')
  check('лекция: колонки не съехали после colspan', marks[4], { code: 'NOOKTO 113142-1-L', kind: 'lecture', date: '2025-10-01', mark: 70 })
  check('лекция: последняя', marks[14], { code: 'NOOKTO 113142-1-L', kind: 'lecture', date: '2025-12-10', mark: 90 })

  const srsp = marks.filter((m) => m.kind === 'srsp')
  check('СРСП: код и количество', [srsp[0] && srsp[0].code, srsp.length], ['NOOKTO 112142-1-SRSP', 4])
  check('СРСП: дата из colspan-месяца', srsp[2] && srsp[2].date, '2025-11-19')

  const practice = marks.filter((m) => m.kind === 'practice')
  check('Практика: кириллический суффикс -Р', practice.length, 6)
  check('Практика: первая дата', practice[0] && practice[0].date, '2025-09-26')

  // extract зачистил модалку — probe больше не должен считать её «своей»
  check('extract зачистил show-состояние', document.getElementById('marksModal').classList.contains('show'), false)

  // вторая карточка: весенний семестр, месяцы 1–7 уезжают в year+1
  const clicked2 = platonusCardClick(301)
  await sleep(200)
  const probe2 = platonusCardProbe(clicked2.prevTitle, clicked2.prevText)
  check('вторая карточка: ready', probe2.state, 'ready')
  const spring = platonusCardExtract(2024, false)
  check('весна: январь = year+1', spring.map((m) => m.date), ['2025-01-09', '2025-01-23'])
  check('весна: код/вид', [spring[0].code, spring[0].kind], ['IstK 1102-12-L', 'lecture'])

  // третья карточка: осенний семестр с августовскими парами — 31.08 остаётся в year
  const clicked3 = platonusCardClick(302)
  await sleep(200)
  const probe3 = platonusCardProbe(clicked3.prevTitle, clicked3.prevText)
  check('третья карточка: ready', probe3.state, 'ready')
  const autumn = platonusCardExtract(2026, false)
  check('осень: август 31 = year (не year+1)', autumn.map((m) => m.date), ['2026-08-31', '2026-09-07'])
  check('осень: код/вид', [autumn[0].code, autumn[0].kind], ['IOS 112142-1-L', 'lecture'])
}

// ---------- 3. Контракты: stale / empty / дедуп ----------
{
  const fixture = `<!doctype html><html><body>
  <div class="card border" data-id="1"><div class="project-box-header"><div class="name" title="A(X 1-L)"><a>A</a></div></div></div>
  <div class="modal" id="marksModal">
    <h5 class="modal-title"></h5>
    <button class="btn-close"></button>
    <div class="modal-body"></div>
  </div></body></html>`
  const dom = new JSDOM(fixture)
  globalThis.document = dom.window.document

  // клик без ответа XHR: контент не менялся → pending (background не должен снимать чужое)
  const clicked = platonusCardClick(1)
  check('нет XHR: click ok', clicked.ok, true)
  check('нет XHR: probe pending', platonusCardProbe(clicked.prevTitle, clicked.prevText).state, 'pending')

  // stale: повторный клик по ТОЙ ЖЕ карточке — контент совпадает с до-кликовым
  // (baseline — реальный textContent, как его снимает platonusCardClick)
  const reclick = platonusCardClick(1)
  check('идентичный контент: pending (не ready)', platonusCardProbe(reclick.prevTitle, reclick.prevText).state, 'pending')

  // empty: контент изменился, но журнальных таблиц нет (только посещаемость)
  document.querySelector('#marksModal .modal-title').textContent = 'A(X 1-L)'
  document.querySelector('#marksModal .modal-body').innerHTML = '<div>Посещаемость: 90%</div>'
  check('контент без таблиц: empty', platonusCardProbe('', '').state, 'empty')

  // дедуп: два одинаковых код+дата (залипшая анимация) → одна запись
  document.querySelector('#marksModal .modal-body').innerHTML = `
    <div><b>X 1-L</b><table><tr><th>Месяц</th><th>Сентябрь</th></tr><tr><th>Дата</th><td>5</td></tr><tr><th>Оценка</th><td>70</td></tr></table></div>
    <div><b>X 1-L</b><table><tr><th>Месяц</th><th>Сентябрь</th></tr><tr><th>Дата</th><td>5</td></tr><tr><th>Оценка</th><td>70</td></tr></table></div>`
  const deduped = platonusCardExtract(2025, false)
  check('дедуп дубликатов', deduped.length, 1)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
