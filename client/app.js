const apiBaseUrl = window.COINICAP_CONFIG.apiBaseUrl.replace(/\/$/, "");
const quotesBody = document.querySelector("#quotes");
const connectionState = document.querySelector("#connection-state");
const updatedAt = document.querySelector("#updated-at");

function safeCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function renderQuotes(quotes) {
  quotesBody.replaceChildren();
  if (!quotes.length) {
    quotesBody.innerHTML = '<tr><td colspan="11" class="text-center text-secondary py-5">هنوز داده‌ای ثبت نشده است.</td></tr>';
    return;
  }
  for (const quote of quotes) {
    const row = document.createElement("tr");
    row.append(
      safeCell(quote.exchange_name || quote.exchange),
      safeCell(quote.market),
      safeCell(quote.timeframe),
      safeCell(quote.price ?? "—"),
      safeCell(quote.open_price ?? "—"),
      safeCell(quote.close_price ?? "—"),
      safeCell(quote.volume ?? "—"),
      safeCell(quote.top_price ?? "—"),
      safeCell(quote.low_price ?? "—"),
      safeCell(new Date(quote.collected_at_ms).toLocaleTimeString("fa-IR")),
      safeCell(quote.age_ms < 10 * 60 * 1000 ? "به‌روز" : "قدیمی")
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
    connectionState.textContent = "متصل";
    updatedAt.textContent = `دریافت صفحه: ${new Date().toLocaleTimeString("fa-IR")}`;
  } catch {
    connectionState.className = "badge text-bg-danger";
    connectionState.textContent = "API در دسترس نیست";
    quotesBody.innerHTML = '<tr><td colspan="11" class="text-center text-danger py-5">ارتباط با API برقرار نشد.</td></tr>';
  }
}

loadQuotes();
setInterval(loadQuotes, 60_000);
