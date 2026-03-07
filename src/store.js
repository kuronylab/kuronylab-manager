import { db } from './db.js';

// グローバル状態管理（簡易React Context風）
class Store {
    constructor() {
        const today = new Date();

        this.state = {
            // 選択状態
            currentYear: today.getFullYear(),
            currentMonth: today.getMonth() + 1,

            // キャッシュ済データ
            accounts: [],
            transactions: [], // 現在の月の取引
            settings: {},

            // ローディング状態
            isLoading: true,

            // ルーティング
            currentRoute: 'dashboard'
        };

        this.listeners = [];
    }

    // データ初期化
    async init() {
        try {
            this.state.isLoading = true;
            this.notify();

            const [accounts, settings] = await Promise.all([
                db.getAccounts(),
                db.getSettings()
            ]);

            // デフォルトの設定があれば統合
            this.state.accounts = accounts;
            this.state.settings = settings;

            // 現在の月の取引を読み込み
            await this.loadTransactions();

            this.state.isLoading = false;
            this.notify();
        } catch (error) {
            console.error('Store初期化エラー:', error);
            this.state.isLoading = false;
            this.notify();
        }
    }

    // 状態の購読
    subscribe(listener) {
        this.listeners.push(listener);
        // 初期状態を即座に通知
        listener(this.state);

        // 購読解除関数を返す
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // 変更の通知
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // 状態の更新
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    // --- アクション ---

    // 月を変更する
    async setMonth(year, month) {
        this.setState({ currentYear: year, currentMonth: month, isLoading: true });
        await this.loadTransactions();
        this.setState({ isLoading: false });
    }

    // 現在の月の取引を読み込む
    async loadTransactions() {
        const yearMonth = `${this.state.currentYear}-${String(this.state.currentMonth).padStart(2, '0')}`;
        const txs = await db.getTransactionsByMonth(yearMonth);
        this.state.transactions = txs;
    }

    // 取引を追加する
    async addTransaction(tx) {
        await db.addTransaction(tx);

        // 追加した取引が現在の月に含まれる場合は再読み込み
        const date = new Date(tx.date);
        if (date.getFullYear() === this.state.currentYear && (date.getMonth() + 1) === this.state.currentMonth) {
            await this.loadTransactions();
            this.notify();
        }
    }

    // 取引を更新する
    async updateTransaction(tx) {
        await db.updateTransaction(tx);

        // 変更前後で現在の月に影響があるか確認して再読み込み
        await this.loadTransactions();
        this.notify();
    }

    // 取引を削除する
    async deleteTransaction(id) {
        await db.deleteTransaction(id);
        await this.loadTransactions();
        this.notify();
    }

    // 勘定科目をアカウントコードから取得するヘルパー
    getAccountByCode(code) {
        return this.state.accounts.find(a => a.code === code);
    }

    // 勘定科目名を取得するヘルパー
    getAccountName(code) {
        const account = this.getAccountByCode(code);
        return account ? account.name : '不明な科目';
    }
}

export const store = new Store();
