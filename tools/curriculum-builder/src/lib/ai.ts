import { isRecord } from './parse';
import { t } from './i18n';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';
import type { AiTarget } from './prompt';
import type { AttachedFile } from './attachments';

/**
 * Клиенты AI-провайдеров (оба — нативный REST, без SDK):
 * - openai-compat: POST {base}/chat/completions (Authorization: Bearer);
 * - google-gemini: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...
 */

export type AiProvider = 'openai-compat' | 'google-gemini';

export interface OpenAiCompatSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface GeminiSettings {
  apiKey: string;
  model: string;
}

export interface AiSettings {
  provider: AiProvider;
  openai: OpenAiCompatSettings;
  gemini: GeminiSettings;
}

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-lite';

/** Пресеты моделей для datalist под полем Model (поле остаётся свободным вводом). */
export const GEMINI_MODEL_PRESETS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-3.5-flash-lite',
];

export const OPENAI_MODEL_PRESETS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'];

export const AI_PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: 'openai-compat', label: 'OpenAI-совместимый API (chat/completions)' },
  { value: 'google-gemini', label: 'Google AI Studio — Gemini' },
];

export const AI_DEFAULTS: AiSettings = {
  provider: 'openai-compat',
  openai: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
  gemini: { apiKey: '', model: GEMINI_DEFAULT_MODEL },
};

/** Значения из Vite env — используются, если пользователь не указал свои (для openai-compat). */
export function envAiSettings(): AiSettings {
  const env = import.meta.env;
  return {
    provider: 'openai-compat',
    openai: {
      baseUrl: (env.VITE_AI_BASE_URL ?? '').trim() || AI_DEFAULTS.openai.baseUrl,
      apiKey: env.VITE_AI_API_KEY ?? '',
      model: (env.VITE_AI_MODEL ?? '').trim() || AI_DEFAULTS.openai.model,
    },
    gemini: { apiKey: '', model: GEMINI_DEFAULT_MODEL },
  };
}

/** Приоритет: сохранённые настройки пользователя (localStorage) -> env -> дефолты. */
export function resolveAiSettings(stored: AiSettings | null): AiSettings {
  const env = envAiSettings();
  return {
    provider: stored?.provider ?? AI_DEFAULTS.provider,
    openai: {
      baseUrl: (stored?.openai.baseUrl ?? '').trim() || env.openai.baseUrl,
      apiKey: (stored?.openai.apiKey ?? '') || env.openai.apiKey,
      model: (stored?.openai.model ?? '').trim() || env.openai.model,
    },
    gemini: {
      apiKey: (stored?.gemini.apiKey ?? '') || AI_DEFAULTS.gemini.apiKey,
      model: (stored?.gemini.model ?? '').trim() || AI_DEFAULTS.gemini.model,
    },
  };
}

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  } catch {
    return '';
  }
}

/** POST к выбранному провайдеру и возврат текста ответа модели. */
export async function requestCompletion(
  settings: AiSettings,
  target: AiTarget,
  sourceText: string,
  files: AttachedFile[] = [],
): Promise<string> {
  if (settings.provider === 'google-gemini') {
    return requestGemini(settings, target, sourceText, files);
  }
  return requestOpenAi(settings, target, sourceText, files);
}

// ------------------------------------------------------- OpenAI-совместимый

