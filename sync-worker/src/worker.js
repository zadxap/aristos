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

    // ---- Канал обновлений приложения (нативный APK + desktop-updater) ----
    // PUT /api/app/file/:name  (X-App-Upload-Secret, binary body) — из CI
    // PUT /api/app/meta        (X-App-Upload-Secret, JSON {version, notes, files})
    // GET /api/app/latest      → {version, notes, apkUrl, ...} (публично)
    // GET /api/app/file/:name  → бинарник (публично)
    if (url.pathname.startsWith('/api/app/')) {
      const secretOk =
        env.APP_UPLOAD_SECRET &&
        request.headers.get('X-App-Upload-Secret') === env.APP_UPLOAD_SECRET

      // PUT /api/app/meta — метаданные последнего релиза
      if (url.pathname === '/api/app/meta' && request.method === 'PUT') {
        if (!secretOk) return json({ error: 'Forbidden' }, 403, cors)
        const raw = await request.arrayBuffer()
        if (raw.byteLength > 64 * 1024) return json({ error: 'Meta too large' }, 413, cors)
        let meta
        try {
          meta = JSON.parse(new TextDecoder().decode(raw))
        } catch {
          return json({ error: 'Body must be JSON' }, 400, cors)
        }
        if (typeof meta.version !== 'string' || typeof meta.files !== 'object') {
          return json({ error: 'Expected {version, notes?, files}' }, 400, cors)
        }
        meta.updatedAt = new Date().toISOString()
        await env.SYNC_KV.put('app:meta', JSON.stringify(meta))
        return json({ ok: true }, 200, cors)
      }

      // PUT /api/app/file/:name — бинарник релиза из CI
      const fileMatch = url.pathname.match(/^\/api\/app\/file\/([A-Za-z0-9._-]+)$/)
      if (fileMatch && request.method === 'PUT') {
        if (!secretOk) return json({ error: 'Forbidden' }, 403, cors)
        const name = fileMatch[1]
        const raw = await request.arrayBuffer()
        if (raw.byteLength > MAX_BODY_BYTES) {
          return json({ error: 'Payload too large (max 25 MB)' }, 413, cors)
        }
        await env.SYNC_KV.put('app:file:' + name, raw)
        return json({ ok: true, name, size: raw.byteLength }, 200, cors)
      }

      // GET /api/app/latest — публичная точка проверки обновлений
      if (url.pathname === '/api/app/latest' && request.method === 'GET') {
        const meta = await env.SYNC_KV.get('app:meta', 'json')
        if (!meta || typeof meta.version !== 'string') {
          return json({ found: false }, 404, cors)
        }
        const origin = url.origin
        const files = meta.files || {}
        const fileUrl = (name) => (name ? origin + '/api/app/file/' + name : null)
        return json(
          {
            found: true,
            version: meta.version,
            notes: typeof meta.notes === 'string' ? meta.notes : '',
            updatedAt: meta.updatedAt || null,
            apkUrl: fileUrl(files.apk),
          },
          200,
          cors,
        )
      }

      // GET /api/app/file/:name — скачивание
      if (fileMatch && request.method === 'GET') {
        const name = fileMatch[1]
        const data = await env.SYNC_KV.get('app:file:' + name, 'arrayBuffer')
        if (!data) return json({ error: 'Not found' }, 404, cors)
        const type = name.endsWith('.apk')
          ? 'application/vnd.android.package-archive'
          : name.endsWith('.json')
            ? 'application/json'
            : name.endsWith('.exe')
              ? 'application/vnd.microsoft.portable-executable'
              : name.endsWith('.dmg')
                ? 'application/x-apple-diskimage'
                : 'application/octet-stream'
        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': type,
            'Content-Disposition': 'attachment; filename="' + name + '"',
          },
        })
      }
    }

    return json({ error: 'Not found' }, 404, cors)
  },
}
