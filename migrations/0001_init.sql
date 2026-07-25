-- 家計簿アプリ 初期スキーマ
-- Cloudflare D1 (SQLite) 用

-- 範囲マスタ(個人/世帯など、ユーザーが追加・編集可能)
CREATE TABLE scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- カテゴリマスタ
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT,
    color TEXT NOT NULL DEFAULT '#888888',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 支払い方法マスタ
CREATE TABLE payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 収支トランザクション
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    scope_id INTEGER NOT NULL REFERENCES scopes(id),
    payment_method_id INTEGER REFERENCES payment_methods(id),
    transaction_date TEXT NOT NULL,
    memo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_scope ON transactions(scope_id);
CREATE INDEX idx_transactions_payment_method ON transactions(payment_method_id);

-- 予算(月 × 範囲 × カテゴリ、category_id が NULL ならその範囲全体の予算)
CREATE TABLE budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL,
    scope_id INTEGER NOT NULL REFERENCES scopes(id),
    category_id INTEGER REFERENCES categories(id),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (year_month, scope_id, category_id)
);

-- 初期データ: 範囲マスタ
INSERT INTO scopes (name, sort_order, is_default) VALUES
    ('個人', 1, 1),
    ('世帯', 2, 1);

-- 初期データ: 支払い方法マスタ
INSERT INTO payment_methods (name, icon, sort_order, is_default) VALUES
    ('現金', '💵', 1, 1),
    ('クレジットカード', '💳', 2, 1),
    ('電子マネー', '📱', 3, 1);

-- 初期データ: カテゴリマスタ(最低限の例。メニュー画面から追加編集可能)
INSERT INTO categories (name, type, icon, color, sort_order, is_default) VALUES
    ('給与', 'income', '💰', '#4CAF50', 1, 1),
    ('食費', 'expense', '🍚', '#FF7043', 1, 1),
    ('交通費', 'expense', '🚃', '#42A5F5', 2, 1),
    ('日用品', 'expense', '🧻', '#AB47BC', 3, 1),
    ('趣味・娯楽', 'expense', '🎮', '#FFCA28', 4, 1),
    ('住居費', 'expense', '🏠', '#8D6E63', 5, 1),
    ('水道光熱費', 'expense', '💡', '#26A69A', 6, 1);
