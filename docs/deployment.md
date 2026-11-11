# استقرار مستقل UI و API

## API روی Cloudflare Workers

1. Node.js و npm نصب باشد؛ `cd server && npm install`.
2. ورود به Cloudflare با `npx wrangler login`.
3. ساخت دیتابیس با `npx wrangler d1 create coinicap-markets` و قراردادن شناسه در `server/wrangler.jsonc`.
4. اعمال migration روی محیط راه‌دور: `npx wrangler d1 migrations apply coinicap-markets --remote`.
5. از پوشهٔ `server/` اجرا: `npm run deploy`.

بعد از deploy، آدرس Worker را در `client/config.js` بگذار.

## UI روی Cloudflare Pages

پروژهٔ Pages را به GitHub وصل کن، مسیر خروجی را `client/` قرار بده و build command نگذار؛ یا از ریشهٔ مخزن اجرا کن: `npx wrangler pages deploy client --project-name coinicap-markets-ui`.

API و UI دو deployment مستقل دارند. CORS فعلاً عمومی است چون API فقط GET عمومی می‌دهد. اگر API خصوصی یا دارای حساب کاربری شد، originهای مجاز و دسترسی را محدود کن و از wildcard به همراه credentials استفاده نکن.
