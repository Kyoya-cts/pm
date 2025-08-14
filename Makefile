.PHONY: quick-start install-deps dev dev-detached stop-dev

DEV_PORT ?= 3000

quick-start: ## クイックスタート（開発環境）
	@echo "⚡ クイックスタートを実行中..."
	@echo "1. 依存関係をインストール..."
	@make install-deps
	@echo "2. 開発サーバーをバックグラウンドで起動..."
	@make dev-detached
	@echo ""
	@echo "🎉 セットアップ完了！"
	@echo "🌐 http://localhost:$(DEV_PORT) でアクセスできます"
	@echo ""
	@echo "📝 使用方法:"
	@echo "1. GitHub Personal Access Token を取得"
	@echo "2. Organization名とProject番号を確認"
	@echo "3. ブラウザでフォームに入力してデータを取得"

install-deps: ## 依存関係インストール
	npm ci

dev: ## フォアグラウンドで開発サーバー起動
	DEV_PORT=$(DEV_PORT) npm run dev

dev-detached: ## バックグラウンドで開発サーバー起動
	DEV_PORT=$(DEV_PORT) nohup npm run dev > dev.log 2>&1 &

stop-dev: ## 開発サーバーを停止
	@pkill -f "npm run dev" || true
	@echo "開発サーバーを停止しました"