// AI client for the advisor: OpenAI-compatible and Google Gemini providers.

export type AiProvider = 'openai-compat' | 'google-gemini'

export interface AiSettings {
  provider: AiProvider
  openai: { baseUrl: string; apiKey: string; model: string }
  gemini: { apiKey: string; model: string }
}

const STORAGE_KEY = 'ai-advisor-settings'

const DEFAULTS: AiSettings = {
  provider: 'openai-compat',
  openai: {
    baseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: import.meta.env.VITE_AI_API_KEY || '',
    model: import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini',
  },
  gemini: {
    apiKey: '',
    model: 'gemini-2.5-flash-lite',
  },
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AiSettings>
    return {
      provider: parsed.provider || DEFAULTS.provider,
      openai: { ...DEFAULTS.openai, ...parsed.openai },
      gemini: { ...DEFAULTS.gemini, ...parsed.gemini },
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function isAiConfigured(settings: AiSettings): boolean {
  if (settings.provider === 'google-gemini') return !!settings.gemini.apiKey
  return !!settings.openai.apiKey
}

async function openaiChat(settings: AiSettings, system: string, user: string): Promise<string> {
  const { baseUrl, apiKey, model } = settings.openai
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (res.status === 401) throw new Error('API key отклонён (401) — проверь ключ')
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Пустой ответ от API')
  return text
}

async function geminiChat(settings: AiSettings, system: string, user: string): Promise<string> {
  const { apiKey, model } = settings.gemini
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: `${system}\n\n---\n\n${user}` }] },
        ],
        generationConfig: { temperature: 0.4 },
      }),
    }
  )
  if (res.status === 400 || res.status === 403) throw new Error('Gemini API key отклонён — проверь ключ с aistudio.google.com')
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  const text = parts ? parts.map((p: { text?: string }) => p.text || '').join('') : ''
  if (!text) throw new Error('Gemini вернул пустой ответ (возможно, фильтры сработали)')
  return text
}

export async function chatComplete(settings: AiSettings, system: string, user: string): Promise<string> {
  if (settings.provider === 'google-gemini') return geminiChat(settings, system, user)
  return openaiChat(settings, system, user)
}