function buildOpenAiContentParts(
  target: AiTarget,
  sourceText: string,
  files: AttachedFile[],
): unknown[] {
  const content: unknown[] = [{ type: 'text', text: buildUserPrompt(target, sourceText, true) }];
  for (const file of files) {
    if (file.kind === 'pdf' && typeof file.base64 === 'string' && file.base64 !== '') {
      content.push({
        type: 'file',
        file: { filename: file.name, file_data: `data:application/pdf;base64,${file.base64}` },
      });
    } else if (file.kind === 'image' && typeof file.base64 === 'string' && file.base64 !== '') {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${file.mime};base64,${file.base64}` },
      });
    } else if (file.kind === 'txt' && typeof file.text === 'string' && file.text !== '') {
      content.push({ type: 'text', text: `ФАЙЛ: ${file.name}\n\n${file.text}` });
    }
  }
  return content;
}

async function requestOpenAi(
  settings: AiSettings,
  target: AiTarget,
  sourceText: string,
  files: AttachedFile[],
): Promise<string> {
  const base = settings.openai.baseUrl.trim().replace(/\/+$/, '');
  const key = settings.openai.apiKey.trim();
  const model = settings.openai.model.trim();
  if (base === '') throw new AiError(t().aiErrors.noBaseUrl());
  if (key === '') throw new AiError(t().aiErrors.noApiKey());
  if (model === '') throw new AiError(t().aiErrors.noModel());

  const url = `${base}/chat/completions`;
  const userContent: string | unknown[] =
    files.length === 0
      ? buildUserPrompt(target, sourceText, false)
      : buildOpenAiContentParts(target, sourceText, files);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });
  } catch {
    throw new AiError(t().aiErrors.connectionFailed(url));
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    const pdfHint =
      files.length > 0 && res.status >= 400 && res.status < 500
        ? t().aiErrors.apiErrorPdfHint()
        : '';
    throw new AiError(t().aiErrors.apiError(res.status, res.statusText, detail) + pdfHint);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiError(t().aiErrors.responseNotJson());
  }

  const choices = (data as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new AiError(t().aiErrors.noChoices());
  }
  const first = choices[0];
  const message = isRecord(first) ? first.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new AiError(t().aiErrors.emptyOpenAiResponse());
  }
  return content;
}

// ------------------------------------------------------- Google Gemini

async function requestGemini(
  settings: AiSettings,
  target: AiTarget,
  sourceText: string,
  files: AttachedFile[],
): Promise<string> {
  const key = settings.gemini.apiKey.trim();
  const model = settings.gemini.model.trim();
  if (key === '') {
    throw new AiError(t().aiErrors.noGeminiKey());
  }
  if (model === '') throw new AiError(t().aiErrors.noGeminiModel());

  const parts: Record<string, unknown>[] = [
    { text: SYSTEM_PROMPT + '\n\n---\n\n' + buildUserPrompt(target, sourceText, files.length > 0) },
  ];
  for (const file of files) {
    if (
      (file.kind === 'pdf' || file.kind === 'image') &&
      typeof file.base64 === 'string' &&
      file.base64 !== ''
    ) {
      parts.push({ inline_data: { mime_type: file.mime, data: file.base64 } });
    } else if (file.kind === 'txt' && typeof file.text === 'string' && file.text !== '') {
      parts.push({ text: `ФАЙЛ: ${file.name}\n\n${file.text}` });
    }
  }

  const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.2 },
      }),
    });
  } catch {
    throw new AiError(t().aiErrors.geminiConnectionFailed(GEMINI_BASE_URL));
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new AiError(t().aiErrors.geminiApiError(res.status, res.statusText, detail));
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiError(t().aiErrors.geminiResponseNotJson());
  }
  if (!isRecord(data)) throw new AiError(t().aiErrors.geminiUnexpectedStructure());

  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  if (candidates.length === 0) {
    const feedback = isRecord(data.promptFeedback) ? data.promptFeedback : undefined;
    const reason = isRecord(feedback) && typeof feedback.blockReason === 'string' ? feedback.blockReason : undefined;
    throw new AiError(
      reason !== undefined ? t().aiErrors.blocked(reason) : t().aiErrors.noCandidates(),
    );
  }

  const first: unknown = candidates[0];
  const content = isRecord(first) && isRecord(first.content) ? first.content : undefined;
  const rawParts =
    content !== undefined && Array.isArray((content as Record<string, unknown>).parts)
      ? ((content as Record<string, unknown>).parts as unknown[])
      : [];
  const text = rawParts.map((p) => (isRecord(p) && typeof p.text === 'string' ? p.text : '')).join('');
  if (text.trim() === '') {
    const finishReason =
      isRecord(first) && typeof first.finishReason === 'string' ? ` (finishReason: ${first.finishReason})` : '';
    throw new AiError(t().aiErrors.emptyGeminiResponse(finishReason));
  }
  return text;
}

// ------------------------------------------------------- Извлечение JSON

/**
 * Достаёт JSON из ответа модели: срезает ```-фенсы, при мусоре вокруг —
 * вырезает от первого {/[ до последнего }/].
 */
export function extractJson(content: string): unknown {
  let text = content.trim();
  const fenced = text.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fenced !== null) text = fenced[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    // попробуем вырезать JSON из окружающего текста
  }

  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const candidates = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (candidates.length > 0) {
    const start = Math.min(...candidates);
    const tail = text.slice(start);
    const end = Math.max(tail.lastIndexOf('}'), tail.lastIndexOf(']'));
    if (end > 0) {
      const candidate = tail.slice(0, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // ниже — общая ошибка
      }
    }
  }
  throw new AiError(t().aiErrors.extractFailed());
}
