/**
 * Русский словарь. Типизирован от казахской базы: TypeScript не даст
 * пропустить ни один ключ Dict и не даст добавить лишний.
 */
import type { Dict } from "./kk"

/** Русские формы множественного числа: plural(5, 'предмет', 'предмета', 'предметов') → 'предметов'. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export const ru: Dict = {
  appName: "Aristos",
  appSubtitle: "Студенческий дашборд",

  // Navigation
  home: "Главная",
  calendar: "Календарь",
  subjects: "Предметы",
  menu: "Меню",

  // Language
  language: "Язык",
  langKk: "KK",
  langRu: "RU",

  // Home Status
  today: "Сегодня",
  lesson: "Занятие",
  breakTime: "Перерыв",
  beforeStart: "День ещё не начался",
  minutesLeft: "осталось",
  minutesUntilNext: "минут до следующего занятия",
  freeDay: "Свободный день",
  dayEnded: "Занятия на сегодня закончились",
  holiday: "Каникулы",
  exam: "Экзаменационная сессия",
  midterm: "Рубежный контроль",
  practice: "Практика",
  week: "нед.",
  weekProgress: "Ход учебной недели",
  noLessonsToday: "В этот день занятий нет",
  currentLesson: "Текущее занятие",
  upcomingLesson: "Следующее занятие",
  nowBadge: "Сейчас",
  nextBadge: "Далее",
  statusInClass: "Идёт занятие",
  holidayPeriod: "Каникулы",
  holidayName: "Каникулы",
  practiceName: "Практика",
  outOfSemester: "Вне семестра",
  outOfSemesterDesc: "На этот день учебное расписание не назначено.",
  holidayDesc: "Каникулы. Хорошо отдохните!",
  examDesc: "Экзаменационная сессия. Удачи!",
  dayEndedDesc: "Расписание на сегодня полностью выполнено.",
  freeDayDesc: "На сегодня занятия не запланированы.",
  unitHour: "ч",
  unitMin: "мин",

  // Home page
  homeBadge: "Aristos · Студенческое пространство",
  homeTitle: "Обзор вашего учебного дня",
  weeklySchedule: "Расписание недели",
  // Редактор раскладки главной (режим редактирования)
  homeLayout: "Раскладка главной страницы",
  homeLayoutHint:
    "Перемещайте блоки, меняйте колонку или скрывайте — раскладка сохраняется на устройстве",
  homeLayoutReset: "Сбросить раскладку",
  homeBlockHidden: "Скрытые блоки",
  homeBlockShow: "Показать",
  homeBlockHide: "Скрыть",
  homeBlockDrag: "Перетащить блок на другое место",
  homeBlockMoveUp: "Выше",
  homeBlockMoveDown: "Ниже",
  homeBlockMoveColumn: "В другую колонку",
  homeBlocks: {
    status: "Статус сейчас",
    week: "Учебная неделя",
    schedule: "Расписание недели",
    tomorrow: "Расписание на завтра",
    deadlines: "Ближайшие дедлайны",
    advice: "Совет недели",
    radar: "Радар предметов",
    gpa: "GPA",
    notes: "Заметки",
  },
  gpaMiniOpen: "Калькулятор",
  gpaMiniEmpty: "Нет предметов — заполните в GPA-калькуляторе",
  gpaMiniCredits: (n: number): string => `учтено ${n} кредитов`,
  tomorrowSchedule: "Расписание на завтра",
  tomorrowEmpty: "Завтра занятий нет",
  notesTitle: "Заметки",
  notesPlaceholder: "Дела, ссылки, личные пометки…",
  notesEmptyHint: "Пока пусто — запишите что-нибудь",
  // Пресеты цветовых схем
  themePreset: "Стиль",
  advSection: "Стили и кастомизация",
  userCssHooksTitle: "Хуки для CSS (селекторы)",
  userCssTitle: "Свой CSS",
  userCssPlaceholder: "/* свой CSS поверх всего */",
  userCssHint:
    "Моддерам: CSS применяется поверх всего. Осторожно — может сломать вёрстку.",
  userCssReset: "Очистить",
  presetMonolith: "Монолит",
  presetCobalt: "Кобальт",
  presetDeck: "Дека",
  notifSection: "Уведомления",
  notifAllow: "Разрешить уведомления",
  notifLessons: "Начало пар",
  notifDeadlines: "Дедлайны",
  notifBlocked: "Заблокированы в браузере — включите в настройках сайта",
  notifUnsupported: "Браузер не поддерживает уведомления",
  notifLessonTitle: "Скоро занятие",
  notifDeadlineTitle: "Приближается дедлайн",
  notifBefore: "Напоминать о паре за",
  notifMinutesShort: "мин",
  notifNativeHint: "На телефоне напоминания приходят даже с закрытым приложением",
  widgetToday: "Сегодня",
  widgetTomorrow: "Завтра",
  widgetSchedule: "Расписание",
  widgetDeadlines: "Дедлайны",
  widgetEmpty: "Нет данных — откройте приложение",
  widgetNoDeadlines: "Близких дедлайнов нет",
  syncSection: "Синхронизация (из приложения)",
  syncNativeHint:
    "Данные берутся напрямую из живой сессии — браузерное расширение не нужно",
  syncCanvasBtn: "Синхронизировать Canvas",
  syncPlatonusDiscover: "Найти доступные периоды",
  syncPlatonusImport: "Импорт выбранных",
  syncPeriodsFound: (n: number): string => `Найдено периодов: ${n}`,
  syncStageCanvasCourses: "Canvas: курсы…",
  syncStageCanvasAssignments: "Canvas: задания…",
  syncStageLogin: "Открыто окно входа — выполните вход…",
  syncStageApply: "Применяем…",
  syncStagePlatonusPeriod: (i: number, total: number, y: number, t: number): string =>
    `Платонус: ${y}/${t} (${i}/${total})…`,
  syncStagePlatonusMarks: (y: number, t: number, i: number, n: number): string =>
    `Платонус: ${y}/${t} — оценки ${i}/${n}…`,
  syncLoginTimeout: "Не дождались входа — попробуйте снова",
  syncAlreadyRunning: "Синхронизация уже идёт — подождите",
  syncTimeout: "Синхронизация не ответила вовремя",
  syncPlatonusNoPeriods:
    "Периоды не найдены — войдите в Платонус и один раз откройте «Журнал»",
  syncPlatonusEmpty: "Журнал пуст во всех выбранных периодах",
    syncWarnScoresMissing: "баллы не загрузились — повторите Canvas-синк",
