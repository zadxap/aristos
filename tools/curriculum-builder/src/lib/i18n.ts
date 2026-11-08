/**
 * Двуязычие (RU/KK) и темы Curriculum Builder.
 *
 * - Словарь: две полные ветки `ru` и `kk`; тип Dict выводится из `ru`,
 *   поэтому в `kk` невозможно пропустить или опечатать ключ.
 * - Динамические сообщения (со числами, путями, кодами ошибок) — функции-шаблоны
 *   внутри словаря, конкатенация вне словаря не используется.
 * - Технические термины (subject_id, course, semester, JSON, API key, Model…)
 *   не переводятся.
 * - Язык: localStorage `aristos-cb:lang`, дефолт 'ru'.
 *   Тема: localStorage `aristos-cb:theme`, дефолт 'dark'; системное авто-переключение
 *   не используется — только ручной тоггл в шапке.
 *
 * Модуль хранит текущий язык в переменной уровня модуля: компоненты читают `t()`
 * во время рендера (ре-рендер запускает состояние `lang` в App), а lib-функции
 * (validate/parse/ai) берут словарь в момент вызова.
 */

export type Lang = 'ru' | 'kk';
export type Theme = 'dark' | 'light';

const LANG_KEY = 'aristos-cb:lang';
const THEME_KEY = 'aristos-cb:theme';

// ------------------------------------------------------------------ RU

