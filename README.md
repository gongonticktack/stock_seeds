# 株ピック記録

バリュー株／株主優待のスクリーニング実行日（ラン）ごとに、ピック銘柄をまとめた記録サイト。

公開URL: https://stockpicks.gongonticktack.workers.dev/

## データ

- データソースは Supabase のテーブル `public.stock_pick_runs` と `public.stock_picks`
- 初期データの投入は `schema.sql` を Supabase の SQL Editor で実行する（テーブル作成・RLS・公開 select ポリシー・全ラン／全ピックのシードを含む）
- サイトは Cloudflare Worker の `/api/picks` 経由で Supabase REST からランとピックを読み取り、失敗時はブラウザから直接 Supabase REST を読む
- 接続情報（URL と anon キー）は `config.json` にある。書き込みは公開していない（RLS で select のみ許可）

## ローカル開発

```sh
npm install
npm run dev
```

## デプロイ

```sh
npm run deploy
```

wrangler で Cloudflare Workers にデプロイされる（`wrangler.jsonc` の `name: stockpicks`）。
