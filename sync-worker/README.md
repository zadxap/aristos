# Aristos Sync Worker

Облачная синхронизация устройств для Aristos через Cloudflare Worker + KV.

Модель: **аккаунтов нет**. «Аккаунт» — случайный код вида `ARISTOS-XXXX-XXXX-XXXX`
(владелец кода может пушить и тянуть полный бекап). Воркер **тупой**: он хранит
только шифробайты. Данные шифруются на клиенте (AES-GCM, ключ из passphrase через
PBKDF2), сервер их прочитать не может.

## API

| Метод | Путь | Ответ |
|---|---|---|
| `GET` | `/api/sync/:code` | `404 {found:false}` если нет; иначе `200 {found:true, updatedAt, data}` |
| `PUT` | `/api/sync/:code` | body `{"data":"<base64>"}`, ≤ 25 МБ → `200 {ok:true, updatedAt}` |
| `OPTIONS` | любой | `204` + CORS-заголовки |
| остальное | | `404 {error}` |

Код валидируется regex `^[A-Z0-9-]{12,64}$`. Значение хранится в KV под ключом
`sync:${code}` в виде `{"data": "...", "updatedAt": "ISO-8601"}`.

## Деплой (один раз, ~5 минут)

1. **Логин в Cloudflare** (откроется браузер):

   ```bash
   npx wrangler login
   ```

2. **Создать KV-неймспейс:**

   ```bash
   npx wrangler kv namespace create SYNC_KV
   ```

   В выводе будет `id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"` — вставь его в
   `wrangler.toml` вместо `REPLACE_WITH_YOUR_KV_ID`.

3. **Задеплоить:**

   ```bash
   npx wrangler deploy
   ```

   В конце воркер выдаст URL вида `https://aristos-sync.<ваш-сабдомен>.workers.dev`.

4. **Вписать URL в приложении:** «Деректерді басқару» → «Бұлттық синхрондау» →
   поле «Сервер URL». Там же генерируется код и задаётся passphrase (шифрование).

5. **После деплоя сайта на Vercel:** в `wrangler.toml` замени
   `ALLOWED_ORIGIN = "*"` на домен сайта (например `"https://aristos.vercel.app"`)
   и сделай `npx wrangler deploy` ещё раз. С `*` API открыт любому сайту — для
   теста это ок, для прода лучше ограничить.

## Локальная проверка

```bash
npx wrangler dev
# в другом терминале:
curl -X PUT http://localhost:8787/api/sync/ARISTOS-ABCD-EFGH-JKLM -H "Content-Type: application/json" -d '{"data":"dGVzdA=="}'
curl http://localhost:8787/api/sync/ARISTOS-ABCD-EFGH-JKLM
```
