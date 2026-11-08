// Aristos cloud sync worker. «Тупое» хранилище шифробайтов: кладёт и отдаёт
// AES-GCM base64-полезную нагрузку по случайному коду. Ничего не расшифровывает,
// аккаунтов нет — код и есть «аккаунт».

const CODE_RE = /^[A-Z0-9-]{12,64}$/
const KEY_PREFIX = 'sync:'
const MAX_BODY_BYTES = 25 * 1024 * 1024 // 25 MB (лимит значения в KV — 25 MiB)

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

/**
 * ALLOWED_ORIGIN = '*'  → Access-Control-Allow-Origin: *
 * иначе                 → список через запятую; echo Origin только при совпадении
 *                         с одним из элементов (без пробелов).
 */
function corsHeaders(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || '*').trim()
  let allowOrigin = allowed
  if (allowed !== '*') {
    const origin = request.headers.get('Origin') || ''
    const whitelist = allowed.split(',').map((item) => item.trim()).filter(Boolean)
    allowOrigin = whitelist.includes(origin) ? origin : ''
  }
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (allowOrigin !== '*') headers.Vary = 'Origin'
  return headers
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const match = url.pathname.match(/^\/api\/sync\/([^/]+)$/)
    if (match) {
      const code = decodeURIComponent(match[1])
      if (!CODE_RE.test(code)) {
        return json({ error: 'Invalid sync code' }, 400, cors)
      }

      // GET /api/sync/:code → {found:false} | {found:true, updatedAt, data}
      if (request.method === 'GET') {
        const record = await env.SYNC_KV.get(KEY_PREFIX + code, 'json')
        if (!record || typeof record.data !== 'string') {
          return json({ found: false }, 404, cors)
        }
        return json(
          {
            found: true,
            updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
            data: record.data,
          },
          200,
          cors,
        )
      }

      // PUT /api/sync/:code, body {data: "<base64>"} → {ok:true, updatedAt}
      if (request.method === 'PUT') {
        const raw = await request.arrayBuffer()
        if (raw.byteLength > MAX_BODY_BYTES) {
          return json({ error: 'Payload too large (max 25 MB)' }, 413, cors)
        }
        let body
        try {
          body = JSON.parse(new TextDecoder().decode(raw))
        } catch {
          return json({ error: 'Body must be JSON' }, 400, cors)
        }
        if (
          typeof body !== 'object' ||
          body === null ||
          typeof body.data !== 'string' ||
          body.data.length === 0
        ) {
          return json({ error: 'Expected body {"data": "<base64 string>"}' }, 400, cors)
        }

        const updatedAt = new Date().toISOString()
        await env.SYNC_KV.put(KEY_PREFIX + code, JSON.stringify({ data: body.data, updatedAt }))
        return json({ ok: true, updatedAt }, 200, cors)
      }
    }

    return json({ error: 'Not found' }, 404, cors)
  },
}
