import { DEFAULT_ACCOUNTS } from './utils/accounts-master.js';

const DB_NAME = 'kuronylab_db';
const DB_VERSION = 1;

class Database {
    constructor() {
        this.db = null;
        this.ready = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (e) => {
                console.error('IndexedDBの初期化エラー:', e);
                reject(e);
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // 取引（仕訳）ストア
                const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
                txStore.createIndex('date', 'date', { unique: false });
                txStore.createIndex('yearMonth', 'yearMonth', { unique: false });
                txStore.createIndex('createdAt', 'createdAt', { unique: false });

                // 勘定科目ストア
                const accountStore = db.createObjectStore('accounts', { keyPath: 'code' });
                accountStore.createIndex('category', 'category', { unique: false });

                // 設定ストア
                const settingsStore = db.createObjectStore('settings', { keyPath: 'id' });

                // 初期データの投入は transaction が完了してから行う
                e.target.transaction.oncomplete = () => {
                    this.seedInitialData(db);
                };
            };
        });
    }

    // 初期データの投入（勘定科目マスタとデフォルト設定）
    async seedInitialData(db) {
        const transaction = db.transaction(['accounts', 'settings'], 'readwrite');
        const accountStore = transaction.objectStore('accounts');
        const settingsStore = transaction.objectStore('settings');

        // 勘定科目マスタの投入
        DEFAULT_ACCOUNTS.forEach(account => {
            accountStore.put(account);
        });

        // デフォルト設定の投入
        settingsStore.put({
            id: 'profile',
            businessName: 'KURONYLAB',
            taxpayerName: '黒木 皓基',
            industryType: 'EC販売業',
            taxReturnMethod: 'blue',
            blueReturnDeduction: 650000
        });
    }

    // --- Transactions (取引) ---

    async addTransaction(tx) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');

            // month key の生成 (YYYY-MM)
            const date = new Date(tx.date);
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            const data = {
                ...tx,
                yearMonth,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const request = store.add(data);
            request.onsuccess = () => resolve(data);
            request.onerror = (e) => reject(e);
        });
    }

    async updateTransaction(tx) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');

            const date = new Date(tx.date);
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            const data = {
                ...tx,
                yearMonth,
                updatedAt: new Date().toISOString()
            };

            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = (e) => reject(e);
        });
    }

    async deleteTransaction(id) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    async getTransactionsByMonth(yearMonth) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('yearMonth');
            const request = index.getAll(yearMonth);

            request.onsuccess = (e) => {
                // 日付の降順でソート
                const result = e.target.result.sort((a, b) => {
                    if (a.date === b.date) {
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    }
                    return new Date(b.date) - new Date(a.date);
                });
                resolve(result);
            };
            request.onerror = (e) => reject(e);
        });
    }

    async getTransactionsByYear(year) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.getAll();

            request.onsuccess = (e) => {
                const result = e.target.result
                    .filter(t => t.date.startsWith(`${year}-`))
                    .sort((a, b) => new Date(a.date) - new Date(b.date)); // 昇順（期首から期末へ）
                resolve(result);
            };
            request.onerror = (e) => reject(e);
        });
    }

    async getAllTransactions() {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.getAll();

            request.onsuccess = (e) => {
                const result = e.target.result.sort((a, b) => new Date(b.date) - new Date(a.date));
                resolve(result);
            };
            request.onerror = (e) => reject(e);
        });
    }

    // --- Accounts (勘定科目) ---

    async getAccounts() {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['accounts'], 'readonly');
            const store = transaction.objectStore('accounts');
            const request = store.getAll();

            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    }

    async getAccount(code) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['accounts'], 'readonly');
            const store = transaction.objectStore('accounts');
            const request = store.get(code);

            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    }

    async saveAccount(account) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['accounts'], 'readwrite');
            const store = transaction.objectStore('accounts');
            const request = store.put(account);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    // --- Settings (設定) ---

    async getSettings() {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get('profile');

            request.onsuccess = (e) => resolve(e.target.result || {});
            request.onerror = (e) => reject(e);
        });
    }

    async saveSettings(settings) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ id: 'profile', ...settings });

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    // --- Database Operations ---

    async clearAllData() {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions', 'accounts', 'settings'], 'readwrite');
            transaction.objectStore('transactions').clear();
            transaction.objectStore('accounts').clear();
            transaction.objectStore('settings').clear();

            transaction.oncomplete = () => {
                this.seedInitialData(this.db).then(resolve).catch(reject);
            };
            transaction.onerror = (e) => reject(e);
        });
    }
}

export const db = new Database();
