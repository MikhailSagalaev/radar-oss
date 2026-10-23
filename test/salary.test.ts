import { describe, expect, it } from 'vitest';
import {
  detectCurrency,
  detectPaymentPeriod,
  normalizeSalary,
  parseSalaryRange,
} from '../src/core/salary.ts';

describe('salary & currency normalization', () => {
  it('detects period correctly from job/gig context and keywords', () => {
    expect(detectPaymentPeriod('Ставка 2 500 руб/час на разработку')).toBe('hourly');
    expect(detectPaymentPeriod('Фиксированная оплата за проект 100 000 руб')).toBe('fixed');
    expect(detectPaymentPeriod('Оклад 250 000 в месяц')).toBe('monthly');
    expect(detectPaymentPeriod('Разработка сайта', 'gig')).toBe('fixed');
    expect(detectPaymentPeriod('Senior Java Developer', 'job')).toBe('monthly');
  });

  it('detects currencies accurately', () => {
    expect(detectCurrency('Зарплата $3500')).toBe('USD');
    expect(detectCurrency('Оплата 2500 EUR')).toBe('EUR');
    expect(detectCurrency('Вилка 800 000 тенге')).toBe('KZT');
    expect(detectCurrency('5000 BYN')).toBe('BYN');
    expect(detectCurrency('150 000 рублей')).toBe('RUB');
  });

  it('parses salary ranges', () => {
    expect(parseSalaryRange('от 150 000 до 250 000 руб.')).toEqual({ min: 150000, max: 250000 });
    expect(parseSalaryRange('3000 - 5000 USD')).toEqual({ min: 3000, max: 5000 });
    expect(parseSalaryRange('от 200 000 руб')).toEqual({ min: 200000 });
  });

  it('normalizes salary to canonical USD amounts', () => {
    const res = normalizeSalary({
      rawSalary: 'от 184 000 до 276 000 руб.',
      currency: 'RUB',
      type: 'job',
    });
    expect(res.paymentPeriod).toBe('monthly');
    expect(res.normalizedUsdMin).toBe(2000); // 184000 / 92
    expect(res.normalizedUsdMax).toBe(3000); // 276000 / 92
  });

  it('handles foreign currencies in USD calculation', () => {
    const res = normalizeSalary({
      rawSalary: '$3000 - $4000',
      type: 'job',
    });
    expect(res.currency).toBe('USD');
    expect(res.normalizedUsdMin).toBe(3000);
    expect(res.normalizedUsdMax).toBe(4000);
  });
});
