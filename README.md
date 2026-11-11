# Coinicap Markets

مخزن متن‌باز برای جمع‌آوری قیمت بازارهای صرافی‌های ایرانی و ارائهٔ API تجمیعی. کلاینت و سرور دو برنامه با کد و استقرار مستقل هستند.

## فناوری

- **سرور:** JavaScript ساده روی Cloudflare Workers، با Cron Trigger و D1 (SQLite).
- **کلاینت:** HTML، JavaScript ساده و Bootstrap RTL؛ یک سایت static که فقط REST API را مصرف می‌کند.
- **مستندات:** پوشهٔ `docs/` شامل معماری، دیتابیس، API، OpenAPI و راهنمای استقرار.

JavaScript برای Worker انتخاب شده چون با دانسته‌های فعلی پروژه سازگار است و Cloudflare آن را بومی اجرا می‌کند. مدل Worker بر event loop و عملیات asynchronous بنا شده؛ برای بار فعلی thread سیستم‌عامل لازم نیست. محاسبات CPU سنگین را خارج از Worker نگه می‌داریم.

## جداسازی کلاینت و سرور

`server/` و `client/` برنامه‌های مستقل‌اند. API در `server/` روی Workers منتشر می‌شود؛ سایت استاتیک در `client/` روی Pages یا هر میزبانی static. کلاینت نشانی API را از `client/config.js` می‌گیرد و فقط با REST API حرف می‌زند. API فعلاً CORS عمومی برای خواندن دارد.

## طراحی داده

Migration اولیه بازارهای `BTCTMN`, `BTCUSDT`, `ETHUSDT`, `ETHTMN`, `BNBTMN`, `BNBUSDT`, `TRXUSDT`, `TRXTMN`, `USDTTMN`, `USDCTMN` را تعریف می‌کند. رکورد صرافی‌ها و نگاشت نمادهای native پس از تعیین صرافی‌های شروع اضافه می‌شوند.

دارایی‌ها و بازارهای canonical در جداول مرجع‌اند؛ `markets.code` نماد خروجی مثل `BTCTMN` است و `exchange_markets.native_symbol` نماد واقعی صرافی مثل `btc-Toman`. این دو هیچ‌وقت جای هم استفاده نمی‌شوند. تنظیمات endpoint، روش/آدرس درخواست، قالب پارامترها و نگاشت JSON پاسخ در `exchange_api_endpoints` ذخیره می‌شود. بازهٔ جمع‌آوری (مثلاً هر ۵ دقیقه) از تایم‌فریم کندل (مثلاً ۱۵ دقیقه یا یک ساعت) جداست؛ نمونه‌های مکرر از یک کندل در `market_data_samples` ثبت می‌شوند. قیمت‌ها به‌صورت رشتهٔ ده‌دهی ذخیره می‌شوند. واحد quote و volume باید برای هر API مشخص شود. جزئیات در [طرح دیتابیس](docs/database.md) است.

## جمع‌آوری، کش و API

Cron هر پنج دقیقه اجرا می‌شود و فقط collector به API صرافی‌ها درخواست می‌فرستد. درخواست کاربران از کش پنج‌دقیقه‌ای پاسخ می‌گیرد؛ cache miss به D1 می‌رود و مستقیماً به صرافی نمی‌رود. خطای یک API نباید آخرین قیمت سالم را پاک کند. Cache API و حافظهٔ isolate موقتی‌اند؛ پس از cache miss، cold start یا تغییر منطقه ممکن است D1 خوانده شود.

مسیرها: `/api/v1/exchanges`, `/api/v1/markets`, `/api/v1/timeframes`, `/api/v1/quotes/latest`, `/api/v1/quotes/series`, `/api/v1/estimates/usdt-tmn` (فعلاً `not_configured`) و `/health`. API قیمت، Open، Close، Volume، TopPrice/High و LowPrice را با تایم‌فریم و زمان‌های منبع/جمع‌آوری می‌دهد. قرارداد کامل در [API](docs/api.md) و [OpenAPI](docs/openapi.yaml) است.

## محدودیت‌های پلن رایگان فعلی

Workers Free فعلاً ۱۰۰٬۰۰۰ درخواست ورودی روزانه، ۱۰ میلی‌ثانیه CPU برای هر اجرا و ۵۰ درخواست خروجی در هر اجرا دارد. D1 شامل ۵ میلیون ردیف خواندن روزانه، ۱۰۰٬۰۰۰ ردیف نوشتن روزانه و ۵ گیگابایت ذخیره‌سازی است؛ ایندکس‌ها هم مصرف نوشتن دارند. با ۵ صرافی و ۱۰ بازار، دادهٔ خام حدود ۱۴٬۴۰۰ مشاهده در روز می‌شود؛ مصرف واقعی باید پس از ساخت adapterها پایش شود. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

همچنین: [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) · [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## شروع محلی

API: پیش‌نیاز Node.js و npm.

```sh
cd server
npm install
npx wrangler d1 create coinicap-markets
```

شناسهٔ دیتابیس را در `server/wrangler.jsonc` بگذار، سپس:

```sh
npx wrangler d1 migrations apply coinicap-markets --local
npm run dev
```

UI را در ترمینال دیگری اجرا کن:

```sh
cd client
python -m http.server 8080
```

`client/config.js` به‌طور پیش‌فرض API محلی `http://localhost:8787` را نشانه می‌گیرد. کلاینت و API جداگانه deploy می‌شوند؛ دستورها در [راهنمای deploy](docs/deployment.md) هستند.

## وضعیت فعلی

ساختار JavaScript، schema، مسیرهای اولیهٔ API، کش و UI سادهٔ جداگانه حاضرند. Migration دوم مدل OHLCV، تایم‌فریم‌های مستقل، تنظیمات داینامیک API و اطلاعات صرافی را اضافه می‌کند. Adapterهای واقعی، collector فعال، محاسبهٔ واقعی USDT/TMN و UI نهایی بعد از انتخاب صرافی‌های شروع کامل می‌شوند.
