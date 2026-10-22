import type { SourceConfig, SourceKind } from '../core/types.ts';

export interface SourcePreset {
  id: string;
  kind: SourceKind;
  title: string;
  description: string;
  config: SourceConfig;
}

export const SOURCE_PRESETS: SourcePreset[] = [
  {
    id: 'fl-all',
    kind: 'rss',
    title: 'FL.ru — Все заказы',
    description: 'Официальный RSS-фид всех новых проектов и заказов биржи FL.ru',
    config: {
      url: 'https://www.fl.ru/rss/all.xml',
    },
  },
  {
    id: 'fl-webdev',
    kind: 'rss',
    title: 'FL.ru — Разработка сайтов',
    description: 'RSS-фид категории «Веб-разработка и программирование» на FL.ru',
    config: {
      url: 'https://www.fl.ru/rss/all.xml?category=5',
    },
  },
  {
    id: 'habr-career',
    kind: 'rss',
    title: 'Хабр Карьера — Вакансии и заказы',
    description: 'Официальный RSS-фид удаленной проектной работы и вакансий Хабр Карьеры',
    config: {
      url: 'https://career.habr.com/vacancies/rss',
    },
  },
  {
    id: 'kwork-dev',
    kind: 'kwork',
    title: 'Kwork — Разработка и IT',
    description: 'Биржа Kwork: заказы на бирже в категории «Разработка и IT» (нативный парсер)',
    config: {
      categoryId: '11',
    },
  },
  {
    id: 'tg-freelance',
    kind: 'telegram',
    title: 'Telegram — @freelance_orders',
    description: 'Публичный Telegram-канал с заказами фриланса (чтение через t.me/s/)',
    config: {
      channel: 'freelance_orders',
    },
  },
  {
    id: 'weworkremotely',
    kind: 'rss',
    title: 'We Work Remotely — Dev Projects',
    description: 'Международный RSS-фид удаленных контрактов и задач по программированию',
    config: {
      url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
    },
  },
];
