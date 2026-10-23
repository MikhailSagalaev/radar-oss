# Contributing to Open Radar / Руководство контрибьютора

[English](#english) | [Русский](#русский)

---

<a name="english"></a>
## English

Thanks for taking a look. Open Radar is an open-source decentralized library of jobs (`job`) and gigs (`gig`) curated by community intelligence and free of paywalls, spam, and paid response fees.

The bar for a useful contribution is straightforward: one working adapter, one fixture, one test.

### Quick Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env

# 3. Verify tests and TypeScript types
pnpm test
pnpm typecheck
```

Node.js 22+ and pnpm 10+ are required. The test suite uses an in-memory store (or PostgreSQL with pgvector when `RADAR_TEST_STORE=postgres` is set) and never calls the network in unit tests: adapters are tested against fixtures.

### Adding a New Source Connector in 3 Steps

We provide a built-in scaffold generator to make adding new sources fast and painless:

#### Step 1: Run the generator
```bash
pnpm new:connector <source_name>
```
Example: `pnpm new:connector remotejobs`

This automatically generates:
1. `src/sources/adapters/<source_name>.ts` — Clean boilerplate adapter implementing `SourceAdapter`.
2. `test/fixtures/<source_name>.json` — Sample sanitized response fixture.
3. `test/sources/<source_name>.test.ts` — Ready-to-run vitest unit test.

#### Step 2: Implement extraction
Edit `src/sources/adapters/<source_name>.ts`:
- Fetch data safely via `fetchText(ctx, url, headers)` or API client.
- Extract structured fields: `title`, `text`, `url`, `budget`, `currency`, `skills`, `city`, `isRemote`.
- Set lead `type`: `'job'` (permanent / full-time role) or `'gig'` (freelance / project task).
- Always apply `sanitizePrivacy(rawText)` to ensure privacy compliance (strips phone numbers and personal emails).

#### Step 3: Verify and open a Pull Request
```bash
pnpm test
pnpm typecheck
```
Submit your Pull Request with a short description of the source and a sample parsed item.

### Code Style & Guidelines
- **Zero Emoji Doctrine:** No emojis in user interfaces, logs, or commit messages.
- **Strict TypeScript:** No implicit `any`, 0 type errors.
- **Privacy First (152-FZ / GDPR):** Never store raw phone numbers or personal emails.
- **Polite Crawling:** Respect rate limits, set descriptive `User-Agent`, handle non-200 responses gracefully without throwing unhandled exceptions.

---

<a name="русский"></a>
## Русский

Open Radar — открытая библиотека вакансий (`job`) и заказов (`gig`), где качество данных регулируется коллективным отбором сообщества без платных откликов и накруток.

Мы приветствуем добавление коннекторов к открытым площадкам, биржам, каналам и открытым API.

### Быстрый запуск для разработки

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm typecheck
```

Для локального запуска веб-интерфейса:
```bash
docker compose up -d postgres
pnpm dev -- serve
```
Интерфейс откроется по адресу `http://localhost:8787`.

### Создание нового коннектора за 3 шага

#### Шаг 1. Запустите генератор каркаса
```bash
pnpm new:connector <название_источника>
```
Например: `pnpm new:connector devjobs`

Команда автоматически создаст:
1. `src/sources/adapters/devjobs.ts` — каркас адаптера с реализацией интерфейса `SourceAdapter`.
2. `test/fixtures/devjobs.json` — пример сырого ответа источника для тестов.
3. `test/sources/devjobs.test.ts` — юнит-тест, проверяющий корректность извлечения данных.

#### Шаг 2. Реализуйте логику парсинга
Откройте созданный файл `src/sources/adapters/devjobs.ts`:
- Загрузите данные через `fetchText(ctx, url, headers)`.
- Заполните поля `RawLead`: заголовок, текст, ссылка, вилка бюджета, стек, город, формат (удалёнка или офис).
- Укажите тип: `'job'` (вакансия в штат) или `'gig'` (проектный заказ).
- Обязательно примените функцию `sanitizePrivacy(text)` для скрытия персональных контактов.

#### Шаг 3. Проверьте тесты и отправьте PR
```bash
pnpm test
pnpm typecheck
```
Создайте Pull Request на GitHub. Мы оперативно проверяем и объединяем коннекторы. Спасибо за вклад в открытый интернет!
