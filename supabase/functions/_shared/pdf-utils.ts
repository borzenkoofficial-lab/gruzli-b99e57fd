// Shared utilities for PDF generation (Cyrillic font URLs, money formatting, num→words)

// PT Sans TTF with full Cyrillic + ruble sign (₽) — works reliably with pdf-lib + fontkit
export const FONT_REGULAR_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ptsans/PTSans-Regular.ttf";
export const FONT_BOLD_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ptsans/PTSans-Bold.ttf";

export async function loadFontBuf(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Font load failed: ${url} (${r.status})`);
  return await r.arrayBuffer();
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

// === Russian num→words for rubles & kopeks ===
const UNITS_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const UNITS_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function pluralRu(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

function tripletToWords(n: number, female: boolean): string {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  if (h) out.push(HUNDREDS[h]);
  if (t === 1) {
    out.push(TEENS[u]);
  } else {
    if (t) out.push(TENS[t]);
    if (u) out.push(female ? UNITS_F[u] : UNITS_M[u]);
  }
  return out.join(" ");
}

export function rublesToWords(amount: number): string {
  const rub = Math.floor(Math.abs(amount));
  const kop = Math.round((Math.abs(amount) - rub) * 100);

  if (rub === 0) {
    return `ноль рублей ${String(kop).padStart(2, "0")} копеек`;
  }

  const billions = Math.floor(rub / 1_000_000_000);
  const millions = Math.floor((rub % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((rub % 1_000_000) / 1000);
  const units = rub % 1000;

  const parts: string[] = [];
  if (billions) parts.push(`${tripletToWords(billions, false)} ${pluralRu(billions, ["миллиард", "миллиарда", "миллиардов"])}`);
  if (millions) parts.push(`${tripletToWords(millions, false)} ${pluralRu(millions, ["миллион", "миллиона", "миллионов"])}`);
  if (thousands) parts.push(`${tripletToWords(thousands, true)} ${pluralRu(thousands, ["тысяча", "тысячи", "тысяч"])}`);
  if (units) parts.push(tripletToWords(units, false));

  const rubWord = pluralRu(rub, ["рубль", "рубля", "рублей"]);
  const kopWord = pluralRu(kop, ["копейка", "копейки", "копеек"]);
  const text = `${parts.join(" ").trim()} ${rubWord} ${String(kop).padStart(2, "0")} ${kopWord}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fmtDate(d: Date): string {
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
export function fmtDateTime(d: Date): string {
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Russian month names (genitive case for "от 5 января 2026 г.")
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export function fmtDateLong(d: Date): string {
  return `«${String(d.getDate()).padStart(2, "0")}» ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()} г.`;
}

// Build a complete legal contract body. Includes job title + amount.
export function buildLegalContractBody(opts: {
  jobTitle: string;
  jobAddress?: string;
  startTime?: string;
  durationHours?: number;
  hourlyRate?: number;
  workersNeeded?: number;
  amount: number;
  hours: number;
  dispatcherName: string;
  workerName: string;
  customBody?: string;
}): string {
  const {
    jobTitle, jobAddress, startTime, durationHours, hourlyRate,
    amount, hours, dispatcherName, workerName, customBody,
  } = opts;

  const startStr = startTime ? fmtDateTime(new Date(startTime)) : "по согласованию сторон";
  const dur = durationHours ? `${durationHours} ч` : "по факту";
  const rate = hourlyRate ? `${fmtMoney(hourlyRate)} ₽/час` : "по договорённости";
  const total = `${fmtMoney(amount)} (${rublesToWords(amount)}) ₽`;

  const sections = [
    `1. ПРЕДМЕТ ДОГОВОРА`,
    `1.1. Исполнитель обязуется по заданию Заказчика выполнить работы (оказать услуги): «${jobTitle}»${jobAddress ? ` по адресу: ${jobAddress}` : ""}, а Заказчик обязуется принять результат работ и оплатить его в порядке, предусмотренном настоящим договором.`,
    `1.2. Срок выполнения работ: ${startStr}. Плановая длительность: ${dur}.`,
    ``,
    `2. ПРАВА И ОБЯЗАННОСТИ СТОРОН`,
    `2.1. Исполнитель обязуется выполнить работы лично, качественно и в установленный срок, соблюдая требования безопасности труда.`,
    `2.2. Заказчик обязуется обеспечить Исполнителю необходимые условия для выполнения работ и своевременно произвести оплату.`,
    `2.3. Исполнитель несёт ответственность за сохранность переданного ему имущества Заказчика в период выполнения работ.`,
    `2.4. Стороны обязуются не разглашать конфиденциальную информацию, ставшую им известной в ходе исполнения договора.`,
    ``,
    `3. ЦЕНА И ПОРЯДОК РАСЧЁТОВ`,
    `3.1. Стоимость работ определяется из расчёта ставки ${rate}${hours ? ` за фактически отработанное время (${hours} ч)` : ""}.`,
    `3.2. Итоговая стоимость работ по настоящему договору составляет: ${total}.`,
    `3.3. Оплата производится после подписания Сторонами акта выполненных работ путём перевода денежных средств на счёт Исполнителя или иным согласованным способом в течение 3 (трёх) рабочих дней.`,
    `3.4. Исполнитель, являющийся плательщиком налога на профессиональный доход (самозанятым), самостоятельно формирует и передаёт Заказчику чек в порядке, установленном Федеральным законом № 422-ФЗ.`,
    ``,
    `4. ОТВЕТСТВЕННОСТЬ СТОРОН`,
    `4.1. За неисполнение или ненадлежащее исполнение обязательств Стороны несут ответственность в соответствии с действующим законодательством РФ.`,
    `4.2. В случае нарушения сроков оплаты Заказчик уплачивает Исполнителю пени в размере 0,1% от неоплаченной суммы за каждый день просрочки.`,
    `4.3. Исполнитель не несёт ответственности за неисполнение обязательств вследствие действия обстоятельств непреодолимой силы.`,
    ``,
    `5. ПРИЁМКА РАБОТ`,
    `5.1. По завершении работ Стороны подписывают акт выполненных работ. При наличии замечаний они указываются в акте и устраняются Исполнителем в согласованный срок.`,
    `5.2. При отсутствии письменных замечаний в течение 1 (одного) рабочего дня с момента завершения работы считаются принятыми Заказчиком в полном объёме.`,
    ``,
    `6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ`,
    `6.1. Договор вступает в силу с момента его подписания Сторонами и действует до полного исполнения обязательств.`,
    `6.2. Все споры решаются путём переговоров; при недостижении согласия — в судебном порядке по месту нахождения Заказчика.`,
    `6.3. Договор составлен в электронной форме и подписан Сторонами с использованием простой электронной подписи в сервисе Gruzli, что в силу ст. 6 Федерального закона № 63-ФЗ «Об электронной подписи» признаётся равнозначным документу на бумажном носителе.`,
    `6.4. Стороны: Заказчик — ${dispatcherName || "—"}; Исполнитель — ${workerName || "—"}.`,
  ];

  if (customBody && customBody.trim()) {
    sections.push(``, `7. ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ`, customBody.trim());
  }
  return sections.join("\n");
}
