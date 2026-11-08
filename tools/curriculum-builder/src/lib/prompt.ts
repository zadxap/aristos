import type { DocKind } from '../types';

/**
 * Системный промт для AI-генерации. Полностью описывает три схемы данных
 * дашборда Aristos и жёсткие требования к формату ответа.
 * Этот же промт доступен в UI через «Скопировать промт» — для использования
 * в любом другом ИИ вручную.
 */

export type AiTarget = DocKind;

export const TARGET_LABELS: Record<AiTarget, string> = {
  subject: 'Пән — Subject (<subject_id>.json)',
  schedule: 'Кесте — Schedule (schedule.json)',
  calendar: 'Күнтізбе — AcadCalendar (acad_calendar.json)',
};

export const TARGET_SHORT: Record<AiTarget, string> = {
  subject: 'Пән',
  schedule: 'Кесте',
  calendar: 'Күнтізбе',
};

export const SYSTEM_PROMPT = `Ты — генератор структурированных данных для студенческого дашборда Aristos. Тебе дают исходный текст (силлабус, расписание занятий или академический календарь) и просят ровно один JSON-документ строго по схеме ниже.

== ФОРМАТ ОТВЕТА (критически важно) ==
1. В ответе должен быть ТОЛЬКО валидный JSON: без markdown-обёртки (запрещено оборачивать ответ в тройные кавычки-фенсы с "json"), без комментариев, без пояснений до или после.
2. Первый символ ответа — "{" или "[", последний — "}" или "]".
3. Ключи объектов — ровно как в схеме (по-английски, в точности указанные строки). Значения строк — на языке исходного текста (казахский/русский).
4. Не придумывай поля, которых нет в схеме. Если значение неизвестно из текста:
   - если поле допускает null — ставь null;
   - иначе ставь "" (пустую строку).
   НИКОГДА не выдумывай даты, времена, телефоны и e-mail.

== ОБЩИЕ ФОРМАТЫ ==
- время: "HH:MM", 24-часовой формат, с ведущим нулём: "09:00", "14:05".
- дата: "YYYY-MM-DD": "2026-09-01".
- учебный год: "YYYY-YYYY": "2026-2027".

== СХЕМА 1. SUBJECT (файл "<subject_id>.json") — один предмет ==
{
  "subject_id": string,            // слаг: только [a-z0-9_-], например "aleumettanu"
  "subject_code": string,          // например "В.013"
  "subject_name": string,          // название предмета
  "course": number,                // целый номер курса, >= 1
  "semester": number,              // целый номер семестра, >= 1
  "credits_ects": number,          // кредиты ECTS, >= 1
  "teacher": {
    "name": string,                // ФИО преподавателя
    "phone"?: string,              // опционально
    "email"?: string               // опционально
  },
  "description": string,           // описание предмета
  "topics": [                      // темы по неделям, минимум одна
    {
      "type": "lecture" | "practice" | "lab" | "srsp" | "srs" | "mini_project" | "military" | "other",
      "week": number,              // целое >= 1 — номер учебной недели
      "topic": string              // название темы
    }
  ],
  "pdfs"?: [                       // опционально; если ссылок нет — НЕ добавляй ключ
    { "title": string, "filename": string, "url": string }
  ]
}
Допустимые значения topics.type: "lecture" (лекция), "practice" (практическое занятие), "lab" (лабораторная), "srsp" (СРСП), "srs" (СРС), "mini_project" (мини-проект), "military" (военная подготовка), "other" (другое).

== СХЕМА 2. SCHEDULE (файл "schedule.json") — расписание пар ==
{
  "course": number,                // целый, >= 1
  "semester": number,              // целый, >= 1
  "schedule": [                    // записи пар, минимум одна
    {
      "day": "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
      "start": string,             // "HH:MM", например "09:00"
      "end": string,               // "HH:MM", строго позже start
      "subject_id": string,        // слаг предмета (как SUBJECT.subject_id)
      "subject_name": string,      // название предмета
      "type": "lecture" | "practice" | null,
      "room": string | null,       // аудитория или null
      "teacher": string | null,    // преподаватель или null
      "group"?: string | null,     // опционально: группа или null
      "valid_from"?: string | null // опционально: дата "YYYY-MM-DD" начала действия записи
    }
  ]
}
Отсортируй массив schedule по дню недели (mon -> sun) и по времени начала.

== СХЕМА 3. ACAD_CALENDAR (файл "acad_calendar.json") — академический календарь ==
{
  "course": number,                // целый, >= 1
  "academic_year": string,         // "YYYY-YYYY", например "2026-2027"
  "semesters": [                   // минимум один семестр
    {
      "semester": number,          // целый, >= 1
      "semester_start": string,    // "YYYY-MM-DD"
      "semester_end": string,      // "YYYY-MM-DD", не раньше semester_start
      "total_weeks": number,       // целое >= 1
      "orientation_week": { "start": string, "end": string },
      "midterm_controls": [        // рубежные контроли; если их нет — пустой массив
        { "name"?: string, "start": string, "end": string }
      ],
      "exam_period": { "start": string, "end": string },
      "holidays": [                // каникулы/выходные; если их нет — пустой массив
        { "name"?: string, "start": string, "end": string }
      ]
    }
  ],
  "practices": [                   // периоды практик; если их нет — пустой массив
    { "name"?: string, "start": string, "end": string }
  ],
  "grading_period": { "start": string, "end": string }
}
Во всех диапазонах дат end не раньше start. Ключ "name" добавляй, только если название периода известно из текста. Если период не указан в тексте — используй пустые строки "" (не выдумывай даты).

== ЧТО ВЕРНУТЬ ==
Ровно один JSON-объект того типа, который запрошен в задаче пользователя. Ответ начинается с "{" и заканчивается "}". Никакого текста кроме JSON.`;

export function buildUserPrompt(target: AiTarget, sourceText: string, withFilesNote = false): string {
  const source = sourceText.trim();
  const sourcePart =
    source !== ''
      ? ['ИСХОДНЫЙ ТЕКСТ:', '"""', source, '"""'].join('\n')
      : 'ИСХОДНЫЙ ТЕКСТ: текстом не приложен.';
  const filesNote = withFilesNote
    ? '\n\nК сообщению приложены файлы (PDF/изображения/TXT): извлеки данные для документа из них' +
      (source !== '' ? ' и из текста выше, объединяя их.' : '.')
    : '';
  return [
    'ЗАДАЧА: сгенерируй JSON-документ типа «' + TARGET_LABELS[target] + '» строго по схеме из системного сообщения.',
    'Верни только валидный JSON без markdown-обёртки и пояснений.',
    '',
    sourcePart + filesNote,
  ].join('\n');
}

/** Полный промт (система + задача) для ручного копирования в любой другой ИИ. */
export function buildFullPrompt(target: AiTarget, sourceText: string): string {
  return SYSTEM_PROMPT + '\n\n---\n\n' + buildUserPrompt(target, sourceText);
}
