const apiBaseUrl = window.COINICAP_CONFIG.apiBaseUrl.replace(/\/$/, "");
const translations = {
  fa: {
    title: "بازارها", subtitle: "قیمت‌های تجمیعی از صرافی‌های ایرانی", connecting: "در حال اتصال",
    latest: "آخرین قیمت‌ها", exchange: "صرافی", type: "نوع", market: "نماد خروجی",
    timeframe: "تایم‌فریم", sampleTime: "زمان نمونه", status: "وضعیت", loading: "دریافت اطلاعات…",
    apiNote: "API مستقل است؛ نشانی آن در فایل config.js تنظیم می‌شود.", empty: "هنوز داده‌ای ثبت نشده است.",
    connected: "متصل", unavailable: "API در دسترس نیست", connectionError: "ارتباط با API برقرار نشد.",
    fresh: "به‌روز", stale: "قدیمی", cex: "متمرکز (CEX)", otc: "معامله مستقیم (OTC)", hybrid: "ترکیبی"
  },
  en: {
    title: "Markets", subtitle: "Aggregated prices from Iranian exchanges", connecting: "Connecting",
    latest: "Latest prices", exchange: "Exchange", type: "Type", market: "Output symbol",
    timeframe: "Timeframe", sampleTime: "Sample time", status: "Status", loading: "Loading data…",
    apiNote: "The API is separate; set its URL in config.js.", empty: "No data has been recorded yet.",
    connected: "Connected", unavailable: "API unavailable", connectionError: "Could not connect to the API.",
    fresh: "Fresh", stale: "Stale", cex: "Centralized (CEX)", otc: "Over-the-counter (OTC)", hybrid: "Hybrid"
  }
};

const quotesBody = document.querySelector("#quotes");
const connectionState = document.querySelector("#connection-state");
const updatedAt = document.querySelector("#updated-at");
let language = localStorage.getItem("coinicap-language") || "fa";
if (!translations[language]) language = "fa";
let latestQuotes = [];

function t(key) { return translations[language][key] || key; }

function setLanguage(nextLanguage) {
  language = nextLanguage;
  localStorage.setItem("coinicap-language", language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelector("#language-toggle").textContent = language === "fa" ? "English" : "فارسی";
  if (latestQuotes.length) renderQuotes(latestQuotes);
  if (connectionState.dataset.state === "connected") connectionState.textContent = t("connected");
  if (connectionState.dataset.state === "unavailable") connectionState.textContent = t("unavailable");
}

function safeCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "—";
  return cell;
}

function renderQuotes(quotes) {
  latestQuotes = quotes;
  quotesBody.replaceChildren();
  if (!quotes.length) {
    const row = document.createElement("tr");
    const cell = safeCell(t("empty"));
    cell.colSpan = 12;
    cell.className = "text-center text-secondary py-5";
    row.append(cell);
    quotesBody.append(row);
    return;
  }
  for (const quote of quotes) {
    const row = document.createElement("tr");
    const exchangeName = language === "fa" ? quote.exchange_name_fa : quote.exchange_name_en;
    const exchangeType = t(quote.exchange_type || "cex");
    const age = Number(quote.age_ms || 0);
    row.append(
      safeCell(exchangeName || quote.exchange_name || quote.exchange), safeCell(exchangeType),
      safeCell(quote.market), safeCell(quote.timeframe), safeCell(quote.price),
      safeCell(quote.open_price), safeCell(quote.close_price), safeCell(quote.volume),
      safeCell(quote.top_price), safeCell(quote.low_price),
      safeCell(new Date(quote.collected_at_ms).toLocaleTimeString(language === "fa" ? "fa-IR" : "en-US")),
      safeCell(age < 10 * 60 * 1000 ? t("fresh") : t("stale"))
    );
    quotesBody.append(row);
  }
}

async function loadQuotes() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/quotes/latest`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    renderQuotes(await response.json());
    connectionState.className = "badge text-bg-success";
    connectionState.dataset.state = "connected";
    connectionState.textContent = t("connected");
    updatedAt.textContent = `${language === "fa" ? "دریافت صفحه" : "Page updated"}: ${new Date().toLocaleTimeString(language === "fa" ? "fa-IR" : "en-US")}`;
  } catch {
    connectionState.className = "badge text-bg-danger";
    connectionState.dataset.state = "unavailable";
    connectionState.textContent = t("unavailable");
    const row = document.createElement("tr");
    const cell = safeCell(t("connectionError"));
    cell.colSpan = 12;
    cell.className = "text-center text-danger py-5";
    row.append(cell);
    quotesBody.replaceChildren(row);
  }
}

document.querySelector("#language-toggle").addEventListener("click", () => {
  setLanguage(language === "fa" ? "en" : "fa");
});
setLanguage(language);
loadQuotes();
setInterval(loadQuotes, 60_000);
