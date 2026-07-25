-- CSVインポート/エクスポート対応 + 固定費ルール機能
-- Cloudflare D1 (SQLite) 用

-- 固定費ルール(繰り返し発生する収支を自動生成するための定義)
CREATE TABLE fixed_cost_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    scope_id INTEGER NOT NULL REFERENCES scopes(id),
    -- none: 繰り返しなし(start_dateに1回のみ), day: 毎日, weekday: 平日のみ,
    -- week: 週ベース(recurrence_intervalで隔週・3週間ごとを表現),
    -- month: 月ベース(recurrence_intervalで2〜6ヶ月ごとを表現), year: 毎年
    recurrence_unit TEXT NOT NULL CHECK (recurrence_unit IN ('none', 'day', 'weekday', 'week', 'month', 'year')),
    recurrence_interval INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    end_date TEXT,
    -- 発生日が土日祝の場合の調整: none=調整しない, before=直前の平日, after=直後の平日
    holiday_adjustment TEXT NOT NULL CHECK (holiday_adjustment IN ('none', 'before', 'after')) DEFAULT 'none',
    -- 次回計算すべき回次(0始まり)。生の発生日は常に start_date + occurrence_count * interval から
    -- 計算し直すため、月末クランプによるドリフトが起きない
    occurrence_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_fixed_cost_rules_category ON fixed_cost_rules(category_id);
CREATE INDEX idx_fixed_cost_rules_scope ON fixed_cost_rules(scope_id);

-- 収支データ: 固定費フラグ(CSVの「固定費」列、および入力画面のチェックボックスに対応)
ALTER TABLE transactions ADD COLUMN is_fixed_cost INTEGER NOT NULL DEFAULT 0;
-- 固定費ルールから自動生成された行のみ設定される(手動入力・CSV取込みの行はNULLのまま)
ALTER TABLE transactions ADD COLUMN fixed_cost_rule_id INTEGER REFERENCES fixed_cost_rules(id);

CREATE INDEX idx_transactions_fixed_cost_rule ON transactions(fixed_cost_rule_id);