const ru = {
  // ---- шапка / общий каркас
  brandSub: 'Aristos · генератор JSON-конфигов',
  docTypeAria: 'Тип документа',
  clear: 'Очистить',
  clearTitle: 'Удалить автосохранённые черновики из localStorage',
  clearConfirm:
    'Очистить черновики всех трёх вкладок (localStorage)?\n' +
    'Сохранённые «Мои пәндеры» и настройки AI останутся.',
  footer:
    'Черновики и справочник хранятся локально в браузере; наружу уходят только запросы к настроенному AI API.',
  langToggleAria: 'Язык интерфейса',
  themeToggleTitle: (theme: Theme): string =>
    theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему',

  tabs: {
    subject: 'Пән',
    schedule: 'Кесте',
    calendar: 'Күнтізбе',
  },

  // ---- общие элементы форм
  common: {
    optionalMark: 'опц.',
    up: 'Вверх',
    down: 'Вниз',
    remove: 'Удалить',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    untitled: 'Без названия',
    dragHandle: 'Перетащить на другой слот',
    entriesCount: (n: number) => `Записей: ${n}`,
    periodsCount: (n: number) => `Периодов: ${n}`,
    notSet: 'Список не задан.',
    nothingSaved: 'Пока ничего не сохранено.',
    openInEditor: 'Открыть в редакторе',
  },

  // ---- человеческие ярлыки и объяснения полей (JSON-ключ подписывается рядом кодом)
  fields: {
    subject: {
      subject_id: {
        label: 'Идентификатор предмета',
        hint: 'Уникальный адрес предмета — латиницей через дефис. По нему файл и сохраняется, менять после публикации не стоит.',
      },
      subject_code: {
        label: 'Код предмета',
        hint: 'Код из каталога дисциплин, например «В.013» — для сверки с расписанием и документами.',
      },
      subject_name: {
        label: 'Название предмета',
        hint: 'Как предмет видит студент в приложении, например «Академическое письмо».',
      },
      course: {
        label: 'Курс',
        hint: 'Номер курса (1–4) — к нему привязываются расписание и академический календарь.',
      },
      semester: {
        label: 'Семестр',
        hint: 'Номер семестра внутри курса (1 или 2).',
      },
      credits_ects: {
        label: 'Кредиты ECTS',
        hint: 'Кредиты ECTS — влияют на GPA-калькулятор.',
      },
      teacher_name: {
        label: 'ФИО преподавателя',
        hint: 'Показывается в карточке предмета и в расписании.',
      },
      teacher_phone: {
        label: 'Телефон',
        hint: 'Телефон преподавателя, например «+7 701 234 56 78».',
      },
      teacher_email: {
        label: 'E-mail',
        hint: 'Почта преподавателя — студент сможет написать с вопросом.',
      },
      description: {
        label: 'Описание',
        hint: 'О чём предмет и чему научит — виден в карточке предмета.',
      },
      topic_type: {
        label: 'Тип занятия',
        hint: 'Определяет группу темы.',
      },
      topic_week: {
        label: 'Неделя',
        hint: 'Учебная неделя 1–15.',
      },
      topic_topic: {
        label: 'Тема',
        hint: 'Что изучается на этой неделе, например «Введение. Академическое письмо».',
      },
      pdf_title: {
        label: 'Название',
        hint: 'Как файл называется для студента, например «Силлабус».',
      },
      pdf_filename: {
        label: 'Имя файла',
        hint: 'Имя PDF-файла, например «silabus-1.pdf» — используется при скачивании.',
      },
      pdf_url: {
        label: 'Ссылка',
        hint: 'Прямая ссылка на PDF (https://…).',
      },
    },
    schedule: {
      course: {
        label: 'Курс',
        hint: 'Номер курса, к которому относится расписание.',
      },
      semester: {
        label: 'Семестр',
        hint: 'Номер семестра, к которому относится расписание.',
      },
      day: {
        label: 'День недели',
        hint: 'День, в который идёт пара. Смена дня переносит пару целиком.',
      },
      start: {
        label: 'Начало',
        hint: 'Начало пары, например «09:00». Слоты — 50 минут с 09:00 до 17:50.',
      },
      end: {
        label: 'Конец',
        hint: 'Конец пары, например «09:50».',
      },
      subject_id: {
        label: 'Предмет (слаг)',
        hint: 'Слаг из «Мои пәндеры» — связывает пару с карточкой предмета.',
      },
      subject_name: {
        label: 'Предмет (название)',
        hint: 'Название предмета, как его видит студент в сетке дня.',
      },
      type: {
        label: 'Тип',
        hint: 'Лекция или практика — влияет на значок пары в приложении.',
      },
      room: {
        label: 'Аудитория',
        hint: 'Аудитория, например «304» или «Гл. 12».',
      },
      teacher: {
        label: 'Преподаватель',
        hint: 'ФИО преподавателя этой пары.',
      },
      group: {
        label: 'Группа',
        hint: 'Подгруппа, если пара не для всего потока, например «ИС-21-1».',
      },
      valid_from: {
        label: 'Действует с',
        hint: 'Дата начала действия пары — так задают подмены расписания. Обычно пусто.',
      },
    },
    calendar: {
      course: {
        label: 'Курс',
        hint: 'Номер курса, к которому относится календарь.',
      },
      academic_year: {
        label: 'Учебный год',
        hint: 'Учебный год в формате «2026-2027».',
      },
      semester: {
        label: 'Семестр',
        hint: 'Номер семестра.',
      },
      total_weeks: {
        label: 'Учебных недель',
        hint: 'Сколько недель длится семестр — от этого считается текущая неделя.',
      },
      semester_start: {
        label: 'Начало занятий',
        hint: 'Первый день занятий.',
      },
      semester_end: {
        label: 'Конец занятий',
        hint: 'Последний день занятий.',
      },
      orientation_week: {
        label: 'Ознакомительная неделя',
        hint: 'Ознакомительная неделя в начале семестра.',
      },
      exam_period: {
        label: 'Сессия',
        hint: 'Экзаменационный период.',
      },
      midterm_controls: {
        label: 'Рубежные контроли',
        hint: 'Рубежные контроли РК1/РК2 — от них считается граница РК в оценках.',
      },
      holidays: {
        label: 'Каникулы',
        hint: 'Каникулы внутри семестра.',
      },
      practices: {
        label: 'Практики',
        hint: 'Периоды практик вне семестра.',
      },
      grading_period: {
        label: 'Выставление оценок',
        hint: 'Период выставления оценок (рейтинг).',
      },
      range_name: {
        label: 'Название',
        hint: 'Название периода, например «РК1». Необязательно.',
      },
      range_start: {
        label: 'Начало',
        hint: 'Первый день периода.',
      },
      range_end: {
        label: 'Конец',
        hint: 'Последний день периода.',
      },
    },
  },

  // ---- редактор пәна
  subject: {
    mainTitle: 'Основное',
    teacherTitle: 'Преподаватель и описание',
    topicsTitle: 'Темы по неделям',
    pdfsTitle: 'PDF-файлы',
    pdfsSubtitle: 'pdfs · опционально',
    subjectNamePlaceholder: 'Название предмета',
    teacherNamePlaceholder: 'ФИО преподавателя',
    descriptionPlaceholder: 'Краткое описание предмета…',
    topicPlaceholder: 'Тема занятия',
    pdfTitlePlaceholder: 'Название',
    topicTypes: {
      lecture: { label: 'Лекция', title: 'Лекция — lecture' },
      practice: { label: 'Практика', title: 'Практика — practice' },
      lab: { label: 'Лаб.', title: 'Лабораторная — lab' },
      srsp: { label: 'СРСП', title: 'СРСП — srsp' },
      srs: { label: 'СРС', title: 'СРС — srs' },
      mini_project: { label: 'Мини-проект', title: 'Мини-проект — mini_project' },
      military: { label: 'Воен. подг.', title: 'Военная подготовка — military' },
      other: { label: 'Другое', title: 'Другое — other' },
    },
    topicsEmpty: 'Пока нет тем — добавьте первую.',
    topicsHint:
      'Темы сгруппированы по типу занятия — это только вид: порядок тем в файле (topics) не меняется.',
    topicsEmptyGroup: 'В этой группе тем нет.',
    addTopic: '+ Добавить тему',
    addTopicShort: '+ тема',
    topicGroups: {
      lecture: { label: 'Лекции (lecture)', title: 'Группа тем с типом lecture' },
      practice: { label: 'Практические занятия (practice)', title: 'Группа тем с типом practice' },
      srsp: { label: 'СРСП (srsp)', title: 'Группа тем с типом srsp' },
      srs: { label: 'СРС (srs)', title: 'Группа тем с типом srs' },
      other: { label: 'Другое (mini_project, lab, military, other)', title: 'mini_project, lab, military, other' },
    },
    pdfHint: 'Необязательно. Ссылки открываются в карточке предмета в Aristos.',
    addPdfLinks: '+ Добавить PDF-ссылки',
    addPdf: '+ Добавить PDF',
  },

  // ---- редактор кесте
  schedule: {
    title: 'Расписание',
    days: {
      mon: { label: 'Пн', title: 'Понедельник — mon' },
      tue: { label: 'Вт', title: 'Вторник — tue' },
      wed: { label: 'Ср', title: 'Среда — wed' },
      thu: { label: 'Чт', title: 'Четверг — thu' },
      fri: { label: 'Пт', title: 'Пятница — fri' },
      sat: { label: 'Сб', title: 'Суббота — sat' },
      sun: { label: 'Вс', title: 'Воскресенье — sun' },
    },
    lessonTypes: {
      none: { label: '—', title: 'Тип не указан' },
      lecture: { label: 'Лекция', title: 'Лекция — lecture' },
      practice: { label: 'Практика', title: 'Практика — practice' },
    },
    addPair: '+ Добавить пару',
    addDayTitle: 'Добавить в первый свободный слот этого дня',
    addPairHere: '+ добавить',
    emptySlotTitle: 'Клик — добавить пару в это время',
    pairsCount: (n: number): string => {
      const m10 = n % 10;
      const m100 = n % 100;
      const word =
        m10 === 1 && m100 !== 11
          ? 'пара'
          : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)
            ? 'пары'
            : 'пар';
      return `${n} ${word}`;
    },
    otherTime: 'Другое время (вне сетки 09:00–17:50)',
    clearDay: 'Очистить день',
    clearDayConfirm: (day: string) => `Удалить все пары этого дня (${day})?`,
    moveUpSlot: 'Перенести на слот выше',
    moveDownSlot: 'Перенести на слот ниже',
    moveDayTitle: 'Сменить день — время пары сохранится',
    dragHint:
      'Карточку пары можно перетащить за ⠿ (или за свёрнутую карточку) на любой слот любого дня — день и время обновятся, длительность сохранится.',
    sort: '↕ Сортировать',
    libraryEmptyHint:
      'Справочник пәндеров пуст — сохраните предметы во вкладке «Пән» (панель «Мои пәндеры»), ' +
      'чтобы включить автозаполнение subject_id / subject_name.',
    libraryHint: (n: number) => `Автозаполнение по справочнику «Мои пәндеры»: ${n} шт.`,
    subjectIdPlaceholder: 'слаг предмета',
    subjectNamePlaceholder: 'название предмета',
    roomPlaceholder: 'ауд.',
    teacherPlaceholder: 'преподаватель',
    groupPlaceholder: 'группа',
    entriesEmpty: 'Нет записей — нажмите «Добавить пару».',
  },

  // ---- редактор күнтізбе
  calendar: {
    yearTitle: 'Учебный год',
    semesterTitle: (n: number) => `Семестр ${n}`,
    removeSemester: 'Удалить семестр',
    midtermsTitle: 'Рубежные контроли',
    holidaysTitle: 'Каникулы',
    practicesTitle: 'Практики',
    practiceRangesTitle: 'Периоды практик',
    gradingTitle: 'Период сдачи рейтинга',
    namePlaceholder: 'необязательно',
    add: '+ Добавить',
    addSemester: '+ Добавить семестр',
  },

  // ---- экспорт
  export: {
    title: 'Экспорт',
    download: '⬇ Скачать файл',
    copy: 'Копировать',
    copied: 'Скопировано ✓',
    copyFailedAlert:
      'Не удалось скопировать автоматически. JSON показан в предпросмотре — скопируйте его вручную.',
    blockedHint: 'Экспорт заблокирован, пока есть ошибки валидации (список под редактором).',
    preview: 'Предпросмотр JSON',
  },

  // ---- импорт
  import: {
    title: 'Импорт JSON',
    chooseFile: '📂 Выбрать файл',
    hint: (tab: string) =>
      `Одиночный JSON (Subject / Schedule / AcadCalendar) откроется во вкладке «${tab}»; если ` +
      'структура относится к другому типу документа — автоматически загрузится в подходящую вкладку. ' +
      'Полный бекап Aristos (format: "aristos-backup") импортируется целиком: пәндеры — в «Мои ' +
      'пәндеры», кесте и күнтізбе — в хранилище по ключу «курс-семестр» / курс.',
    badJson: (msg: string) => `Файл не является корректным JSON: ${msg}`,
    backupUnrecognized: (msg: string) => `Структура бекапа не распознана: ${msg}`,
    importedToTab: (tab: string) => `Импортировано во вкладку «${tab}».`,
    noTypeMatch: (errors: string) =>
      'Структура файла не соответствует ни одному из трёх типов документов. ' +
      (errors === '' ? '' : errors),
    errorsAsTab: (tab: string, errors: string) => `Ошибки проверки как «${tab}»: ${errors}`,
    scheduleLoaded: (key: string) => `Кесте ${key} загружено в редактор.`,
    calendarLoaded: (course: number) => `Күнтізбе (курс ${course}) загружено в редактор.`,
    partSubjects: (n: number) => `${n} пәндер (кітапхана)`,
    partSchedules: (n: number, keys: string) => `${n} кесте (курс-семестр: ${keys})`,
    partCalendars: (n: number, courses: string) => `${n} күнтізбе (курс ${courses})`,
    backupEmpty: (skipped: number) =>
      'Бекап распознан (format: "aristos-backup"), но валидных документов в нём не нашлось.' +
      (skipped > 0 ? ` Пропущено элементов: ${skipped}.` : ''),
    importedSummary: (parts: string) => `Импортировано: ${parts}.`,
    skippedSummary: (n: number) => `Пропущено элементов: ${n} (не прошли проверку схемы).`,
    storeHint: 'Подсказка: переключите вкладку и выберите документ из хранилища.',
  },

  // ---- библиотека пәндеров
  library: {
    title: 'Мои пәндеры',
    hint:
      'Сохранённые Subject (localStorage). Используются как справочник для автозаполнения id/названий ' +
      'во вкладке «Кесте».',
    needSubjectId: 'Сначала заполните subject_id',
    updateCurrent: '⟳ Обновить текущим',
    saveCurrent: '＋ Сохранить текущий пән',
    removeFromLibrary: 'Удалить из справочника',
    libSub: (course: number, semester: number) => `курс ${course}, сем. ${semester}`,
  },

  // ---- хранилище кесте/күнтізбе
  store: {
    schedulesTitle: 'Хранилище кесте',
    schedulesHint:
      'Расписания (ключ «курс-семестр»), сохранённые при импорте бекапа. Выберите документ, чтобы ' +
      'открыть его в редакторе.',
    calendarsTitle: 'Хранилище күнтізбе',
    calendarsHint:
      'Академические календари (ключ — курс), сохранённые при импорте бекапа. Выберите документ, ' +
      'чтобы открыть его в редакторе.',
    removeFromStore: 'Удалить из хранилища',
    scheduleName: (course: number, semester: number) => `Курс ${course} · семестр ${semester}`,
    scheduleSub: (key: string, n: number) => `ключ ${key} · записей: ${n}`,
    calendarName: (course: number) => `Курс ${course}`,
    calendarSub: (n: number) => `семестров: ${n}`,
  },

  // ---- AI-панель
  ai: {
    title: 'AI-ассистент',
    subtitle: 'генерация JSON',
    provider: 'Провайдер',
    modelProxyHint: 'Модель зависит от твоего прокси (omniroute и т.п.) — впиши свою.',
    flashLiteHint: 'flash-lite модели самые дешёвые по лимитам.',
    openaiKeyHint:
      'Ключ хранится только в localStorage этого браузера. Если поле пустое — берётся значение из env ' +
      'VITE_AI_BASE_URL / VITE_AI_API_KEY / VITE_AI_MODEL.',
    geminiKeyHint: (defaultModel: string) =>
      'Бесплатный ключ — с aistudio.google.com, хранится только в localStorage этого браузера. ' +
      `Модель по умолчанию — ${defaultModel}.`,
    targetLabel: 'Что генерировать',
    targetOptions: {
      subject: 'Пән — Subject (<subject_id>.json)',
      schedule: 'Кесте — Schedule (schedule.json)',
      calendar: 'Күнтізбе — AcadCalendar (acad_calendar.json)',
    },
    targetShort: {
      subject: 'Пән',
      schedule: 'Кесте',
      calendar: 'Күнтізбе',
    },
    sourceLabel: 'Исходный текст (силлабус / расписание / календарь)',
    sourcePlaceholder:
      'Вставьте сюда текст силлабуса, расписания или академического календаря… либо прикрепите файл ниже',
    filesLabel: 'Файлы (PDF / TXT / картинки)',
    attachFiles: '📎 Прикрепить файлы',
    removeFile: 'Убрать файл',
    filesSummary: (n: number, total: string, max: string) =>
      `Файлов: ${n}, суммарно ${total} из ${max}.`,
    sizeLimitError: (max: string, current: string, incoming: string) =>
      `Суммарный размер файлов превысит лимит ${max} (уже ${current}, выбрано ${incoming}). ` +
      'Удалите лишние файлы или выберите меньшие.',
    rejectedFilesError: (names: string) =>
      'Пропущены файлы неподдерживаемого формата: ' +
      names +
      '. Разрешены .pdf, .txt и изображения (.png, .jpg, .jpeg, .webp).',
    attachmentsHint:
      'PDF и сканы-картинки надёжнее всего через провайдер «Google AI Studio — Gemini» — сканы тоже ' +
      'читает. Для OpenAI-совместимых прокси вложения прикрепляются частями file/image_url и могут ' +
      'не поддерживаться.',
    generate: '✦ Сгенерировать',
    generating: 'Генерация…',
    copyPrompt: 'Скопировать промт',
    promptCopied: 'Промт скопирован ✓',
    needSource: 'Вставьте исходный текст или прикрепите файл (PDF/TXT).',
    schemaMismatch: (target: string, errors: string) =>
      `Ответ ИИ не соответствует схеме «${target}». Ошибки:\n` +
      errors,
    generated: (target: string) =>
      `Готово — JSON сгенерирован и загружен во вкладку «${target}». Проверьте данные и экспортируйте.`,
    copyPromptFailed:
      'Не удалось скопировать автоматически — раскройте блок ниже и скопируйте промт из textarea вручную.',
    fullPromptSummary: 'Промт целиком — для использования в любом другом ИИ',
    fullPromptHint:
      'Скопируйте промт, вставьте его в любой ИИ вместе с исходным текстом (файлы в этот путь не ' +
      'входят — при необходимости вставьте их текст вручную), получите JSON и загрузите результат ' +
      'через «Импорт JSON» в нужной вкладке.',
    rawReplySummary: 'Сырой ответ модели',
  },

  // ---- валидация (ValidationList)
  validation: {
    ok: '✓ Ошибок нет — документ соответствует схеме',
    errorsTitle: (n: number) => `Ошибки валидации (${n})`,
  },

  // ---- сообщения validate.ts
  validate: {
    required: (path: string) => `${path}: обязательное поле не заполнено`,
    posNum: (path: string, min: number) => `${path}: должно быть числом не меньше ${min}`,
    posInt: (path: string, min: number) => `${path}: должно быть целым числом не меньше ${min}`,
    dateMissing: (path: string) => `${path}: не указана дата (YYYY-MM-DD)`,
    dateBad: (path: string, v: string) =>
      `${path}: ожидается реальная дата в формате YYYY-MM-DD (получено «${v}»)`,
    timeMissing: (path: string) => `${path}: не указано время (HH:MM)`,
    timeBad: (path: string, v: string) =>
      `${path}: ожидается время в формате HH:MM (получено «${v}»)`,
    timeOrder: (path: string, end: string, start: string) =>
      `${path}: время окончания (${end}) не позже времени начала (${start})`,
    dateOrder: (path: string, end: string, start: string) =>
      `${path}: дата окончания (${end}) раньше даты начала (${start})`,
    slug: () =>
      'subject_id: должен быть слагом — строчные латинские буквы, цифры, «-» или «_» (например «aleumettanu»)',
    email: () => 'teacher.email: значение не похоже на e-mail',
    topicsEmpty: () => 'topics: добавьте хотя бы одну тему',
    urlHttp: (path: string) => `${path}: ссылка должна начинаться с http:// или https://`,
    scheduleEmpty: () => 'schedule: добавьте хотя бы одну пару',
    yearMissing: () => 'academic_year: не указан учебный год',
    yearBad: (v: string) => `academic_year: ожидается формат «YYYY-YYYY» (получено «${v}»)`,
    semestersEmpty: () => 'semesters: добавьте хотя бы один семестр',
  },

  // ---- сообщения parse.ts
  parse: {
    rootNotObject: () => 'Корень JSON должен быть объектом.',
    fail: (path: string, expected: string, got: string) =>
      `${path}: ожидалось ${expected}, получено ${got}`,
    kindNull: () => 'null',
    kindArray: () => 'массив',
    kindObject: () => 'объект',
    expectedString: () => 'строку',
    expectedNumber: () => 'число',
    expectedEnum: (allowed: string) => `одно из значений ${allowed}`,
    expectedStringOrNull: () => 'строку или null',
    expectedArray: () => 'массив',
    expectedTeacher: () => 'объект { name, phone?, email? }',
    expectedTopic: () => 'объект { type, week, topic }',
    expectedPdf: () => 'объект { title, filename, url }',
    expectedEntry: () => 'объект записи',
    expectedSemester: () => 'объект семестра',
    expectedRange: () => 'объект { start, end }',
    expectedNamedRanges: () => 'массив { name?, start, end }',
    teacherMissing: () => 'teacher: отсутствует обязательный объект { name, phone?, email? }',
    backupFormat: (got: string) => `format: ожидалось "aristos-backup", получено ${got}`,
    backupArrays: () =>
      'Бекап должен содержать хотя бы один из массивов: subjects, schedules, calendars.',
  },

  // ---- сообщения ai.ts / attachments.ts
  aiErrors: {
    noBaseUrl: () => 'Не указан Base URL. Впишите адрес API в настройках AI-ассистента.',
    noApiKey: () => 'Не указан API key. Впишите ключ в настройках AI-ассистента.',
    noModel: () => 'Не указана модель (model).',
    connectionFailed: (url: string) =>
      `Не удалось соединиться с ${url}. Проверьте интернет, правильность Base URL и доступность API ` +
      '(запрос идёт из браузера — иногда мешает CORS или блокировщик расширений).',
    geminiConnectionFailed: (url: string) =>
      `Не удалось соединиться с ${url}. Проверьте интернет и доступность Google AI API.`,
    apiError: (status: number, statusText: string, detail: string) =>
      `API вернул ошибку ${status} ${statusText}.${detail !== '' ? ` Ответ: ${detail}` : ''}`,
    apiErrorPdfHint: () =>
      ' Похоже, этот провайдер/прокси не принимает вложения (PDF/изображения) — переключитесь на ' +
      'провайдер «Google AI Studio — Gemini» или вставьте текст вручную.',
    responseNotJson: () => 'Ответ API не является JSON.',
    noChoices: () =>
      'В ответе API нет массива choices — проверьте, что Base URL указывает на OpenAI-совместимый API (…/v1).',
    emptyOpenAiResponse: () => 'API вернул пустой ответ (нет текста в choices[0].message.content).',
    noGeminiKey: () =>
      'Не указан API key Google AI Studio. Получите бесплатный ключ на aistudio.google.com и вставьте его в настройках AI-ассистента.',
    noGeminiModel: () => 'Не указана модель Gemini (например "gemini-2.0-flash").',
    geminiApiError: (status: number, statusText: string, detail: string) =>
      `Google AI API вернул ошибку ${status} ${statusText}.${detail !== '' ? ` Ответ: ${detail}` : ''}`,
    geminiResponseNotJson: () => 'Ответ Google AI API не является JSON.',
    geminiUnexpectedStructure: () => 'Ответ Google AI API имеет неожиданную структуру.',
    blocked: (reason: string) => `Запрос заблокирован фильтрами Google (blockReason: ${reason}).`,
    noCandidates: () =>
      'В ответе Google AI API нет кандидатов (candidates) — модель не вернула результат.',
    emptyGeminiResponse: (finishReason: string) => `Модель Gemini вернула пустой ответ${finishReason}.`,
    extractFailed: () =>
      'Не удалось извлечь валидный JSON из ответа ИИ. Попробуйте сгенерировать ещё раз или сократите исходный текст.',
    fileReadFailed: (name: string) => `Не удалось прочитать файл «${name}».`,
  },
};

