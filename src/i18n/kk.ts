/**
 * Казахская база словаря — единый источник формы Dict.
 * The runtime export `kk` (a Proxy that always returns strings of the CURRENT
 * language) lives in ./index.ts; import it from '@/i18n'.
 *
 * Template functions must be annotated with `: string` so that ru.ts can
 * return differently shaped strings (e.g. «нед. 3» vs «3-апта»).
 */
export const kkBase = {
  appName: "Aristos",
  appSubtitle: "Студенттік дашборд",

  // Navigation
  home: "Басты бет",
  calendar: "Күнтізбе",
  subjects: "Пәндер",
  menu: "Мәзір",

  // Language
  language: "Тіл",
  langKk: "KK",
  langRu: "RU",

  // Home Status
  today: "Бүгін",
  lesson: "Сабақ",
  breakTime: "Үзіліс",
  beforeStart: "Күн басталмады",
  minutesLeft: "қалды",
  minutesUntilNext: "минуттан кейін келесі сабақ",
  freeDay: "Бос күн",
  dayEnded: "Бүгінгі сабақтар аяқталды",
  holiday: "Демалыс (Каникул)",
  exam: "Емтихан сессиясы",
  midterm: "Рубеждік бақылау",
  practice: "Практика кезеңі",
  week: "апта",
  weekProgress: "Оқу аптасының барысы",
  noLessonsToday: "Бұл күні сабақ жоқ",
  currentLesson: "Қазіргі сабақ",
  upcomingLesson: "Келесі сабақ",
  nowBadge: "Қазір",
  nextBadge: "Келесі",
  statusInClass: "Сабақ жүріп жатыр",
  holidayPeriod: "Демалыс кезеңі",
  holidayName: "Демалыс",
  practiceName: "Практика",
  outOfSemester: "Семестрден тыс уақыт",
  outOfSemesterDesc: "Бұл күнге оқу кестесі тағайындалмаған.",
  holidayDesc: "Демалыс күндері. Жақсылап демалыңыз!",
  examDesc: "Емтихан кезеңі. Сәттілік тілейміз!",
  dayEndedDesc: "Бүгінгі сабақ кестесі толық аяқталды.",
  freeDayDesc: "Бүгінге жоспарланған сабақтар жоқ.",
  unitHour: "сағ",
  unitMin: "мин",

  // Home page
  homeBadge: "Aristos · Студенттік кеңістік",
  homeTitle: "Оқу күніңізге шолу",
  weeklySchedule: "Апталық кесте",
  // Редактор раскладки главной (режим редактирования)
  homeLayout: "Басты бет сұлбасы",
  homeLayoutHint:
    "Блоктарды жылжытыңыз, баған ауыстырыңыз немесе жасырыңыз — сұлба құрылғыда сақталады",
  homeLayoutReset: "Сұлбаны қалпына келтіру",
  homeBlockHidden: "Жасырылған блоктар",
  homeBlockShow: "Көрсету",
  homeBlockHide: "Жасыру",
  homeBlockDrag: "Сүйреу — блокты басқа жерге апару",
  homeBlockMoveUp: "Жоғары",
  homeBlockMoveDown: "Төмен",
  homeBlockMoveColumn: "Басқа бағанға",
  homeBlocks: {
    status: "Қазіргі күй",
    week: "Оқу аптасы",
    schedule: "Апталық кесте",
    tomorrow: "Ертеңгі кесте",
    deadlines: "Жақын мерзімдер",
    advice: "Апта кеңесі",
    radar: "Пәндер радары",
    gpa: "GPA",
    notes: "Жазбалар",
  },
  gpaMiniOpen: "Калькулятор",
  gpaMiniEmpty: "Пәндер жоқ — GPA-калькуляторда толтырыңыз",
  gpaMiniCredits: (n: number): string => `${n} кредит есепке алынды`,
  tomorrowSchedule: "Ертеңгі кесте",
  tomorrowEmpty: "Ертең сабақ жоқ",
  notesTitle: "Жазбалар",
  notesPlaceholder: "Істер, сілтемелер, жеке ескертпелер…",
  notesEmptyHint: "Әзірше бос — жазып қойыңыз",
  // Пресеты цветовых схем
  themePreset: "Стиль",
  advSection: "Стильдер және теңшеу",
  userCssHooksTitle: "CSS-хуктар (таңдауыштар)",
  userCssTitle: "Свой CSS",
  userCssPlaceholder: "/* өз CSS — бәрінен үстіңгі қабат */",
  userCssHint:
    "Моддерлерге арналған: CSS барлық нәрсенің үстінен қолданылады. Қатесе — вёрстканы бұзуы мүмкін.",
  userCssReset: "Тазалау",
  presetMonolith: "Монолит",
  presetCobalt: "Кобальт",
  presetDeck: "Дека",
  notifSection: "Дербіліктер",
  notifAllow: "Дербіліктерге рұқсат беру",
  notifLessons: "Сабақтың басталуы",
  notifDeadlines: "Мерзімдер жақындады",
  notifBlocked: "Браузерде бұғатталған — сайт параметрлерінен қосыңыз",
  notifUnsupported: "Браузер дербіліктерді қолдамайды",
  notifLessonTitle: "Сабақ жақында",
  notifDeadlineTitle: "Мерзім жақындады",
  notifBefore: "Пән басталар алдында",
  notifMinutesShort: "мин",
  notifDigest: "Күн жоспары (таңертең)",
  notifDigestTitle: (n: number): string => `Бүгін ${n} сабақ`,
  notifDigestFirst: (t: string): string => `Бірінші сабақ — ${t}`,
  notifNativeHint:
    "Телефонда еске салғыштар жабық кезінде де жұмыс істейді",
  widgetToday: "Бүгін",
  widgetTomorrow: "Ертең",
  widgetSchedule: "Кесте",
  widgetDeadlines: "Мерзімдер",
  widgetEmpty: "Деректер жоқ — қосымшаны ашыңыз",
  widgetNoDeadlines: "Жақын мерзімдер жоқ",
  syncSection: "Синктеу (қосымшадан)",
  syncNativeHint:
    "Деректер тікелей жанды сессиядан алынады — браузер кеңейтімі қажет емес",
  syncCanvasBtn: "Canvas синктeу",
  syncPlatonusDiscover: "Кезеңдерді табу",
  syncPlatonusImport: "Таңдалғандарды импорттау",
  syncPeriodsFound: (n: number): string => `Кезеңдер табылды: ${n}`,
  syncStageCanvasCourses: "Canvas: курстар...",
  syncStageCanvasAssignments: "Canvas: тапсырмалар...",
  syncStageLogin: "Кіру терезесі ашық — кіріңіз...",
  syncStageApply: "Қолданылуда...",
  syncStagePlatonusPeriod: (i: number, total: number, y: number, t: number): string =>
    `Платонус: ${y}/${t} (${i}/${total})...`,
  syncStagePlatonusMarks: (y: number, t: number, i: number, n: number): string =>
    `Платонус: ${y}/${t} — бағалар ${i}/${n}...`,
  syncLoginTimeout: "Кіру уақыты өтті — қайта көріңіз",
  syncAlreadyRunning: "Синк өтіп жатыр — күтіңіз",
  syncTimeout: "Синк уақыты өтті",
  syncPlatonusNoPeriods:
    "Кезеңдер табылмады — Платонусқа кіріп, «Журнал» бөлімін бір рет ашыңыз",
  syncPlatonusEmpty: "Барлық таңдалған кезеңдерде журнал бос",
    syncWarnScoresMissing: "балдар жүктелмеді — Canvas-синкті қайталаңыз",
syncFailRaw: (msg: string): string => `Синк қатесі: ${msg}`,
  updateSection: "Жаңарту",
  updateVersion: "Нұсқа",
  updateAvailable: "Жаңа нұсқа қолжетімді: {v}",
  updateInstallBtn: "Жаңарту және қайта қосу",
  updateDownloadApk: "APK жүктеп алу",
  updateDownloading: "Жүктелуде…",
  updateDownloadHint: "APK орнатқышы ашылды — орнатуды растаңыз",
  updatePermHint: "Ашылған баптауларда орнатуға рұқсат беріңіз де, қайталап көріңіз",
  updateBrowserHint: "APK браузерде жүктелді — файлды ашып, орнатыңыз",
  updateInstalling: "Жаңартылуда...",
  updateUpToDate: "Соңғы нұсқа орнатылған",
  updateCheckBtn: "Жаңартуларды тексеру",
  updateFail: "Жаңарту сәтсіз — қайта көріңіз",
  presetAristos: "Стандарт",
  presetOcean: "Мұхит",
  presetForest: "Орман",
  presetSunset: "Күн батысы",
  presetGlass: "Стекло (тәжірибе)",

  // Radar widget
  radarTitle: "Пәндер радары",
  radarEmpty: "Бағалар жеткіліксіз — радарға кемінде 3 пән керек",
  radarHint: "Canvas курстарының ағымдағы баллы, 0–100",

  // Local (data-driven) advice fallback
  adviceLocalBadge: "Автокеңес",
  adviceLocalNote:
    "Жергілікті кеңес: деректерден есептелді. AI кілті әзірленбеген.",
  adviceNearest: "Жақын мерзім",
  adviceMissing: "Орындалмаған тапсырмалар",
  adviceWeakest: "Ең төмен курс",
  adviceRk: "Рубежтік бақылау",
  adviceToday: "Бүгін",

  // Advisor chat history
  chatNew: "Жаңа чат",
  chatHistory: "Чат тарихы",
  chatDelete: "Чатты өшіру",
  chatUntitled: "Атаусыз чат",
  chatEmptyHistory: "Диалог тарихы бос",
  chatEmptyHistoryDesc: "Академиялық кеңесшіден сұрақ қойып, жаңа чат бастаңыз",
  chatClearAll: "Тарихты тазалау",
  chatClearAllConfirm: "Барлық чаттар тарихын өшіру керек пе?",
  chatMessagesCount: (n: number): string => `${n} хабарлама`,
  chatActiveBadge: "Белсенді",
  cloudSyncSummary: (s: {
    subjects: number
    schedules: number
    calendars: number
    canvasCourses: number
    canvasAssignments: number
    platonus: number
    activeCourse: number
  }): string =>
    `Пәндер: ${s.subjects} · Кестелер: ${s.schedules} · Күнтізбелер: ${s.calendars} · Canvas: ${s.canvasCourses} курс / ${s.canvasAssignments} тапсырма · Платонус: ${s.platonus} кезең · Белсенді курс: ${s.activeCourse}`,

  // AI advisor
  advisorSubtitle: "Үлгерімді талдау, what-if, стратегия",
  aiConnected: "Қосылған",
  aiNotConfigured: "Бапталмаған",
  aiSettings: "Настройки AI",
  aiAskTitle: "Не сұраймыз:",
  aiExample1: "«Менің әлсіз тұстарым неде және нені жетілдіру керек?»",
  aiExample2:
    "«Егер Мәліметтер қоры пәнін 95-ке көтерсем — рейтинг қаншалықты өсер еді?»",
  aiExample3: "«Осы аптада неге басымдық беру керек?»",
  youLabel: "Сен",
  aiThinking: "AI ойлануда...",
  aiAnalyzing: "Деректерді талдау...",
  aiPlaceholder: "Кез келген нәрсені сұра...",
  aiPlaceholderSetup: "AI бапта (⚙) және деректерді синкта",
  aiProvider: "Провайдер",
  aiProviderOpenaiCompat: "OpenAI-үйлесімді (omniroute, api.openai.com...)",
  aiModelHint: "Model (flash-lite = арзан лимиттер)",
  refresh: "Жаңарту",

  // Details
  room: "Аудитория",
  teacher: "Оқытушы",
  contact: "Байланыс",
  phone: "Телефон",
  email: "Email",
  credits: "ECTS кредиттері",
  code: "Пән коды",
  codeShort: "Код",
  description: "Пән туралы сипаттама",
  descriptionShort: "Сипаттамасы",
  topics: "Оқу тақырыптары",
  materials: "Оқу материалдары (УМКД)",
  syllabus: "Силлабус",
  openPdf: "PDF ашу",
  noPdfs: "Бұл пәнге әзірге PDF материалдары тіркелмеген",
  viewDocument: "Құжатты көру",

  // Topic details
  topicLabel: "Тақырып: ",
  subjectPage: "Пән беті",
  copy: "Көшіру",
  copied: "Көшірілді",
  copyFailed: "Көшіру мүмкін болмады",
  copyAria: "Пән мен тақырыпты көшіру",
  showFull: "Толық көрсету",
  noTopics: "Бұл пәнге әзірге тақырыптар қосылмаған",
  topicAdd: "Тақырып қосу",
  topicDeleteConfirm: "Тақырыпты өшіру? Әрекетті болдырмауға болмайды.",
  topicFieldWeek: "Апта",
  topicFieldType: "Түрі",
  topicFieldTitle: "Тақырып атауы",
  topicSaveHint: "Апта (≥1) және тақырып атауы толтырылуы керек",
  currentWeekLabel: "★ Ағымдағы апта",

  // Day tabs
  days: {
    mon: "Дс",
    tue: "Сс",
    wed: "Ср",
    thu: "Бс",
    fri: "Жм",
    sat: "Сн",
    sun: "Жс",
  },
  daysFull: {
    mon: "Дүйсенбі",
    tue: "Сейсенбі",
    wed: "Сәрсенбі",
    thu: "Бейсенбі",
    fri: "Жұма",
    sat: "Сенбі",
    sun: "Жексенбі",
  },

  // Lesson types
  lessonTypes: {
    lecture: "Дәріс",
    practice: "Практика",
    lab: "Зертханалық жұмыс",
    srsp: "ОБСӨЖ",
    srs: "БСӨЖ",
    mini_project: "Шағын жоба",
    military: "Әскери дайындық",
    other: "Сабақ",
  },

  // Calendar
  course: "Курс",
  semester: "Семестр",
  semesterShort: "Сем",
  academicYear: "Оқу жылы",
  selectCourse: "Курсты таңдау",
  selectSemester: "Семестрді таңдау",
  courseNumber: (c: number): string => `${c}-курс`,
  semesterNumber: (s: number): string => `${s}-семестр`,
  courseAndSemester: (c: number, s: number): string =>
    `${c}-курс, ${s}-семестр`,
  courseShortN: (c: number): string => `${c}-к`,
  semShortN: (s: number): string => `${s}-сем`,
  weekShort: (n: number): string => `${n}-апта`,
  academicWeekOf: (n: number): string => `${n}-оқу аптасы`,
  academicYearOf: (y: number): string => `${y}-${y + 1} оқу жылы`,
  termN: (n: number): string => `${n} термин`,
  lessonsCount: (n: number): string => `${n} сабақ`,
  subjectsCount: (n: number): string => `${n} пән`,
  topicsCount: (n: number): string => `${n} тақырып`,
  daysN: (n: number): string => `${n} күн`,
  courseNo: (n: number): string => `Курс #${n}`,
  noPlannedFull: (day: string): string => `${day} күніне сабақ жоспарланбаған`,
  noLessonsPeriod: (name: string): string =>
    `${name} кезеңіне байланысты сабақ жоқ`,
  daySchedule: "Күндізгі кесте",
  examSession: "Сессия",
  midtermShort: "Рубеж",
  // Академиялық күнтізбе — семестр таймлайны
  calViewMonth: "Ай",
  calViewSemester: "Семестр",
  orientationWeek: "Ориентирлеу аптасы",
  gradingPeriod: "Бағалау кезеңі",
  academicPeriods: "Кезеңдер",
  semesterWeeksTitle: "Оқу апталыры",
  calWeeksTotal: (n: number): string => `${n} апта`,
  calPeriodDays: (n: number): string => `${n} күн`,
  calEmpty:
    "Академиялық күнтізбе әзірше жоқ — кесте немесе күнтізбе импортталса пайда болады",
  periodNow: "Жүріп тұр",
  periodPast: "Өтті",
  months: [
    "Қаңтар",
    "Ақпан",
    "Наурыз",
    "Сәуір",
    "Мамыр",
    "Маусым",
    "Шілде",
    "Тамыз",
    "Қыркүйек",
    "Қазан",
    "Қараша",
    "Желтоқсан",
  ],

  // Menu & Settings
  theme: "Интерфейс тақырыбы",
  themeLight: "Жарық",
  themeDark: "Қараңғы",
  themeSystem: "Жүйелік",
  mode: "Жұмыс режимі",
  modeView: "Көру",
  modeEdit: "Өңдеу",
  editActive: "Өңдеу режимі белсенді",
  importData: "Деректерді импорттау",
  dataManage: "Деректерді басқару",
  dataManageDesc:
    "Импортталған кестелерді, пәндерді және күнтізбелерді өшіру — қайта импорттау дубликат жасамайды",
  dataJsonEdit: "JSON өңдеу",
  dataJsonEditDesc:
    "JSON-ды тікелей өңдеңіз: subject_id, аттар, күндер — бәрі. Сақтағанда бірден базаға жазылады",
  dataDownload: "JSON жүктеу",
  importDescription: "JSON файлдарын (пәндер, кестелер, күнтізбелер) жүктеу",
  importButton: "Файлдарды таңдау",
  importSuccess: "Деректер сәтті жаңартылды!",
  importError: "Файлды оқу кезінде қате орын алды",
  resetData: "Барлық деректерді өшіру",
  resetConfirm:
    "БАРЛЫҚ деректер өшіріледі: пәндер, кестелер, күнтізбелер, Canvas және Платонус синктері. Алдымен экспорт жасаған дұрыс. Жалғастыру ма?",
  dataSection: "Деректер",
  curriculumBuilder: "Кесте конфигураторы (Curriculum Builder)",
  curriculumBuilderHint: "Сыртқы құрал: JSON конфигтерді жасау/түзету",
  exportBackup: "Сақтық көшірмені экспорттау",
  exportingLabel: "Экспортталуда...",
  deletingLabel: "Өшірілуде...",
  exportFailed: "Деректерді экспорттау мүмкін болмады. Қайталап көріңіз.",
  menuFooterStats: (s: number, c: number, p: number): string =>
    `Пәндер: ${s} · Canvas: ${c} · Платонус: ${p} кезең`,
  offlinePwa: "Aristos v0.2 • Офлайн PWA",
  navAria: "Негізгі бөлімдер",
  navMore: "Көбірек",
  sectionGraded: "Бағаланған жұмыстар",
  allCourses: "Барлық курстар",
  openMenu: "Мәзірді ашу",

  // Import modal
  importNoFiles: "JSON файлдары таңдалмады",
  importBadStructure: (name: string): string =>
    `${name}: JSON құрылымы пәнге, кестеге немесе күнтізбеге сәйкес емес`,
  importCanvasPart: (courses: number, assignments: number): string =>
    ` Canvas: ${courses} курс, ${assignments} тапсырма.`,
  importPlatonusPart: (n: number): string => ` Платонус: ${n} кезең.`,
  importDone: (s: number, sc: number, cal: number, st: number): string =>
    `Импорт аяқталды: ${s} пән, ${sc} кесте, ${cal} күнтізбе${st ? `, ${st} баптау` : ""}.`,
  importDoneSuffix: "Бар деректер жаңартылды, басқалары сақталды.",
  importReadFail: "Файлды оқу мүмкін болмады",
  importErrorPrefix: (msg: string): string => `Қате орын алды: ${msg}`,
  importDropHint: "JSON файлдарын таңдаңыз немесе осында сүйреңіз",
  importDropKinds:
    "Пәндер, schedule.json, acad_calendar.json немесе Canvas sync JSON",
  importingLabel: "Жүктелуде...",

  // PDF upload (offline, stored in IndexedDB as blobs)
  pdfUploaded: "Жүктелген PDF",
  pdfUploadHint:
    "Файлдар тек сіздің браузеріңізде сақталады және оффлайн жұмыс істейді",
  pdfChoose: "PDF таңдау",
  pdfUploading: "Жүктелуде...",
  pdfEmpty: "Жүктелген PDF жоқ",
  pdfOpen: "Ашу",
  pdfDelete: "Өшіру",
  pdfDeleteConfirm: "«{name}» өшіру ма?",
  pdfLoading: "Ашылуда…",
  pdfLoadError: "PDF ашылмады — файлды қайта жүктеңіз",
  pdfLinkSection: "Сілтемелер (пән JSON-ынан)",
  noPdfLinks: "Бұл пәнге JSON-нан сілтеме қосылмаған",
  view: "Қарау",
  openNewWindow: "Жаңа терезеде ашу",
  openSeparatePage: "Жеке бетте ашу",
  downloadFile: "Жүктеп алу",
  unitMb: "МБ",
  unitKb: "КБ",

  // Cloud sync (CF Worker + KV, code-based, E2E encrypted)
  cloudSync: "Бұлттық синхрондау",
  cloudSyncDesc:
    "Деректерді басқа құрылғылармен синхрондау: код арқылы, end-to-end шифрлеумен",
  cloudEndpoint: "Сервер URL",
  cloudEndpointHint: "мысалы https://aristos-sync.username.workers.dev",
  cloudCode: "Синхрондау коды",
  cloudCodeHint:
    "Осы код — сіздің «аккаунтыңыз». Оны басқа құрылғыда енгізіңіз",
  cloudPassphrase: "Құпия сөз (шифрлеу)",
  cloudPassphraseHint:
    "Сервер тек шифрланген күйінде сақтайды. Құпия сөзді ұмытсаңыз — деректерді оқу мүмкін емес",
  cloudGenerate: "Жаңа код жасау",
  cloudPush: "Серверге жүктеу",
  cloudPull: "Серверден жүктеу",
  cloudAuto: "Авто-синхрондау (Canvas/Платонус синктерінен кейін)",
  cloudAutoPull: "Ашылғанда серверден тарту",
  cloudLastPush: "Соңғы жүктеу",
  cloudLastPull: "Соңғы тарту",
  cloudNotConfigured: "Сервер URL, код және құпия сөз қажет",
  cloudNoData: "Серверде бұл код бойынша деректер жоқ",
  cloudOverwriteConfirm:
    "Сервердегі нұсқа жергіліктіден жаңарақ болуы мүмкін. Үстінен жазу ма?",
  cloudPullConfirm:
    "Жергілікті деректер сервердегі нұсқамен алмастырылады. Жалғастыру ма?",
  cloudGenerating: "Жасалуда...",
  cloudWrongPassphrase: "Құпия сөз дұрыс емес немесе деректер зақымдалған",
  cloudDone: "Дайын",
  cloudError: "Қате орын алды",
  cloudPushCancelled: "Серверге жүктеу тоқтатылды",

  // Sync toasts (extension/userscript handoff)
  syncCanvasOk: (courses: number, assignments: number): string =>
    `Canvas синктелді: ${courses} курс, ${assignments} тапсырма`,
  syncCanvasFail: "Canvas синкі сәтсіз (localStorage)",
  syncCanvasFailShort: "Canvas синкі сәтсіз",
  syncCanvasFailReason: (msg: string): string => `Canvas синкі сәтсіз: ${msg}`,
  syncPlatonusOk: (n: number): string => `Платонус синктелді: ${n} кезең`,
  syncPlatonusFail: "Платонус синкі сәтсіз",
  syncPlatonusFailReason: (msg: string): string =>
    `Платонус синкі сәтсіз: ${msg}`,
  unknownError: "белгісіз қате",

  // Future Sections (Stubs)
  comingSoon: "Жақында",
  underDevelopment: "Әзірлену үстінде",
  notes: "Жазбалар",
  gradesGpa: "Бағалар және GPA",
  campusMap: "Университет картасы",
  aiAssistant: "AI Көмекші",

  // Actions
  addSubject: "Жаңа пән қосу",
  edit: "Өңдеу",
  delete: "Жою",
  save: "Сақтау",
  cancel: "Бас тарту",
  search: "Іздеу...",
  all: "Барлығы",
  close: "Жабу",
  back: "Артқа",

  // Subjects
  editSubject: "Пәнді өңдеу",
  editSubjectAria: "Пәнді өңдеу",
  deleteSubjectAria: "Пәнді жою",
  deleteSubjectConfirm: "Пәнді өшіруге сенімдісіз бе?",
  noSubjectsFound: "Пән табылмады",
  searchHint: "Іздеу сұрауын өзгертіп көріңіз немесе жаңа пән қосыңыз",
  backToSubjects: "Пәндер тізіміне қайту",
  moreDetails: "Толығырақ",

  // Lesson edit modal
  editLesson: "Сабақты өңдеу",
  editLessonAria: "Сабақты өңдеу",
  deleteLessonAria: "Сабақты жою",
  subjectName: "Пән атауы",
  startTime: "Басталуы",
  endTime: "Аяқталуы",

  // Data manage modal
  deleteScheduleConfirm: (course: string, sem: string): string =>
    `${course}, ${sem} — кестені өшіру?`,
  deleteNamedConfirm: (name: string): string => `${name} — өшіру?`,
  deleteCalendarConfirm: (year: string, course: string): string =>
    `${year} (${course}) — күнтізбені өшіру?`,
  clearPlatonus: "Платонус тарихын өшіру",
  clearPlatonusConfirm: "Платонус тарихын толық өшіру?",
  emptyList: "Тізім бос",

  // Canvas sync & deadlines
  deadlines: "Мерзімдер",
  deadlinesSubtitle: "Canvas тапсырмалары, тесттері және бағалары",
  upcomingDeadlines: "Жақын мерзімдер",
  viewAll: "Барлығы",
  canvasLastSync: "Соңғы синк",
  canvasNeverSynced: "Әлі синк жасалмады",
  canvasEmptyTitle: "Canvas деректері әзірге жоқ",
  canvasEmptyDesc:
    "canvas.yu.edu.kz сайтында «Aristos Sync» скриптісін басыңыз (Tampermonkey) немесе Canvas sync JSON файлын импорттаңыз",
  canvasMapping: "Курстарды байланыстыру",
  canvasMappingDescription:
    "Canvas курстарын Aristos пәндерімен байланыстырыңыз — тапсырмалар дұрыс пәнге жабыстырылады",
  unmapped: "Байланыстырылмаған",
  currentScore: "Ағымдағы балл",
  openInCanvas: "Canvas-та ашу",
  overdue: "Мерзімі өтті",
  dueToday: "Бүгін",
  dueThisWeek: "Келесі 7 күнде",
  dueLater: "Кейінірек",
  noDueDate: "Мерзімсіз",
  statusGraded: "Бағаланды",
  statusSubmitted: "Тапсырылды",
  statusNotSubmitted: "Тапсырылмаған",
  statusLate: "Кешіктірілді",
  statusMissing: "Жіберілді",
  points: "балл",
  showMore: "Көбірек көрсету",
  showLess: "Жасыру",
  gradesTitle: "Бағалар",
  gradesSubtitle:
    "РК1, РК2, рейтинг және емтихан — университеттің 60/40 схемасы бойынша",
  srTek1: "Ср.тек. 1",
  srTek2: "Ср.тек. 2",
  rk1: "РК 1",
  rk2: "РК 2",
  rating: "Рейтинг",
  examGrade: "Емтихан",
  ratingShort: "Р",
  examShort: "Э",
  finalComputed:
    "Қорытынды есептелген пәндер: {n}. Емтихан қорытысы Canvas-та пайда болғанда жаңарады",
  finalComputedShort: "Қорытынды",
  canvasTotal: "Canvas баллы",
  marksDetail: "Күндер бойынша",
  marksEmpty: "Әзірге бағаланған жұмыс жоқ",
  marksUndated: "Күні көрсетілмеген",
  chartRatingTitle: "Рейтинг бойынша курс",
  chartRatingHint:
    "Рейтинг = (РК1 + РК2) / 2. Сұр — Рейтинг әзірге Canvas баллы",
  chartStatusTitle: "Тапсырмалар күйі",
  chartUngraded: "Бағаланбаған",
  advisorTitle: "AI Кеңесші",
  advisorWeekly: "Апталық кеңес",
  platonusHistory: "Платонус · тарих",
  platonusEmptyHint:
    "Тарих бос. Кеңейтімде «Платонус · Журнал оценок» → «Найти доступные периоды» → «Импорт выбранных» батырмаларын бас — 1-2 курс бағалары осында түседі (журналға бір рет кіру керек).",
  platonusHistoryHint:
    "Жылдар оқу курс бойынша: 2024-2025 — 1 курс, 2025-2026 — 2 курс, 2026-2027 — 3 курс. Курс/семестр — жоғарыдағы плашкадан немесе Мәзірден.",
  platonusMarksTitle: "Күнделікті бағалар",
  platonusGridMonth: "Ай",
  platonusGridDate: "Күні",
  platonusGridMark: "Баға",
  gpaImportBtn: "Транскрипттен импорт",
  gpaImportHint:
    "Платонус → v7 → Транскрипт → тышқанмен «Дисциплины» кестесін белгіле → Ctrl+C → осында Ctrl+V. Аты, кредиттер және қорытынды % автоматты толады.",
  gpaImportPlaceholder:
    "Немесе жолдарды қолмен қой: Атауы\tКредит\t% (әр пән — жаңа жол)",
  gpaImportApply: "Импорттау",
  gpaImportClose: "Жабу",
  gpaImportEmpty:
    "Жолдар табылмады — кестені толық белгілеп көшіріңіз (аты, кредиттер, %).",
  gpaImportDone: (n: number): string =>
    `Импортталды: ${n} пән — кредиттер мен % кестеде`,
  confirmOk: "Иә",
  confirmDelete: "Жою",
  sidebarCollapse: "Панельді жию",
  sidebarExpand: "Панельді ашу",
  cloudGuideTitle: "Қалай жұмыс істейді",
  cloudGuide: [
    "Бір рет: код синхрондау және парольдік фраза ойлап тап — оларды барлық құрылғыларда бірдей енгіз. Код — бұл «аккаунт», фраза — шифрлау кілті.",
    "Екі құсбелгіні қос: «Автосинхронизация» — әр Canvas/Платонус синкінің кейін деректер серверге өзі барады; «Забирать с сервера при открытии» — сайт ашылғанда деректер өзі жүктеледі.",
    "Әрі қарай бәрі автоматты: компьютерде деректер синктерден кейін ұшады, телефон ашылғанда жаңасын алады. «Загрузить на сервер» / «Забрать с сервера» батырмалары — қолмен басқару үшін.",
    "Деректер құрылғыда парольдік фразамен шифрланады (end-to-end): сервер тек шифрды көреді. Фразаны ұмытсаң — деректерді қайтару мүмкін емес.",
  ],
  platonusMarksEmpty:
    "Жазбалар жоқ. Платонус күнделікті бағаларды әр кезең үшін сақтамайды — ескі кезеңдерге өзі «Нет текущих оценок» деп жауап береді (Платонус журналында пәнді басып тексеріңіз). Журналда кестелер болса — кеңейтімді жаңартып, кезеңді қайта импорттаңыз.",
  platonusKindLecture: "Лекция",
  platonusKindPractice: "Практика",
  platonusKindSrsp: "СРСП",
  platonusKindOther: "Басқа",
  extraTerm: "Қосымша термин",
  gradesNoCoursesForSemester:
    "Осы курс/семестрге байланыстырылған Canvas курстары жоқ — «Мерзімдер» бетіндегі «Курстарды байланыстыру» арқылы байланыстырыңыз",
  canvasGrades: "Canvas бағалары",
  canvasComputedScoreHint:
    "≈ — есептелген баға (тапсырмалар балдарынан): Canvas қорытындысы енді API-де берілмейді, бағалар сыртқы құралға (LTI) көшті",
  canvasPlatonusScoreHint:
    "Рейтинг допуска — Платонус журналынан: вуз РК мәндерін LTI құралдан Платонусқа ресми түрде жібереді",
  canvasRecentGraded: "Соңғы бағаланған жұмыстар",
  canvasAllCourses: "Барлық курстар",
  outOfSemesterNote:
    "Семестрден тыс уақыт: оқу күнтізбесінде бүгін белсенді семестр жоқ, сондықтан оқу аптасы мен кесте есептелмейді. Пәндер көрсетілген.",
  noCalendarForYear:
    "Осы курсқа арналған күнтізбеде ағымдағы күнді қамтитын семестр жоқ — жаңа оқу жылының acad_calendar.json файлын қосыңыз",

  // GPA page
  gpaBadge: "Калькулятор",
  gpaTitle: "GPA калькулятор",
  gpaSubtitle:
    "Кредиттерге өлшенген орташа балл · KZ 4.0 шкаласы · what-if болжам",
  gpaSubjectsDesc:
    "Кредиттер мен қорытынды % Платонус пен Canvas-тан алынады — мәндерді қолмен түзетуге болады.",
  reset: "Қалпына келтіру",
  gpaScaleTitle: "Шкала",
  gpaScaleDesc: "KZ 4.0 әріптік бағалары және олардың пайыздары.",
  gpaChartsTitle: "Графиктер",
  gpaCreditsCol: "Кредиттер",
  gpaFinalCol: "Қорытынды, %",
  gpaFinalColShort: "Қорытынды",
  gpaLetterCol: "Әріп",
  gpaForecastCol: "Болжам, %",
  gpaForecastColShort: "Болжам",
  gpaIncludeCol: "Есеп",
  gpaIncludeTitle: "Есепке қосу",
  gpaCreditsTitle: "Кредиттер (ECTS)",
  gpaFinalTitle: "Қорытынды пайыз (Платонус, Canvas немесе қолмен)",
  forecastWord: "болжам",
  goalPlaceholder: "мақсат",
  gpaForecastTitle: "What-if: қорытындысы жоқ пәнге қалаған пайыз",
  deleteRow: "Жолды өшіру",
  gpaAddSubject: "Пән қосу",
  gpaForecastHint:
    "Болжам — қорытындысы жоқ пәнге қалаған %; тек болжамды GPA-ға әсер етеді.",
  gpaCurrent: "Ағымдағы GPA",
  gpaProjected: "GPA болжамы",
  gpaCreditsCounted: (used: number, total: number): string =>
    `есепке алынды ${used}/${total} кредит`,
  gpaFormulaNote:
    "GPA = Σ(кредит × балл) / Σ(кредит) · KZ 4.0 шкаласы · болжам қорытындысыз пәндердің what-if пайыздарын ескереді",
  gpaPointsCol: "Балл",
  gpaMinCol: "Мин. %",
  gpaRangeCol: "Ауқым, %",
  gpaPointsFor: (l: string): string => `${l} әріпі үшін балл`,
  gpaMinFor: (l: string): string => `${l} үшін минималды пайыз`,
  gpaScaleNote:
    "Шкала өзгерістері жергілікті сақталады және GPA есебіне бірден қосылады.",

  // Charts
  chartDeadlinesByWeek: "Апталар бойынша мерзімдер",
  chartDeadlinesHint: (weeks: number, total: number): string =>
    `алдағы ${weeks} апта · барлығы ${total}`,
  chartDeadlinesEmpty: (weeks: number): string =>
    `алдағы ${weeks} аптада мерзімі бар жұмыс жоқ`,
  chartNoDueItems: "Мерзімі бар тапсырма жоқ",
  chartWeekRange: (range: string): string => `Апта ${range}`,
  chartTotal: "Барлығы",
  chartSubmitted: "Тапсырылды",
  chartDynamicsTitle: "Орташа балл динамикасы",
  chartDynamicsHint: (n: number): string =>
    `${n} бағаланған жұмыс бойынша жинақталған орташа, барлық курстар бірге`,
  chartNoGraded: "Бағаланған жұмыс жоқ",
  chartNoGradedYet: "Бағаланған жұмыстар әзірге жоқ",
  chartWorkNo: (n: number): string => `жұмыс №${n}`,
  chartForWork: "Жұмыс үшін: ",
  chartAverage: "Орташа: ",
  chartAvgScore: "Орташа балл",
  chartRkTitle: "РК1 vs РК2",
  chartRkHint: "курстар бойынша рубежтік бақылаулар, %",
  chartNoRkData: "Рубежтік бақылаулар бойынша деректер жоқ",

  itemTypes: {
    assignment: "Тапсырма",
    quiz: "Тест",
    discussion: "Талқылау",
    other: "Тапсырма",
  },
}

export type Dict = typeof kkBase
