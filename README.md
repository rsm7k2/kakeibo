# 家計簿アプリ

## 構成
- フロントエンド: React + TypeScript + Vite + Tailwind CSS
- 配信/API: Cloudflare Workers(Static Assets)
- DB: Cloudflare D1
- 認証: 開発中はなし。本番はCloudflare Access(ZTNA)で保護する想定

## セットアップ手順

1. 依存パッケージのインストール
   ```
   npm install
   ```

2. Cloudflareへログイン(初回のみ)
   ```
   npx wrangler login
   ```

3. D1データベースの作成(初回のみ)
   ```
   npx wrangler d1 create kakeibo-db
   ```
   実行結果に表示される `database_id` を `wrangler.toml` の `<database_id>` 部分に貼り付けてください。

4. マイグレーション実行(テーブル作成+初期データ投入)
   - ローカル開発用DB:
     ```
     npm run db:migrate:local
     ```
   - 本番用DB:
     ```
     npm run db:migrate:remote
     ```

5. ローカル開発サーバー起動
   ```
   npm run dev
   ```

6. 本番デプロイ
   ```
   npm run deploy
   ```

## ディレクトリ構成

```
src/
├── main.tsx
├── App.tsx              # ボトムナビの状態管理・画面切り替え(初期表示: 入力画面)
├── components/
│   └── BottomNav.tsx    # 入力/カレンダー/レポート/予算/メニュー
├── screens/
│   ├── InputScreen.tsx      # (仮実装)
│   ├── CalendarScreen.tsx   # (仮実装)
│   ├── ReportScreen.tsx     # (仮実装)
│   ├── BudgetScreen.tsx     # (仮実装)
│   └── MenuScreen.tsx       # (仮実装)
├── api/
│   └── client.ts        # Workers APIへのfetchラッパー
└── types/
    └── index.ts          # DBスキーマに対応する型定義

worker/
└── index.ts              # Cloudflare Workers API(/api配下を処理)

migrations/
└── 0001_init.sql         # DBスキーマ + 初期データ
```

## 未実装・今後の作業

- 各画面(入力・カレンダー・レポート・予算・メニュー)の本実装
- Workers API側のエンドポイント追加(scopes, payment_methods, budgets, レポート集計)
- 本番デプロイ前にCloudflare Accessの設定
- PWAアプリアイコン画像(192x192, 512x512)の準備と`vite.config.ts`への設定
