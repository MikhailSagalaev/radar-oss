/**
 * OpenRadar - Currency and Salary Normalization Engine
 * Handles multi-currency salaries, period extraction (monthly/hourly/fixed),
 * and conversion to canonical USD base for unified filtering and sorting.
 */

export type PaymentPeriod = 'monthly' | 'hourly' | 'fixed';

export interface SalaryInfo {
  paymentPeriod: PaymentPeriod;
  rawSalary?: string;
  normalizedUsdMin?: number;
  normalizedUsdMax?: number;
  currency: string;
}

// Baseline exchange rates against 1 USD (updated reference)
const FX_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.28,
  RUB: 1 / 92.0,
  RUR: 1 / 92.0,
  KZT: 1 / 480.0,
  BYN: 1 / 3.25,
  UAH: 1 / 41.5,
  USDT: 1.0,
  USDC: 1.0,
};

export function detectPaymentPeriod(text: string, defaultType: 'job' | 'gig' = 'gig'): PaymentPeriod {
  const lower = text.toLowerCase();

  if (
    lower.includes('/час') ||
    lower.includes('в час') ||
    lower.includes('за час') ||
    lower.includes('per hour') ||
    lower.includes('/hr') ||
    lower.includes('$/h') ||
    lower.includes('hourly')
  ) {
    return 'hourly';
  }

  if (
    lower.includes('за проект') ||
    lower.includes('за заказ') ||
    lower.includes('за весь проект') ||
    lower.includes('под ключ') ||
    lower.includes('fixed') ||
    lower.includes('фикс')
  ) {
    return 'fixed';
  }

  if (
    lower.includes('/мес') ||
    lower.includes('в месяц') ||
    lower.includes('за месяц') ||
    lower.includes('monthly') ||
    lower.includes('оклад') ||
    lower.includes('/mo')
  ) {
    return 'monthly';
  }

  return defaultType === 'job' ? 'monthly' : 'fixed';
}

export function detectCurrency(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('$') || lower.includes('usd') || lower.includes('долл') || lower.includes('usdt')) {
    return 'USD';
  }
  if (lower.includes('€') || lower.includes('eur') || lower.includes('евро')) {
    return 'EUR';
  }
  if (lower.includes('£') || lower.includes('gbp')) {
    return 'GBP';
  }
  if (lower.includes('тенге') || lower.includes('kzt') || lower.includes('₸')) {
    return 'KZT';
  }
  if (lower.includes('бел') || lower.includes('byn')) {
    return 'BYN';
  }
  if (lower.includes('грн') || lower.includes('uah') || lower.includes('₴')) {
    return 'UAH';
  }
  return 'RUB';
}

export function parseSalaryRange(text: string): { min?: number; max?: number } {
  // Strip currency symbols in front of digits, e.g. $3000 -> 3000
  const clean = text.replace(/[$€₽£₸₴]/g, ' ').replace(/\s+/g, ' ');

  // Match pattern "от X до Y" or "X - Y"
  const rangeMatch = clean.match(/(?:от\s+)?(\d[\d\s.,]*\d|\d+)\s*(?:-|до|—|–)\s*(\d[\d\s.,]*\d|\d+)/i);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const rawMin = rangeMatch[1].replace(/[\s,]+/g, '');
    const rawMax = rangeMatch[2].replace(/[\s,]+/g, '');
    const min = parseFloat(rawMin);
    const max = parseFloat(rawMax);
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return { min, max };
    }
  }

  // Single number preceded by "от"
  const fromMatch = clean.match(/(?:от\s+)(\d[\d\s.,]*\d|\d+)/i);
  if (fromMatch && fromMatch[1]) {
    const min = parseFloat(fromMatch[1].replace(/[\s,]+/g, ''));
    if (!Number.isNaN(min)) return { min };
  }

  // Single number preceded by "до"
  const toMatch = clean.match(/(?:до\s+)(\d[\d\s.,]*\d|\d+)/i);
  if (toMatch && toMatch[1]) {
    const max = parseFloat(toMatch[1].replace(/[\s,]+/g, ''));
    if (!Number.isNaN(max)) return { max };
  }

  // Single number with currency sign or marker
  const singleMatch = clean.match(/(\d[\d\s.,]*\d|\d+)\s*(?:₽|руб|usd|\$|eur|€|kzt|byn|uah)/i);
  if (singleMatch && singleMatch[1]) {
    const val = parseFloat(singleMatch[1].replace(/[\s,]+/g, ''));
    if (!Number.isNaN(val)) return { min: val, max: val };
  }

  return {};
}

export function normalizeSalary(input: {
  text?: string;
  rawSalary?: string;
  budget?: number;
  currency?: string;
  type?: 'job' | 'gig';
}): SalaryInfo {
  const combinedText = `${input.rawSalary ?? ''} ${input.text ?? ''}`.trim();
  const period = detectPaymentPeriod(combinedText, input.type ?? 'gig');
  const currency = (input.currency?.toUpperCase() || detectCurrency(combinedText)).trim();
  const rate = FX_TO_USD[currency] ?? (1 / 92.0);

  let min = input.budget;
  let max = input.budget;

  if (input.rawSalary || combinedText) {
    const parsed = parseSalaryRange(input.rawSalary || combinedText);
    if (parsed.min !== undefined) min = parsed.min;
    if (parsed.max !== undefined) max = parsed.max;
  }

  const normalizedUsdMin = typeof min === 'number' && Number.isFinite(min) && min > 0
    ? Math.round(min * rate)
    : undefined;
  const normalizedUsdMax = typeof max === 'number' && Number.isFinite(max) && max > 0
    ? Math.round(max * rate)
    : undefined;

  return {
    paymentPeriod: period,
    rawSalary: input.rawSalary || (input.budget ? `${input.budget} ${currency}` : undefined),
    normalizedUsdMin,
    normalizedUsdMax,
    currency,
  };
}