// ------------------------------------------------------------------ KK
// Терминология — по образцу src/i18n/kk.ts главного приложения:
// пән, кесте, күнтізбе, сабақ, апта, дәріс, тәжірибе, өшіру, сақтау, жүктеу,
// импорттау, экспорттау, кітапхана, сақтау орны.

const kk: typeof ru = {
  brandSub: 'Aristos · JSON-конфигтер генераторы',
  docTypeAria: 'Құжат түрі',
  clear: 'Тазалау',
  clearTitle: 'Автосақталған жобаларды localStorage-ден өшіру',
  clearConfirm:
    'Үш беттің де жобаларын тазалау керек пе (localStorage)?\n' +
    'Сақталған «Пәндер кітапханасы» мен AI баптаулары қалады.',
  footer:
    'Жобалар мен анықтамалық браузерде жергілікті сақталады; сыртқа тек бапталған AI API-ға сұраулар жіберіледі.',
  langToggleAria: 'Интерфейс тілі',
  themeToggleTitle: (theme: Theme): string =>
    theme === 'dark' ? 'Жарық тақырыпқа ауыстыру' : 'Қараңғы тақырыпқа ауыстыру',

  tabs: {
    subject: 'Пән',
    schedule: 'Кесте',
    calendar: 'Күнтізбе',
  },

  common: {
    optionalMark: 'мінд. емес',
    up: 'Жоғары',
    down: 'Төмен',
    remove: 'Өшіру',
    collapse: 'Жию',
    expand: 'Жаю',
    untitled: 'Атауы жоқ',
    dragHandle: 'Басқа слотқа сүйреу',
    entriesCount: (n: number) => `Жазбалар: ${n}`,
    periodsCount: (n: number) => `Кезеңдер: ${n}`,
    notSet: 'Тізім көрсетілмеген.',
    nothingSaved: 'Әзірге ештеңе сақталмаған.',
    openInEditor: 'Редакторда ашу',
  },

  // ---- өрістердің адами жазулары мен түсіндірмелері (JSON-кілт көрінеді)
  fields: {
    subject: {
      subject_id: {
        label: 'Пән идентификаторы',
        hint: 'Пәннің бірегей адресі — дефис арқылы латын әріптерімен. Файл осы атаумен сақталады, жарияланғаннан кейін өзгертуге болмайды.',
      },
      subject_code: {
        label: 'Пән коды',
        hint: 'Дисциплиналар каталогындағы код, мысалы «В.013» — кесте мен құжаттармен салыстыру үшін.',
      },
      subject_name: {
        label: 'Пән атауы',
        hint: 'Студент қосымшада көретін атау, мысалы «Академиялық жазба».',
      },
      course: {
        label: 'Курс',
        hint: 'Курс нөмірі (1–4) — кесте мен академиялық күнтізбе соған байланыстырылады.',
      },
      semester: {
        label: 'Семестр',
        hint: 'Курс ішіндегі семестр нөмірі (1 немесе 2).',
      },
      credits_ects: {
        label: 'ECTS кредиттері',
        hint: 'ECTS кредиттері — GPA калькуляторына әсер етеді.',
      },
      teacher_name: {
        label: 'Оқытушының аты-жөні',
        hint: 'Пән карточкасында және кестеде көрсетіледі.',
      },
      teacher_phone: {
        label: 'Телефон',
        hint: 'Оқытушы телефоны, мысалы «+7 701 234 56 78».',
      },
      teacher_email: {
        label: 'E-mail',
        hint: 'Оқытушы поштасы — студент сұрақ жібере алады.',
      },
      description: {
        label: 'Сипаттама',
        hint: 'Пән нені қамтиды, нені үйретеді — пән карточкасында көрінеді.',
      },
      topic_type: {
        label: 'Сабақ түрі',
        hint: 'Дәріс, практика, ОБСӨЖ… — түрі тақырыптың тобын анықтайды.',
      },
      topic_week: {
        label: 'Апта',
        hint: 'Тақырып жататын оқу аптасы 1–15.',
      },
      topic_topic: {
        label: 'Тақырып',
        hint: 'Осы аптада не оқытылады, мысалы «Кіріспе. Академиялық жазба».',
      },
      pdf_title: {
        label: 'Атауы',
        hint: 'Файл студентке қалай көрінеді, мысалы «Силлабус».',
      },
      pdf_filename: {
        label: 'Файл атауы',
        hint: 'PDF файл атауы, мысалы «silabus-1.pdf» — жүктеп алу кезінде қолданылады.',
      },
      pdf_url: {
        label: 'Сілтеме',
        hint: 'PDF тікелей сілтемесі (https://…).',
      },
    },
    schedule: {
      course: {
        label: 'Курс',
        hint: 'Кесте жататын курс нөмірі.',
      },
      semester: {
        label: 'Семестр',
        hint: 'Кесте жататын семестр нөмірі.',
      },
      day: {
        label: 'Апта күні',
        hint: 'Сабақ өтетін күн. Күнді ауыстыру сабақты түгел ауыстырады.',
      },
      start: {
        label: 'Басталуы',
        hint: 'Сабақтың басталуы, мысалы «09:00». Слоты 09:00-ден 17:50-ге дейін 50 минуттан.',
      },
      end: {
        label: 'Аяқталуы',
        hint: 'Сабақтың аяқталуы, мысалы «09:50».',
      },
      subject_id: {
        label: 'Пән (слаг)',
        hint: '«Пәндер кітапханасындағы» слаг — сабақты пән карточкасымен байланыстырады.',
      },
      subject_name: {
        label: 'Пән (атауы)',
        hint: 'Студент күн торында көретін пән атауы.',
      },
      type: {
        label: 'Түрі',
        hint: 'Дәріс немесе практика — қосымшадағы белгіге әсер етеді.',
      },
      room: {
        label: 'Аудитория',
        hint: 'Аудитория, мысалы «304» немесе «Гл. 12».',
      },
      teacher: {
        label: 'Оқытушы',
        hint: 'Осы сабақтың оқытушысы.',
      },
      group: {
        label: 'Топ',
        hint: 'Топша, егер сабақ бүкіл ағымға арналмаса, мысалы «ИС-21-1».',
      },
      valid_from: {
        label: 'Күшіне енеді',
        hint: 'Сабақ қай күннен күшіне енетіні — кестені ауыстыру осылай беріледі. Әдетте бос.',
      },
    },
    calendar: {
      course: {
        label: 'Курс',
        hint: 'Күнтізбе жататын курс нөмірі.',
      },
      academic_year: {
        label: 'Оқу жылы',
        hint: '«2026-2027» форматындағы оқу жылы.',
      },
      semester: {
        label: 'Семестр',
        hint: 'Семестр нөмірі.',
      },
      total_weeks: {
        label: 'Оқу аптасы',
        hint: 'Семестр неше аптаға созылады — ағымдағы апта осыдан есептеледі.',
      },
      semester_start: {
        label: 'Сабақтың басталуы',
        hint: 'Сабақтың алғашқы күні.',
      },
      semester_end: {
        label: 'Сабақтың аяқталуы',
        hint: 'Сабақтың соңғы күні.',
      },
      orientation_week: {
        label: 'Таныстыру аптасы',
        hint: 'Семестр басындағы таныстыру аптасы.',
      },
      exam_period: {
        label: 'Емтихан кезеңі',
        hint: 'Емтихан сессиясының кезеңі.',
      },
      midterm_controls: {
        label: 'Рубеждік бақылаулар',
        hint: 'РК1/РК2 рубеждік бақылаулары — бағалардағы РК шегі осыдан есептеледі.',
      },
      holidays: {
        label: 'Каникулдар',
        hint: 'Семестр ішіндегі каникулдар.',
      },
      practices: {
        label: 'Практикалар',
        hint: 'Семестрден тыс практика кезеңдері.',
      },
      grading_period: {
        label: 'Баға қою кезеңі',
        hint: 'Бағаларды (рейтинг) қою кезеңі.',
      },
      range_name: {
        label: 'Атауы',
        hint: 'Кезеңнің атауы, мысалы «РК1». Міндетті емес.',
      },
      range_start: {
        label: 'Басталуы',
        hint: 'Кезеңнің алғашқы күні.',
      },
      range_end: {
        label: 'Аяқталуы',
        hint: 'Кезеңнің соңғы күні.',
      },
    },
  },

  subject: {
    mainTitle: 'Негізгі',
    teacherTitle: 'Оқытушы және сипаттама',
    topicsTitle: 'Апталар бойынша тақырыптар',
    pdfsTitle: 'PDF-файлдар',
    pdfsSubtitle: 'pdfs · міндетті емес',
    subjectNamePlaceholder: 'Пән атауы',
    teacherNamePlaceholder: 'Оқытушының аты-жөні',
    descriptionPlaceholder: 'Пәннің қысқаша сипаттамасы…',
    topicPlaceholder: 'Сабақ тақырыбы',
    pdfTitlePlaceholder: 'Атауы',
    topicTypes: {
      lecture: { label: 'Дәріс', title: 'Дәріс — lecture' },
      practice: { label: 'Практика', title: 'Практика — practice' },
      lab: { label: 'Зертх.', title: 'Зертханалық жұмыс — lab' },
      srsp: { label: 'ОБСӨЖ', title: 'ОБСӨЖ — srsp' },
      srs: { label: 'БСӨЖ', title: 'БСӨЖ — srs' },
      mini_project: { label: 'Шағын жоба', title: 'Шағын жоба — mini_project' },
      military: { label: 'Әск. дайынд.', title: 'Әскери дайындық — military' },
      other: { label: 'Басқа', title: 'Басқа — other' },
    },
    topicsEmpty: 'Әзірге тақырып жоқ — алғашқысын қосыңыз.',
    topicsHint:
      'Тақырыптар сабақ түрі бойынша топталған — бұл тек көрініс: файлдағы (topics) тақырып реті өзгермейді.',
    topicsEmptyGroup: 'Бұл топта тақырып жоқ.',
    addTopic: '+ Тақырып қосу',
    addTopicShort: '+ тақырып',
    topicGroups: {
      lecture: { label: 'Дәрістер (lecture)', title: 'lecture түріндегі тақырыптар тобы' },
      practice: { label: 'Тәжірибелік сабақтар (practice)', title: 'practice түріндегі тақырыптар тобы' },
      srsp: { label: 'ОБСӨЖ (srsp)', title: 'srsp түріндегі тақырыптар тобы' },
      srs: { label: 'БСӨЖ (srs)', title: 'srs түріндегі тақырыптар тобы' },
      other: { label: 'Басқа (mini_project, lab, military, other)', title: 'mini_project, lab, military, other' },
    },
    pdfHint: 'Міндетті емес. Сілтемелер Aristos-тағы пән карточкасынан ашылады.',
    addPdfLinks: '+ PDF-сілтемелер қосу',
    addPdf: '+ PDF қосу',
  },

  schedule: {
    title: 'Кесте',
    days: {
      mon: { label: 'Дс', title: 'Дүйсенбі — mon' },
      tue: { label: 'Сс', title: 'Сейсенбі — tue' },
      wed: { label: 'Ср', title: 'Сәрсенбі — wed' },
      thu: { label: 'Бс', title: 'Бейсенбі — thu' },
      fri: { label: 'Жм', title: 'Жұма — fri' },
      sat: { label: 'Сн', title: 'Сенбі — sat' },
      sun: { label: 'Жс', title: 'Жексенбі — sun' },
    },
    lessonTypes: {
      none: { label: '—', title: 'Түрі көрсетілмеген' },
      lecture: { label: 'Дәріс', title: 'Дәріс — lecture' },
      practice: { label: 'Практика', title: 'Практика — practice' },
    },
    addPair: '+ Сабақ қосу',
    addDayTitle: 'Осы күннің бірінші бос слотына қосу',
    addPairHere: '+ қосу',
    emptySlotTitle: 'Басу — осы уақытқа сабақ қосу',
    pairsCount: (n: number) => `${n} сабақ`,
    otherTime: 'Басқа уақыт (09:00–17:50 жиегінен тыс)',
    clearDay: 'Күнді тазалау',
    clearDayConfirm: (day: string) => `Осы күннің (${day}) барлық сабағын өшіру керек пе?`,
    moveUpSlot: 'Жоғарыдағы слотқа ауыстыру',
    moveDownSlot: 'Төмендегі слотқа ауыстыру',
    moveDayTitle: 'Күнді ауыстыру — сабақ уақыты сақталады',
    dragHint:
      'Сабақ карточкасын ⠿ арқылы (немесе жийілген карточканың өзінен) кез келген күннің кез келген слотына сүйреуге болады — күн мен уақыт жаңарады, ұзақтық сақталады.',
    sort: '↕ Сұрыптау',
    libraryEmptyHint:
      'Пәндер анықтамалығы бос — автотығындыруды қосу үшін пәндерді «Пән» бетінде ' +
      '(«Пәндер кітапханасы» панелінде) сақтаңыз: subject_id / subject_name.',
    libraryHint: (n: number) => `«Пәндер кітапханасы» анықтамалығы бойынша автотығындыру: ${n} дана.`,
    subjectIdPlaceholder: 'пән слагы',
    subjectNamePlaceholder: 'пән атауы',
    roomPlaceholder: 'ауд.',
    teacherPlaceholder: 'оқытушы',
    groupPlaceholder: 'топ',
    entriesEmpty: 'Жазбалар жоқ — «Сабақ қосу» басыңыз.',
  },

  calendar: {
    yearTitle: 'Оқу жылы',
    semesterTitle: (n: number) => `Семестр ${n}`,
    removeSemester: 'Семестрді өшіру',
    midtermsTitle: 'Рубеждік бақылаулар',
    holidaysTitle: 'Демалыстар',
    practicesTitle: 'Практикалар',
    practiceRangesTitle: 'Практика кезеңдері',
    gradingTitle: 'Рейтинг тапсыру кезеңі',
    namePlaceholder: 'міндетті емес',
    add: '+ Қосу',
    addSemester: '+ Семестр қосу',
  },

  export: {
    title: 'Экспорттау',
    download: '⬇ Файлды жүктеу',
    copy: 'Көшіру',
    copied: 'Көшірілді ✓',
    copyFailedAlert:
      'Автоматты көшіру мүмкін болмады. JSON алдын ала қарауда көрсетілген — қолмен көшіріңіз.',
    blockedHint: 'Валидация қателері бар кезде экспорт жабық (тізім редактордың астында).',
    preview: 'JSON алдын ала қарау',
  },

  import: {
    title: 'JSON импорттау',
    chooseFile: '📂 Файлды таңдау',
    hint: (tab: string) =>
      `Жеке JSON (Subject / Schedule / AcadCalendar) «${tab}» бетінде ашылады; егер құрылым ` +
      'басқа құжат түріне жатса — қолайлы бетке автоматты жүктеледі. Толық Aristos бекапы ' +
      '(format: "aristos-backup") толықтай импортталады: пәндер — «Пәндер кітапханасына», кесте мен ' +
      'күнтізбе — сақтау орнына «курс-семестр» / курс кілті бойынша.',
    badJson: (msg: string) => `Файл дұрыс JSON емес: ${msg}`,
    backupUnrecognized: (msg: string) => `Бекап құрылымы танылмады: ${msg}`,
    importedToTab: (tab: string) => `«${tab}» бетіне импортталды.`,
    noTypeMatch: (errors: string) =>
      'Файл құрылымы үш құжат түрінің біреуіне де сай емес. ' + (errors === '' ? '' : errors),
    errorsAsTab: (tab: string, errors: string) => `«${tab}» ретінде тексеру қателері: ${errors}`,
    scheduleLoaded: (key: string) => `Кесте ${key} редакторға жүктелді.`,
    calendarLoaded: (course: number) => `Күнтізбе (${course}-курс) редакторға жүктелді.`,
    partSubjects: (n: number) => `${n} пән (кітапхана)`,
    partSchedules: (n: number, keys: string) => `${n} кесте (курс-семестр: ${keys})`,
    partCalendars: (n: number, courses: string) => `${n} күнтізбе (курс ${courses})`,
    backupEmpty: (skipped: number) =>
      'Бекап танылды (format: "aristos-backup"), бірақ онда жарамды құжаттар табылмады.' +
      (skipped > 0 ? ` Өткізіп жіберілген элементтер: ${skipped}.` : ''),
    importedSummary: (parts: string) => `Импортталды: ${parts}.`,
    skippedSummary: (n: number) => `Өткізіп жіберілген элементтер: ${n} (схема тексеруінен өтпеген).`,
    storeHint: 'Кеңес: бетті ауыстырып, құжатты сақтау орнынан таңдаңыз.',
  },

  library: {
    title: 'Пәндер кітапханасы',
    hint:
      'Сақталған Subject (localStorage). «Кесте» бетінде id/атауларды автотығындыру үшін ' +
      'анықтамалық ретінде қолданылады.',
    needSubjectId: 'Алдымен subject_id толтырыңыз',
    updateCurrent: '⟳ Ағымдағымен жаңарту',
    saveCurrent: '＋ Ағымдағы пәнді сақтау',
    removeFromLibrary: 'Анықтамалықтан өшіру',
    libSub: (course: number, semester: number) => `${course}-курс, ${semester}-сем`,
  },

  store: {
    schedulesTitle: 'Кесте сақтау орны',
    schedulesHint:
      'Бекап импортталғанда сақталған кестелер («курс-семестр» кілті). Құжатты редакторда ашу үшін ' +
      'таңдаңыз.',
    calendarsTitle: 'Күнтізбе сақтау орны',
    calendarsHint:
      'Бекап импортталғанда сақталған академиялық күнтізбелер (кілті — курс). Құжатты редакторда ашу ' +
      'үшін таңдаңыз.',
    removeFromStore: 'Сақтау орнынан өшіру',
    scheduleName: (course: number, semester: number) => `${course}-курс · ${semester}-семестр`,
    scheduleSub: (key: string, n: number) => `кілт ${key} · жазбалар: ${n}`,
    calendarName: (course: number) => `${course}-курс`,
    calendarSub: (n: number) => `семестр саны: ${n}`,
  },

  ai: {
    title: 'AI-көмекші',
    subtitle: 'JSON генерациясы',
    provider: 'Провайдер',
    modelProxyHint: 'Модель сенің проксиіңе (omniroute т.с.с.) байланысты — өзіңдікіні жаз.',
    flashLiteHint: 'flash-lite моделдері лимиттер бойынша ең арзандар.',
    openaiKeyHint:
      'Кілт тек осы браузердің localStorage-інде сақталады. Өріс бос болса — env ' +
      'VITE_AI_BASE_URL / VITE_AI_API_KEY / VITE_AI_MODEL мәні алынады.',
    geminiKeyHint: (defaultModel: string) =>
      'Тегін кілт — aistudio.google.com сайтынан, тек осы браузердің localStorage-інде сақталады. ' +
      `Әдепкі модель — ${defaultModel}.`,
    targetLabel: 'Нені генерациялау',
    targetOptions: {
      subject: 'Пән — Subject (<subject_id>.json)',
      schedule: 'Кесте — Schedule (schedule.json)',
      calendar: 'Күнтізбе — AcadCalendar (acad_calendar.json)',
    },
    targetShort: {
      subject: 'Пән',
      schedule: 'Кесте',
      calendar: 'Күнтізбе',
    },
    sourceLabel: 'Бастапқы мәтін (силлабус / кесте / күнтізбе)',
    sourcePlaceholder:
      'Силлабустың, кестенің немесе академиялық күнтізбенің мәтінін осында қойыңыз… немесе төменде файл тіркіңіз',
    filesLabel: 'Файлдар (PDF / TXT / суреттер)',
    attachFiles: '📎 Файлдарды тірку',
    removeFile: 'Файлды өшіру',
    filesSummary: (n: number, total: string, max: string) =>
      `Файлдар: ${n}, барлығы ${max} ішінен ${total}.`,
    sizeLimitError: (max: string, current: string, incoming: string) =>
      `Файлдардың жалпы өлшемі ${max} шектен аседі (қазір ${current}, таңдалды ${incoming}). ` +
      'Артық файлдарды өшіріңіз немесе кішірек файлдар таңдаңыз.',
    rejectedFilesError: (names: string) =>
      'Қолдау көрсетілмейтін форматтағы файлдар өткізіп жіберілді: ' +
      names +
      '. Рұқсат етілген: .pdf, .txt және суреттер (.png, .jpg, .jpeg, .webp).',
    attachmentsHint:
      'PDF пен скан-суреттер «Google AI Studio — Gemini» провайдері арқылы сенімдірек — ол скандары да ' +
      'оқиды. OpenAI-үйлесімді проксилерде тіркемелер file/image_url бөліктерімен жіберіледі және ' +
      'қолдау көрсетілмеуі мүмкін.',
    generate: '✦ Генерациялау',
    generating: 'Генерация…',
    copyPrompt: 'Промтты көшіру',
    promptCopied: 'Промт көшірілді ✓',
    needSource: 'Бастапқы мәтінді қойыңыз немесе файл тіркіңіз (PDF/TXT).',
    schemaMismatch: (target: string, errors: string) =>
      `AI жауабы «${target}» схемасына сай емес. Қателер:\n` + errors,
    generated: (target: string) =>
      `Дайын — JSON генерацияланып «${target}» бетіне жүктелді. Деректерді тексеріп, экспорттаңыз.`,
    copyPromptFailed:
      'Автоматты көшіру мүмкін болмады — төмендегі блокты ашып, промтты textarea-дан қолмен көшіріңіз.',
    fullPromptSummary: 'Толық промт — кез келген басқа ИИ-де қолдану үшін',
    fullPromptHint:
      'Промтты көшіріп, кез келген ИИ-ге бастапқы мәтінмен бірге қойыңыз (файлдар бұл жолға кірмейді — ' +
      'қажет болса олардың мәтінін қолмен қойыңыз), JSON алып, нәтижені қажетті бетте «JSON импорттау» ' +
      'арқылы жүктіңіз.',
    rawReplySummary: 'Модельдің шикі жауабы',
  },

  validation: {
    ok: '✓ Қате жоқ — құжат схемага сай',
    errorsTitle: (n: number) => `Валидация қателері (${n})`,
  },

  validate: {
    required: (path: string) => `${path}: міндетті өріс толтырылмаған`,
    posNum: (path: string, min: number) => `${path}: кемінде ${min} болатын сан болуы керек`,
    posInt: (path: string, min: number) => `${path}: кемінде ${min} болатын бүтін сан болуы керек`,
    dateMissing: (path: string) => `${path}: күн көрсетілмеген (YYYY-MM-DD)`,
    dateBad: (path: string, v: string) =>
      `${path}: YYYY-MM-DD форматындағы нақты күн күтіледі («${v}» алынды)`,
    timeMissing: (path: string) => `${path}: уақыт көрсетілмеген (HH:MM)`,
    timeBad: (path: string, v: string) => `${path}: HH:MM форматындағы уақыт күтіледі («${v}» алынды)`,
    timeOrder: (path: string, end: string, start: string) =>
      `${path}: аяқталу уақыты (${end}) басталу уақытынан (${start}) кейін емес`,
    dateOrder: (path: string, end: string, start: string) =>
      `${path}: аяқталу күні (${end}) басталу күнінен (${start}) бұрын`,
    slug: () =>
      'subject_id: слаг болуы керек — латынның кіші әріптері, сандар, «-» немесе «_» (мысалы «aleumettanu»)',
    email: () => 'teacher.email: мән e-mail үлгісіне сай емес',
    topicsEmpty: () => 'topics: кемінде бір тақырып қосыңыз',
    urlHttp: (path: string) => `${path}: сілтеме http:// немесе https:// деп басталуы керек`,
    scheduleEmpty: () => 'schedule: кемінде бір сабақ қосыңыз',
    yearMissing: () => 'academic_year: оқу жылы көрсетілмеген',
    yearBad: (v: string) => `academic_year: «YYYY-YYYY» форматы күтіледі («${v}» алынды)`,
    semestersEmpty: () => 'semesters: кемінде бір семестр қосыңыз',
  },

  parse: {
    rootNotObject: () => 'JSON түбірі объект болуы керек.',
    fail: (path: string, expected: string, got: string) => `${path}: ${expected} күтіледі, ${got} алынды`,
    kindNull: () => 'null',
    kindArray: () => 'массив',
    kindObject: () => 'объект',
    expectedString: () => 'жол',
    expectedNumber: () => 'сан',
    expectedEnum: (allowed: string) => `келесі мәндердің бірі: ${allowed}`,
    expectedStringOrNull: () => 'жол немесе null',
    expectedArray: () => 'массив',
    expectedTeacher: () => '{ name, phone?, email? } объектісі',
    expectedTopic: () => '{ type, week, topic } объектісі',
    expectedPdf: () => '{ title, filename, url } объектісі',
    expectedEntry: () => 'жазба объектісі',
    expectedSemester: () => 'семестр объектісі',
    expectedRange: () => '{ start, end } объектісі',
    expectedNamedRanges: () => '{ name?, start, end } массиві',
    teacherMissing: () => 'teacher: міндетті { name, phone?, email? } объектісі жоқ',
    backupFormat: (got: string) => `format: "aristos-backup" күтіледі, ${got} алынды`,
    backupArrays: () => 'Бекапта кемінде бір массив болуы керек: subjects, schedules, calendars.',
  },

  aiErrors: {
    noBaseUrl: () => 'Base URL көрсетілмеген. AI-көмекші баптауларына API адресін жазыңыз.',
    noApiKey: () => 'API key көрсетілмеген. Кілтті AI-көмекші баптауларына жазыңыз.',
    noModel: () => 'Модель көрсетілмеген (model).',
    connectionFailed: (url: string) =>
      `${url} адресімен байланысу мүмкін болмады. Интернетті, Base URL дұрыстығын және API қолжетімділігін тексеріңіз ` +
      '(сұрау браузерден жіберіледі — кейде CORS немесе кеңейту блоктаушысы кедергі болады).',
    geminiConnectionFailed: (url: string) =>
      `${url} адресімен байланысу мүмкін болмады. Интернетті және Google AI API қолжетімділігін тексеріңіз.`,
    apiError: (status: number, statusText: string, detail: string) =>
      `API ${status} ${statusText} қатесін қайтарды.${detail !== '' ? ` Жауап: ${detail}` : ''}`,
    apiErrorPdfHint: () =>
      ' Қарағанда, бұл провайдер/прокси тіркемелерді (PDF/суреттер) қабылдамайды — «Google AI Studio — ' +
      'Gemini» провайдеріне ауысыңыз немесе мәтінді қолмен қойыңыз.',
    responseNotJson: () => 'API жауабы JSON емес.',
    noChoices: () =>
      'API жауабында choices массиві жоқ — Base URL OpenAI-үйлесімді API-ға (…/v1) бағытталғанын тексеріңіз.',
    emptyOpenAiResponse: () => 'API бос жауап қайтарды (choices[0].message.content-та мәтін жоқ).',
    noGeminiKey: () =>
      'Google AI Studio API key көрсетілмеген. Тегін кілтті aistudio.google.com сайтынан алып, ' +
      'AI-көмекші баптауларына қойыңыз.',
    noGeminiModel: () => 'Gemini моделі көрсетілмеген (мысалы "gemini-2.0-flash").',
    geminiApiError: (status: number, statusText: string, detail: string) =>
      `Google AI API ${status} ${statusText} қатесін қайтарды.${detail !== '' ? ` Жауап: ${detail}` : ''}`,
    geminiResponseNotJson: () => 'Google AI API жауабы JSON емес.',
    geminiUnexpectedStructure: () => 'Google AI API жауабының құрылымы күтпеген.',
    blocked: (reason: string) => `Сұрау Google фильтрлерімен блокталды (blockReason: ${reason}).`,
    noCandidates: () =>
      'Google AI API жауабында кандидаттар (candidates) жоқ — модель нәтиже қайтармаған.',
    emptyGeminiResponse: (finishReason: string) => `Gemini моделі бос жауап қайтарды${finishReason}.`,
    extractFailed: () =>
      'AI жауабынан жарамды JSON алу мүмкін болмады. Қайта генерациялауды немесе бастапқы мәтінді қысқартуды көріңіз.',
    fileReadFailed: (name: string) => `«${name}» файлын оқу мүмкін болмады.`,
  },
};