syncFailRaw: (msg: string): string => `Ошибка синка: ${msg}`,
  updateSection: "Обновление",
  updateVersion: "Версия",
  updateAvailable: "Доступна новая версия: {v}",
  updateInstallBtn: "Обновить и перезапустить",
  updateDownloadApk: "Скачать APK",
  updateDownloadHint: "APK скачан — откройте файл и установите",
  updateInstalling: "Обновляем…",
  updateUpToDate: "Установлена последняя версия",
  updateCheckBtn: "Проверить обновления",
  updateFail: "Не удалось обновить — попробуйте снова",
  presetAristos: "Стандарт",
  presetOcean: "Океан",
  presetForest: "Лес",
  presetSunset: "Закат",
  presetGlass: "Стекло (эксперимент)",

  // Radar widget
  radarTitle: "Радар предметов",
  radarEmpty: "Оценок недостаточно — для радара нужно минимум 3 предмета",
  radarHint: "Текущий балл курсов Canvas, 0–100",

  // Local (data-driven) advice fallback
  adviceLocalBadge: "Автосовет",
  adviceLocalNote: "Локальный совет: рассчитан по данным. Ключ AI не настроен.",
  adviceNearest: "Ближайший срок",
  adviceMissing: "Невыполненные задания",
  adviceWeakest: "Самый слабый курс",
  adviceRk: "Рубежный контроль",
  adviceToday: "Сегодня",

  // Advisor chat history
  chatNew: "Новый чат",
  chatHistory: "История чатов",
  chatDelete: "Удалить чат",
  chatUntitled: "Чат без названия",
  chatEmptyHistory: "История диалогов пуста",
  chatEmptyHistoryDesc:
    "Задайте вопрос академическому советнику, чтобы начать диалог",
  chatClearAll: "Очистить историю",
  chatClearAllConfirm: "Удалить всю историю чатов?",
  chatMessagesCount: (n: number): string => `${n} сообщ.`,
  chatActiveBadge: "Активный",
  cloudSyncSummary: (s: {
    subjects: number
    schedules: number
    calendars: number
    canvasCourses: number
    canvasAssignments: number
    platonus: number
    activeCourse: number
  }): string =>
    `Предметы: ${s.subjects} · Расписания: ${s.schedules} · Календари: ${s.calendars} · Canvas: ${s.canvasCourses} курс / ${s.canvasAssignments} зад. · Платонус: ${s.platonus} год · Активный курс: ${s.activeCourse}`,

  // AI advisor
  advisorSubtitle: "Анализ успеваемости, what-if, стратегия",
  aiConnected: "Подключено",
  aiNotConfigured: "Не настроено",
  aiSettings: "Настройки AI",
  aiAskTitle: "Что спросить:",
  aiExample1: "«Какие мои слабые места и что подтянуть?»",
  aiExample2:
    "«Если вытяну Мәліметтер қоры на 95 — насколько вырастет рейтинг?»",
  aiExample3: "«Что приоритетнее на этой неделе?»",
  youLabel: "Ты",
  aiThinking: "AI думает...",
  aiAnalyzing: "Анализирую данные...",
  aiPlaceholder: "Спроси что угодно...",
  aiPlaceholderSetup: "Настрой AI (⚙) и синкни данные",
  aiProvider: "Провайдер",
  aiProviderOpenaiCompat: "OpenAI-совместимый (omniroute, api.openai.com...)",
  aiModelHint: "Model (flash-lite = дешёвые лимиты)",
  refresh: "Обновить",

  // Details
  room: "Аудитория",
  teacher: "Преподаватель",
  contact: "Контакты",
  phone: "Телефон",
  email: "Email",
  credits: "Кредиты ECTS",
  code: "Код предмета",
  codeShort: "Код",
  description: "Описание предмета",
  descriptionShort: "Описание",
  topics: "Темы курса",
  materials: "Учебные материалы (УМКД)",
  syllabus: "Силлабус",
  openPdf: "Открыть PDF",
  noPdfs: "Для этого предмета пока не зарегистрировано PDF-материалов",
  viewDocument: "Просмотреть документ",

  // Topic details
  topicLabel: "Тема: ",
  subjectPage: "Страница предмета",
  copy: "Копировать",
  copied: "Скопировано",
  copyFailed: "Не удалось скопировать",
  copyAria: "Копировать предмет и тему",
  showFull: "Показать полностью",
  noTopics: "Для этого предмета пока не добавлено тем",
  topicAdd: "Добавить тему",
  topicDeleteConfirm: "Удалить тему? Действие необратимо.",
  topicFieldWeek: "Неделя",
  topicFieldType: "Тип",
  topicFieldTitle: "Название темы",
  topicSaveHint: "Заполните неделю (≥1) и название темы",
  currentWeekLabel: "★ Текущая неделя",

  // Day tabs
  days: {
    mon: "Пн",
    tue: "Вт",
    wed: "Ср",
    thu: "Чт",
    fri: "Пт",
    sat: "Сб",
    sun: "Вс",
  },
  daysFull: {
    mon: "Понедельник",
    tue: "Вторник",
    wed: "Среда",
    thu: "Четверг",
    fri: "Пятница",
    sat: "Суббота",
    sun: "Воскресенье",
  },

  // Lesson types
  lessonTypes: {
    lecture: "Лекция",
    practice: "Практика",
    lab: "Лабораторная работа",
    srsp: "СРСП",
    srs: "СРС",
    mini_project: "Мини-проект",
    military: "Военная подготовка",
    other: "Занятие",
  },

  // Calendar
  course: "Курс",
  semester: "Семестр",
  semesterShort: "Сем",
  academicYear: "Учебный год",
  selectCourse: "Выбор курса",
  selectSemester: "Выбор семестра",
  courseNumber: (c: number): string => `${c}-курс`,
  semesterNumber: (s: number): string => `${s}-семестр`,
  courseAndSemester: (c: number, s: number): string =>
    `${c}-курс, ${s}-семестр`,
  courseShortN: (c: number): string => `${c}к`,
  semShortN: (s: number): string => `${s}сем`,
  weekShort: (n: number): string => `нед. ${n}`,
  academicWeekOf: (n: number): string => `${n}-я учебная неделя`,
  academicYearOf: (y: number): string => `${y}–${y + 1} учебный год`,
  termN: (n: number): string =>
    `${n} ${plural(n, "триместр", "триместра", "триместров")}`,
  lessonsCount: (n: number): string =>
    `${n} ${plural(n, "занятие", "занятия", "занятий")}`,
  subjectsCount: (n: number): string =>
    `${n} ${plural(n, "предмет", "предмета", "предметов")}`,
  topicsCount: (n: number): string =>
    `${n} ${plural(n, "тема", "темы", "тем")}`,
  daysN: (n: number): string => `${n} ${plural(n, "день", "дня", "дней")}`,
  courseNo: (n: number): string => `Курс №${n}`,
  noPlannedFull: (day: string): string => `На ${day} занятий не запланировано`,
  noLessonsPeriod: (name: string): string => `Занятий нет — период «${name}»`,
  daySchedule: "Расписание на день",
  examSession: "Сессия",
  midtermShort: "Рубеж",
  // Академический календарь — таймлайн семестра
  calViewMonth: "Месяц",
  calViewSemester: "Семестр",
  orientationWeek: "Ориентационная неделя",
  gradingPeriod: "Период оценивания",
  academicPeriods: "Ключевые периоды",
  semesterWeeksTitle: "Учебные недели",
  calWeeksTotal: (n: number): string => `${n} нед.`,
  calPeriodDays: (n: number): string => `${n} дн.`,
  calEmpty:
    "Академического календаря пока нет — появится после импорта расписания или календаря",
  periodNow: "Идёт сейчас",
  periodPast: "Прошло",
  months: [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ],

  // Menu & Settings
  theme: "Тема интерфейса",
  themeLight: "Светлая",
  themeDark: "Тёмная",
  themeSystem: "Системная",
  mode: "Режим работы",
  modeView: "Просмотр",
  modeEdit: "Редактирование",
  editActive: "Режим редактирования активен",
  importData: "Импорт данных",
  dataManage: "Управление данными",
  dataManageDesc:
    "Удаление импортированных расписаний, предметов и календарей — повторный импорт не создаёт дубликатов",
  dataJsonEdit: "Редактировать JSON",
  dataJsonEditDesc:
    "Правьте JSON напрямую: subject_id, названия, даты — всё. При сохранении сразу записывается в базу",
  dataDownload: "Скачать JSON",
  importDescription: "Загрузка JSON-файлов (предметы, расписание, календарь)",
  importButton: "Выбрать файлы",
  importSuccess: "Данные успешно обновлены!",
  importError: "Произошла ошибка при чтении файла",
  resetData: "Удалить все данные",
  resetConfirm:
    "БУДУТ УДАЛЕНЫ ВСЕ данные: предметы, расписания, календари, синки Canvas и Платонуса. Сначала лучше сделать экспорт. Продолжить?",
  dataSection: "Данные",
  curriculumBuilder: "Конфигуратор расписания (Curriculum Builder)",
  curriculumBuilderHint: "Внешний инструмент: создание и правка JSON-конфигов",
  exportBackup: "Экспортировать резервную копию",
  exportingLabel: "Экспортируется...",
  deletingLabel: "Удаление...",
  exportFailed: "Не удалось экспортировать данные. Попробуйте ещё раз.",
  menuFooterStats: (s: number, c: number, p: number): string =>
    `Предметы: ${s} · Canvas: ${c} · Платонус: ${p} ${plural(p, "период", "периода", "периодов")}`,
  offlinePwa: "Aristos v0.2 • Офлайн PWA",
  navAria: "Основные разделы",
  navMore: "Ещё",
  sectionGraded: "Оценённые работы",
  allCourses: "Все курсы",
  openMenu: "Открыть меню",

  // Import modal
  importNoFiles: "Не выбрано ни одного JSON-файла",
  importBadStructure: (name: string): string =>
    `${name}: структура JSON не похожа на предмет, расписание или календарь`,
  importCanvasPart: (courses: number, assignments: number): string =>
    ` Canvas: ${courses} ${plural(courses, "курс", "курса", "курсов")}, ${assignments} ${plural(assignments, "задание", "задания", "заданий")}.`,
  importPlatonusPart: (n: number): string =>
    ` Платонус: ${n} ${plural(n, "период", "периода", "периодов")}.`,
  importDone: (s: number, sc: number, cal: number, st: number): string =>
    `Импорт завершён: ${s} ${plural(s, "предмет", "предмета", "предметов")}, ${sc} ${plural(sc, "расписание", "расписания", "расписаний")}, ${cal} ${plural(cal, "календарь", "календаря", "календарей")}${st ? `, ${st} ${plural(st, "настройка", "настройки", "настроек")}` : ""}.`,
  importDoneSuffix: "Существующие данные обновлены, остальное сохранено.",
  importReadFail: "Не удалось прочитать файл",
  importErrorPrefix: (msg: string): string => `Произошла ошибка: ${msg}`,
  importDropHint: "Выберите JSON-файлы или перетащите их сюда",
  importDropKinds:
    "Предметы, schedule.json, acad_calendar.json или Canvas sync JSON",
  importingLabel: "Загрузка...",

  // PDF upload (offline, stored in IndexedDB as blobs)
  pdfUploaded: "Загруженные PDF",
  pdfUploadHint: "Файлы сохраняются только в вашем браузере и работают офлайн",
  pdfChoose: "Выбрать PDF",
  pdfUploading: "Загрузка...",
  pdfEmpty: "Загруженных PDF пока нет",
  pdfOpen: "Открыть",
  pdfDelete: "Удалить",
  pdfDeleteConfirm: "Удалить «{name}»?",
  pdfLoading: "Открываем…",
  pdfLoadError: "Не удалось открыть PDF — загрузите файл заново",
  pdfLinkSection: "Ссылки (из JSON предмета)",
  noPdfLinks: "Для этого предмета не добавлено ссылок из JSON",
  view: "Просмотр",
  openNewWindow: "Открыть в новом окне",
  openSeparatePage: "Открыть на отдельной странице",
  downloadFile: "Скачать",
  unitMb: "МБ",
  unitKb: "КБ",

  // Cloud sync (CF Worker + KV, code-based, E2E encrypted)
  cloudSync: "Облачная синхронизация",
  cloudSyncDesc:
    "Синхронизация данных с другими устройствами: по коду, с end-to-end шифрованием",
  cloudEndpoint: "URL сервера",
  cloudEndpointHint: "например https://aristos-sync.username.workers.dev",
  cloudCode: "Код синхронизации",
  cloudCodeHint: "Этот код — ваш «аккаунт». Введите его на другом устройстве",
  cloudPassphrase: "Парольная фраза (шифрование)",
  cloudPassphraseHint:
    "Сервер хранит данные только в зашифрованном виде. Если забудете фразу — прочитать данные будет невозможно",
  cloudGenerate: "Создать новый код",
  cloudPush: "Загрузить на сервер",
  cloudPull: "Забрать с сервера",
  cloudAuto: "Автосинхронизация (после синков Canvas/Платонуса)",
  cloudAutoPull: "Забирать с сервера при открытии",
  cloudLastPush: "Последняя загрузка",
  cloudLastPull: "Последнее получение",
  cloudNotConfigured: "Нужны URL сервера, код и парольная фраза",
  cloudNoData: "На сервере нет данных для этого кода",
  cloudOverwriteConfirm:
    "Версия на сервере может быть новее локальной. Перезаписать?",
  cloudPullConfirm:
    "Локальные данные будут заменены версией с сервера. Продолжить?",
  cloudGenerating: "Создаётся...",
  cloudWrongPassphrase: "Неверная парольная фраза или данные повреждены",
  cloudDone: "Готово",
  cloudError: "Произошла ошибка",
  cloudPushCancelled: "Загрузка на сервер отменена",

  // Sync toasts (extension/userscript handoff)
  syncCanvasOk: (courses: number, assignments: number): string =>
    `Canvas синхронизирован: ${courses} ${plural(courses, "курс", "курса", "курсов")}, ${assignments} ${plural(assignments, "задание", "задания", "заданий")}`,
  syncCanvasFail: "Синхронизация Canvas не удалась (localStorage)",
  syncCanvasFailShort: "Синхронизация Canvas не удалась",
  syncCanvasFailReason: (msg: string): string =>
    `Синхронизация Canvas не удалась: ${msg}`,
  syncPlatonusOk: (n: number): string =>
    `Платонус синхронизирован: ${n} ${plural(n, "период", "периода", "периодов")}`,
  syncPlatonusFail: "Синхронизация Платонуса не удалась",
  syncPlatonusFailReason: (msg: string): string =>
    `Синхронизация Платонуса не удалась: ${msg}`,
  unknownError: "неизвестная ошибка",

  // Future Sections (Stubs)
  comingSoon: "Скоро",
  underDevelopment: "В разработке",
  notes: "Заметки",
  gradesGpa: "Оценки и GPA",
  campusMap: "Карта университета",
  aiAssistant: "AI Помощник",

  // Actions
  addSubject: "Добавить предмет",
  edit: "Изменить",
  delete: "Удалить",
  save: "Сохранить",
  cancel: "Отмена",
  search: "Поиск...",
  all: "Все",
  close: "Закрыть",
  back: "Назад",

  // Subjects
  editSubject: "Изменить предмет",
  editSubjectAria: "Изменить предмет",
  deleteSubjectAria: "Удалить предмет",
  deleteSubjectConfirm: "Вы уверены, что хотите удалить этот предмет?",
  noSubjectsFound: "Предмет не найден",
  searchHint: "Измените поисковый запрос или добавьте новый предмет",
  backToSubjects: "Вернуться к списку предметов",
  moreDetails: "Подробнее",

  // Lesson edit modal
  editLesson: "Изменить занятие",
  editLessonAria: "Изменить занятие",
  deleteLessonAria: "Удалить занятие",
  subjectName: "Название предмета",
  startTime: "Начало",
  endTime: "Конец",

  // Data manage modal
  deleteScheduleConfirm: (course: string, sem: string): string =>
    `${course}, ${sem} — удалить расписание?`,
  deleteNamedConfirm: (name: string): string => `${name} — удалить?`,
  deleteCalendarConfirm: (year: string, course: string): string =>
    `${year} (${course}) — удалить календарь?`,
  clearPlatonus: "Очистить историю Платонуса",
  clearPlatonusConfirm: "Полностью очистить историю Платонуса?",
  emptyList: "Список пуст",

  // Canvas sync & deadlines
  deadlines: "Дедлайны",
  deadlinesSubtitle: "Задания, тесты и оценки Canvas",
  upcomingDeadlines: "Ближайшие дедлайны",
  viewAll: "Все",
  canvasLastSync: "Последний синк",
  canvasNeverSynced: "Синк ещё не выполнялся",
  canvasEmptyTitle: "Данных Canvas пока нет",
  canvasEmptyDesc:
    "Нажмите скрипт «Aristos Sync» на canvas.yu.edu.kz (Tampermonkey) или импортируйте JSON-файл Canvas sync",
  canvasMapping: "Привязка курсов",
  canvasMappingDescription:
    "Привяжите курсы Canvas к предметам Aristos — задания прикрепятся к нужному предмету",
  unmapped: "Не привязан",
  currentScore: "Текущий балл",
  openInCanvas: "Открыть в Canvas",
  overdue: "Просрочено",
  dueToday: "Сегодня",
  dueThisWeek: "В течение 7 дней",
  dueLater: "Позже",
  noDueDate: "Без срока",
  statusGraded: "Оценено",
  statusSubmitted: "Сдано",
  statusNotSubmitted: "Не сдано",
  statusLate: "С опозданием",
  statusMissing: "Пропущено",
  points: "баллов",
  showMore: "Показать больше",
  showLess: "Свернуть",
  gradesTitle: "Оценки",
  gradesSubtitle: "РК1, РК2, рейтинг и экзамен — по схеме университета 60/40",
  srTek1: "Ср.тек. 1",
  srTek2: "Ср.тек. 2",
  rk1: "РК 1",
  rk2: "РК 2",
  rating: "Рейтинг",
  examGrade: "Экзамен",
  ratingShort: "Р",
  examShort: "Э",
  finalComputed:
    "Итог рассчитан для предметов: {n}. Обновится, когда итоги экзаменов появятся в Canvas",
  finalComputedShort: "Итог",
  canvasTotal: "Балл Canvas",
  marksDetail: "По дням",
  marksEmpty: "Оценённых работ пока нет",
  marksUndated: "Без указанной даты",
  chartRatingTitle: "Курсы по рейтингу",
  chartRatingHint:
    "Рейтинг = (РК1 + РК2) / 2. Серым — рейтинг пока равен баллу Canvas",
  chartStatusTitle: "Статус заданий",
  chartUngraded: "Не оценено",
  advisorTitle: "AI Советник",
  advisorWeekly: "Совет недели",
  platonusHistory: "Платонус · история",
  platonusEmptyHint:
    "История пуста. В расширении нажмите «Платонус · Журнал оценок» → «Найти доступные периоды» → «Импорт выбранных» — оценки 1-2 курсов появятся здесь (нужно один раз открыть журнал).",
  platonusHistoryHint:
    "Годы соответствуют учебным курсам: 2024-2025 — 1 курс, 2025-2026 — 2 курс, 2026-2027 — 3 курс. Курс/семестр — плашка выше или Меню.",
  platonusMarksTitle: "Оценки по дням",
  platonusGridMonth: "Месяц",
  platonusGridDate: "Дата",
  platonusGridMark: "Оценка",
  gpaImportBtn: "Импорт из транскрипта",
  gpaImportHint:
    "Платонус → v7 → Транскрипт → выдели мышью таблицу «Дисциплины» → Ctrl+C → сюда Ctrl+V. Название, кредиты и итоговый % подтянутся автоматически.",
  gpaImportPlaceholder:
    "Или вставь строки руками: Название\tКредиты\t% (каждый предмет — новая строка)",
  gpaImportApply: "Импортировать",
  gpaImportClose: "Закрыть",
  gpaImportEmpty:
    "Строки не найдены — скопируй таблицу целиком (название, кредиты, %).",
  gpaImportDone: (n: number): string =>
    `Импортировано: ${n} предметов — кредиты и % в таблице`,
  confirmOk: "Да",
  confirmDelete: "Удалить",
  sidebarCollapse: "Свернуть панель",
  sidebarExpand: "Развернуть панель",
  cloudGuideTitle: "Как это работает",
  cloudGuide: [
    "Один раз: придумай код синхронизации и парольную фразу — введи их одинаково на всех устройствах. Код — это «аккаунт», фраза — ключ шифрования.",
    "Включи обе галочки: «Автосинхронизация» — после каждого синка Canvas/Платонуса данные сами летят на сервер; «Забирать с сервера при открытии» — сайт при запуске сам забирает свежие.",
    "Дальше всё автоматически: на компьютере данные уходят после синков, телефон при открытии получает свежие. Кнопки «Загрузить на сервер» / «Забрать с сервера» — для ручного контроля.",
    "Данные шифруются парольной фразой прямо на устройстве (end-to-end): сервер хранит только шифр. Забудешь фразу — восстановить данные невозможно.",
  ],
  platonusMarksEmpty:
    "Записей нет. Платонус хранит оценки по дням не для всех периодов — для старых он сам отвечает «Нет текущих оценок» (проверь кликом по предмету в журнале Платонуса). Если в журнале таблицы есть — обнови расширение и переимпортируй период.",
  platonusKindLecture: "Лекция",
  platonusKindPractice: "Практика",
  platonusKindSrsp: "СРСП",
  platonusKindOther: "Другое",
  extraTerm: "Доп. триместр",
  gradesNoCoursesForSemester:
    "Для этого курса/семестра не привязано ни одного курса Canvas — привяжите их через «Привязка курсов» на странице «Дедлайны»",
  canvasGrades: "Оценки Canvas",
  canvasComputedScoreHint:
    "≈ — вычисленная оценка (из баллов тапсырм): итог Canvas больше не отдаётся API, оценки переехали во внешний инструмент (LTI)",
  canvasPlatonusScoreHint:
    "Рейтинг допуска — из журнала Платонуса: вуз официально передаёт туда РК из LTI-тулзы",
  canvasRecentGraded: "Последние оценённые работы",
  canvasAllCourses: "Все курсы",
  outOfSemesterNote:
    "Вне семестра: в учебном календаре нет активного семестра на сегодня, поэтому учебная неделя и расписание не рассчитываются. Предметы показаны.",
  noCalendarForYear:
    "В календаре этого курса нет семестра, включающего текущую дату — добавьте файл acad_calendar.json нового учебного года",

  // GPA page
  gpaBadge: "Калькулятор",
  gpaTitle: "GPA калькулятор",
  gpaSubtitle:
    "Средневзвешенный по кредитам балл · шкала KZ 4.0 · what-if прогноз",
  gpaSubjectsDesc:
    "Кредиты и итоговый % подтягиваются из Платонуса и Canvas — значения можно править вручную.",
  reset: "Сбросить",
  gpaScaleTitle: "Шкала",
  gpaScaleDesc: "Буквенные оценки KZ 4.0 и их проценты.",
  gpaChartsTitle: "Графики",
  gpaCreditsCol: "Кредиты",
  gpaFinalCol: "Итог, %",
  gpaFinalColShort: "Итог",
  gpaLetterCol: "Буква",
  gpaForecastCol: "Прогноз, %",
  gpaForecastColShort: "Прогноз",
  gpaIncludeCol: "Расчёт",
  gpaIncludeTitle: "Включить в расчёт",
  gpaCreditsTitle: "Кредиты (ECTS)",
  gpaFinalTitle: "Итоговый процент (из Платонуса, Canvas или вручную)",
  forecastWord: "прогноз",
  goalPlaceholder: "цель",
  gpaForecastTitle: "What-if: желаемый процент для предмета без итога",
  deleteRow: "Удалить строку",
  gpaAddSubject: "Добавить предмет",
  gpaForecastHint:
    "Прогноз — желаемый % для предмета без итога; он влияет только на прогнозируемый GPA.",
  gpaCurrent: "Текущий GPA",
  gpaProjected: "Прогноз GPA",
  gpaCreditsCounted: (used: number, total: number): string =>
    `учтено ${used} из ${total} кредитов`,
  gpaFormulaNote:
    "GPA = Σ(кредиты × балл) / Σ(кредиты) · шкала KZ 4.0 · прогноз учитывает what-if проценты для предметов без итога",
  gpaPointsCol: "Балл",
  gpaMinCol: "Мин. %",
  gpaRangeCol: "Диапазон, %",
  gpaPointsFor: (l: string): string => `Балл за ${l}`,
  gpaMinFor: (l: string): string => `Минимальный процент для ${l}`,
  gpaScaleNote:
    "Изменения шкалы сохраняются локально и сразу учитываются в расчёте GPA.",

  // Charts
  chartDeadlinesByWeek: "Дедлайны по неделям",
  chartDeadlinesHint: (weeks: number, total: number): string =>
    `ближайшие ${weeks} ${plural(weeks, "неделя", "недели", "недель")} · всего ${total}`,
  chartDeadlinesEmpty: (weeks: number): string =>
    `нет работ с дедлайнами в ближайшие ${weeks} ${plural(weeks, "неделя", "недели", "недель")}`,
  chartNoDueItems: "Нет назначений с датой сдачи",
  chartWeekRange: (range: string): string => `Неделя ${range}`,
  chartTotal: "Всего",
  chartSubmitted: "Сдано",
  chartDynamicsTitle: "Динамика среднего балла",
  chartDynamicsHint: (n: number): string =>
    `накопленное среднее по ${n} ${plural(n, "оценённой работе", "оценённым работам", "оценённым работам")}, все курсы вместе`,
  chartNoGraded: "нет оценённых работ",
  chartNoGradedYet: "Оценённых работ пока нет",
  chartWorkNo: (n: number): string => `работа №${n}`,
  chartForWork: "За работу: ",
  chartAverage: "Средний: ",
  chartAvgScore: "Средний балл",
  chartRkTitle: "РК1 vs РК2",
  chartRkHint: "рубежные контроли по курсам, %",
  chartNoRkData: "Нет данных по рубежным контролям",

  itemTypes: {
    assignment: "Задание",
    quiz: "Тест",
    discussion: "Обсуждение",
    other: "Задание",
  },
}
