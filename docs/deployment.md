# استقرار مستقل UI و API

تا زمانی که مالک پروژه صریحاً شروع پایلوت را اعلام نکرده، دیتابیس پایدار ایجاد، initialize یا تغییر داده نمی‌شود. قبل از شروع پایلوت نیز اجرای bootstrap فقط برای D1 خالی مجاز است.

## API روی Cloudflare Workers

برای آماده‌سازی کد، `cd server && npm install` کافی است. ایجاد دیتابیس و اجرای Worker به D1 نیاز دارد؛ تا پیش از شروع پایلوت این کار را انجام نده.

فقط پس از آنکه مالک پروژه شروع پایلوت و مقداردهی دیتابیس را تأیید کرد:

1. ورود به Cloudflare با `npx wrangler login`.
2. ساخت دیتابیس خالی با `npx wrangler d1 create coinicap-markets` و قراردادن شناسه در `server/wrangler.jsonc`.
3. از پوشهٔ `server/` اجرای یک‌بارهٔ `npx wrangler d1 execute coinicap-markets --file=db/bootstrap.sql --remote`.
4. از پوشهٔ `server/` اجرا: `npm run deploy`.

Bootstrap را روی دیتابیس دارای داده اجرا نکن. قبل از هر تغییر بعدی در schema، نگهداری، حذف یا backfill داده، ابتدا از مالک تأیید بگیر و برنامهٔ امن ارائه کن.

بعد از deploy، آدرس Worker را در `client/config.js` بگذار.

## UI روی Cloudflare Pages

پروژهٔ Pages را به GitHub وصل کن، مسیر خروجی را `client/` قرار بده و build command نگذار؛ یا از ریشهٔ مخزن اجرا کن: `npx wrangler pages deploy client --project-name coinicap-markets-ui`.

API و UI دو deployment مستقل دارند. CORS فعلاً عمومی است چون API فقط GET عمومی می‌دهد. اگر API خصوصی یا دارای حساب کاربری شد، originهای مجاز و دسترسی را محدود کن و از wildcard به همراه credentials استفاده نکن.
