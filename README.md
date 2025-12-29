# ElevenLabs WebSocket Proxy

WebSocket прокси для обхода геоблокировки ElevenLabs.

## Деплой на Render

### Вариант 1: Через Dashboard

1. Создай новый **Web Service** на [render.com](https://render.com)
2. Подключи этот репозиторий (или создай отдельный)
3. Настройки:
   - **Root Directory**: `ws-proxy` (если в том же репозитории)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Starter ($7/мес) - обязательно для WebSocket!

4. После деплоя получишь URL вида: `https://elevenlabs-ws-proxy.onrender.com`

### Вариант 2: Через Blueprint

1. Создай отдельный репозиторий с файлами из этой папки
2. Нажми "New" → "Blueprint" на Render
3. Подключи репозиторий
4. Render автоматически прочитает `render.yaml`

## Использование

WebSocket URL для подключения:
```
wss://YOUR-SERVICE.onrender.com?url=ENCODED_SIGNED_URL
```

Пример:
```javascript
const signedUrl = 'wss://api.elevenlabs.io/...'; // от ElevenLabs API
const proxyUrl = `wss://elevenlabs-ws-proxy.onrender.com?url=${encodeURIComponent(signedUrl)}`;

const ws = new WebSocket(proxyUrl);
```

## Health Check

```bash
curl https://YOUR-SERVICE.onrender.com/health
```

## Важно

- **Минимум Starter план** - бесплатный план отключает WebSocket через 5 минут
- Первый запрос может быть медленным (cold start ~30 сек)
- Для продакшена рекомендуется Standard план ($25/мес) для лучшего uptime
