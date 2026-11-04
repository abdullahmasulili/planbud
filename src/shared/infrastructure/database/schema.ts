/** Current on-device schema; backup payload versions are validated independently. */
export const SCHEMA_VERSION = 2;

/** Constrains monetary/revision columns to exact JavaScript-compatible integers.
 * @param name Trusted column identifier authored in this schema.
 * @param minimum Smallest permitted value.
 * @returns A SQLite CHECK expression for that column.
 */
const safeInteger = (name: string, minimum = 0) =>
  `CHECK(typeof(${name}) = 'integer' AND ${name} >= ${minimum} AND ${name} <= ${Number.MAX_SAFE_INTEGER})`;

/** Validates stored calendar dates using SQLite's Gregorian normalization.
 * @param name Trusted date column identifier.
 * @returns A constraint rejecting malformed and impossible dates.
 */
const calendarDate = (name: string) =>
  `CHECK(length(${name}) = 10 AND ${name} >= '0001-01-01' AND date(${name}, '+0 days') IS NOT NULL AND date(${name}, '+0 days') = ${name})`;

export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  id TEXT NOT NULL UNIQUE CHECK(length(id) BETWEEN 1 AND 100),
  currency_code TEXT NOT NULL CHECK(length(currency_code) = 3),
  currency_exponent INTEGER NOT NULL CHECK(currency_exponent BETWEEN 0 AND 4),
  locale TEXT NOT NULL,
  appearance TEXT NOT NULL CHECK(appearance IN ('system', 'light', 'dark'))
);
CREATE TABLE IF NOT EXISTS app_metadata (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  revision INTEGER NOT NULL DEFAULT 0 ${safeInteger('revision')},
  recovery_generation TEXT,
  recovery_fingerprint TEXT,
  recovery_status TEXT,
  CHECK((recovery_generation IS NULL AND recovery_fingerprint IS NULL AND recovery_status IS NULL)
    OR (recovery_generation IS NOT NULL AND recovery_fingerprint IS NOT NULL AND recovery_status IN ('pending', 'ready')))
);
INSERT OR IGNORE INTO app_metadata(singleton, revision) VALUES (1, 0);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 100),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  kind TEXT NOT NULL CHECK(kind IN ('essential', 'flexible')),
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1))
);
CREATE TABLE IF NOT EXISTS monthly_plans (
  month TEXT PRIMARY KEY NOT NULL CHECK(length(month) = 7),
  planned_income INTEGER NOT NULL ${safeInteger('planned_income')}
);
CREATE TABLE IF NOT EXISTS category_limits (
  month TEXT NOT NULL REFERENCES monthly_plans(month) ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL ${safeInteger('amount')},
  PRIMARY KEY(month, category_id)
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 100),
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  amount INTEGER NOT NULL ${safeInteger('amount', 1)},
  record_date TEXT NOT NULL ${calendarDate('record_date')},
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 2000),
  CHECK((type = 'income' AND category_id IS NULL) OR (type = 'expense' AND category_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS transactions_month ON transactions(substr(record_date, 1, 7), record_date, id);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 100),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  target_amount INTEGER NOT NULL ${safeInteger('target_amount', 1)},
  starting_saved INTEGER NOT NULL ${safeInteger('starting_saved')},
  deadline TEXT,
  priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')),
  desired_monthly INTEGER CHECK(desired_monthly IS NULL OR (typeof(desired_monthly) = 'integer' AND desired_monthly > 0 AND desired_monthly <= ${Number.MAX_SAFE_INTEGER})),
  goal_state TEXT NOT NULL CHECK(goal_state IN ('active', 'completed', 'archived'))
);
CREATE TABLE IF NOT EXISTS goal_contributions (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 100),
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL ${safeInteger('amount', 1)},
  record_date TEXT NOT NULL ${calendarDate('record_date')}
);
CREATE INDEX IF NOT EXISTS contributions_month ON goal_contributions(substr(record_date, 1, 7), goal_id);
CREATE TABLE IF NOT EXISTS goal_allocations (
  month TEXT NOT NULL REFERENCES monthly_plans(month) ON DELETE RESTRICT,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL ${safeInteger('amount')},
  PRIMARY KEY(month, goal_id)
);
CREATE TABLE IF NOT EXISTS commands (
  operation_id TEXT PRIMARY KEY NOT NULL CHECK(length(operation_id) BETWEEN 1 AND 100),
  action TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL
);
`;

/** Schema 2 adds independent planning estimates while retaining every original source table. */
export const NAMED_PLAN_SCHEMA = `
CREATE TABLE IF NOT EXISTS named_plans (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 100),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  funding INTEGER NOT NULL ${safeInteger('funding')}
);
CREATE TABLE IF NOT EXISTS named_plan_items (
  plan_id TEXT NOT NULL REFERENCES named_plans(id) ON DELETE RESTRICT,
  id TEXT NOT NULL CHECK(length(id) BETWEEN 1 AND 100),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  amount INTEGER NOT NULL ${safeInteger('amount')},
  position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 99),
  PRIMARY KEY(plan_id,id),
  UNIQUE(plan_id,position)
);
`;
