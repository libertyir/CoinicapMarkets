const apiBaseUrl = window.COINICAP_CONFIG.apiBaseUrl.replace(/\/$/, "");
const translations = {
  fa: {
    title: "بازارها", subtitle: "قیمت‌های تجمیعی از صرافی‌های ایرانی", connecting: "در حال اتصال",
    latest: "آخرین قیمت‌ها", exchange: "صرافی", type: "نوع", market: "نماد خروجی",
    timeframe: "تایم‌فریم", sampleTime: "زمان نمونه", status: "وضعیت", loading: "دریافت اطلاعات…",
    aggregateTitle: "میانگین بازارها", indexTitle: "شاخص‌های برآوردی", exchangeIndexTitle: "شاخص هر صرافی",
    componentsTitle: "نرخ‌های محاسباتی هر کوین", scope: "گروه", contributors: "تعداد صرافی",
    direct: "نرخ مستقیم", gap: "اختلاف ٪", index: "شاخص", impliedRate: "نرخ ضمنی",
    assets: "تعداد کوین", asset: "کوین", all: "همهٔ صرافی‌ها",
    noDerivedData: "هنوز دادهٔ محاسباتی ثبت نشده است.",
    apiNote: "API مستقل است؛ نشانی آن در فایل config.js تنظیم می‌شود.", empty: "هنوز داده‌ای ثبت نشده است.",
    connected: "متصل", unavailable: "API در دسترس نیست", connectionError: "ارتباط با API برقرار نشد.",
    fresh: "به‌روز", stale: "قدیمی", cex: "متمرکز (CEX)", otc: "معامله مستقیم (OTC)", hybrid: "ترکیبی"
  },
  en: {
    title: "Markets", subtitle: "Aggregated prices from Iranian exchanges", connecting: "Connecting",
    latest: "Latest prices", exchange: "Exchange", type: "Type", market: "Output symbol",
    timeframe: "Timeframe", sampleTime: "Sample time", status: "Status", loading: "Loading data…",
    aggregateTitle: "Market aggregates", indexTitle: "Calculated indices", exchangeIndexTitle: "Index by exchange",
    componentsTitle: "Per-coin implied rates", scope: "Group", contributors: "Exchanges",
    direct: "Direct rate", gap: "Gap %", index: "Index", impliedRate: "Implied rate",
    assets: "Coins", asset: "Asset", all: "All exchanges",
    noDerivedData: "No calculated data has been recorded yet.",
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
let latestDerived = null;

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
  if (latestDerived) renderDerived(latestDerived);
  if (connectionState.dataset.state === "connected") connectionState.textContent = t("connected");
  if (connectionState.dataset.state === "unavailable") connectionState.textContent = t("unavailable");
}

function addRow(table, values) {
  const row = document.createElement("tr");
  for (const value of values) row.append(safeCell(value));
  table.append(row);
}

function showEmpty(table, columns) {
  const row = document.createElement("tr");
  const cell = safeCell(t("noDerivedData"));
  cell.colSpan = columns;
  cell.className = "text-center text-secondary py-4";
  row.append(cell);
  table.replaceChildren(row);
}

function groupName(type, key) {
  if (type === "all") return t("all");
  if (type === "exchange_type") return t(key);
  return key;
}

function renderDerived(data) {
  const aggregates = document.querySelector("#aggregates");
  const indices = document.querySelector("#indices");
  const exchangeIndices = document.querySelector("#exchange-indices");
  const components = document.querySelector("#components");
  aggregates.replaceChildren();
  indices.replaceChildren();
  exchangeIndices.replaceChildren();
  components.replaceChildren();

  if (!data.aggregates.length) showEmpty(aggregates, 11);
  for (const item of data.aggregates) addRow(aggregates, [
    item.market, groupName(item.scope_type, item.scope_key), item.timeframe, item.price,
    item.high_price, item.low_price, item.open_price, item.close_price,
    item.volume, item.value, item.exchange_count
  ]);

  if (!data.indices.length) showEmpty(indices, 13);
  for (const item of data.indices) addRow(indices, [
    language === "fa" ? item.definition.name_fa : item.definition.name_en,
    groupName(item.scope_type, item.scope_key), item.timeframe, item.index?.price,
    item.index?.high_price, item.index?.low_price, item.index?.open_price,
    item.index?.close_price, item.direct_market?.price, item.gap_percent, item.index?.value,
    item.index?.exchange_count, item.index?.asset_count
  ]);

  if (!data.exchangeIndices.length) showEmpty(exchangeIndices, 10);
  for (const item of data.exchangeIndices) addRow(exchangeIndices, [
    language === "fa" ? item.index_name_fa : item.index_name_en,
    language === "fa" ? item.exchange_name_fa : item.exchange_name_en,
    t(item.exchange_type), item.price, item.high_price, item.low_price,
    item.open_price, item.close_price, item.value, item.asset_count
  ]);

  if (!data.components.length) showEmpty(components, 10);
  for (const item of data.components) addRow(components, [
    language === "fa" ? item.index_name_fa : item.index_name_en,
    language === "fa" ? item.exchange_name_fa : item.exchange_name_en,
    t(item.exchange_type), item.asset, item.timeframe, item.price,
    item.high_price, item.low_price, item.value,
    new Date(Math.max(item.toman_collected_at_ms, item.usdt_collected_at_ms))
      .toLocaleTimeString(language === "fa" ? "fa-IR" : "en-US")
  ]);
}

async function loadDerived() {
  const read = async (path) => {
    const response = await fetch(`${apiBaseUrl}${path}`);
    if (!response.ok) throw new Error("derived_api_unavailable");
    return response.json();
  };
  try {
    const [aggregates, definitions] = await Promise.all([
      read("/api/v1/aggregates/latest?timeframe=5m"), read("/api/v1/indices")
    ]);
    const expanded = await Promise.all(definitions.map(async (definition) => {
      const code = encodeURIComponent(definition.code);
      const [summary, exchanges, components] = await Promise.all([
        read(`/api/v1/indices/${code}?timeframe=5m`),
        read(`/api/v1/indices/${code}?timeframe=5m&type=cex`),
        read(`/api/v1/indices/${code}?timeframe=5m&type=otc`),
        read(`/api/v1/indices/${code}/exchanges?timeframe=5m`),
        read(`/api/v1/indices/${code}/components?timeframe=5m`)
      ]);
      return { definition, summaries: [summary, cex, otc], exchanges, components };
    }));
    latestDerived = {
      aggregates,
      indices: expanded.flatMap(({ definition, summaries }) => summaries.map((summary) => ({
        ...summary, definition
      }))),
      exchangeIndices: expanded.flatMap(({ definition, exchanges }) => exchanges.map((row) => ({
        ...row, index_name_fa: definition.name_fa, index_name_en: definition.name_en
      }))),
      components: expanded.flatMap(({ definition, components }) => components.map((row) => ({
        ...row, index_name_fa: definition.name_fa, index_name_en: definition.name_en
      })))
    };
    renderDerived(latestDerived);
  } catch {
    latestDerived = { aggregates: [], indices: [], exchangeIndices: [], components: [] };
    renderDerived(latestDerived);
  }
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
loadDerived();
setInterval(loadQuotes, 60_000);
setInterval(loadDerived, 60_000);