export type Dict = typeof ru;

const DICTS: Record<Lang, Dict> = { ru, kk };

// ------------------------------------------------------------------ текущий язык

let currentLang: Lang = loadLang();

// Синхронизируем <html lang> сразу при загрузке модуля, до первого рендера
// (дальше атрибут поддерживает applyLang).
document.documentElement.lang = currentLang;

function loadLang(): Lang {
  try {
    const raw = window.localStorage.getItem(LANG_KEY);
    if (raw === 'kk' || raw === 'ru') return raw;
  } catch {
    // localStorage недоступен — работаем с дефолтом.
  }
  return 'ru';
}

/** Текущий словарь — читать во время рендера / в момент вызова lib-функций. */
export function t(): Dict {
  return DICTS[currentLang];
}

export function getLang(): Lang {
  return currentLang;
}

/** Сменить язык: обновляет модульное состояние и localStorage. Вызывающий компонент
 * должен сам перевести своё React-состояние, чтобы запустить ре-рендер. */
export function applyLang(lang: Lang): void {
  currentLang = lang;
  document.documentElement.lang = lang;
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------------ тема

function loadTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // ignore
  }
  return 'dark';
}

export function getTheme(): Theme {
  return loadTheme();
}

/** Применить тему к <html data-theme> и сохранить в localStorage. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}
