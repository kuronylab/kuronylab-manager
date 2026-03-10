import { DEFAULT_ACCOUNTS } from './utils/accounts-master.js';
import { supabase } from './utils/supabase.js';

const DB_NAME = 'kuronylab_manager_db';
const DB_VERSION = 5;

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

            request.onblocked = () => {
                alert('データベースの構成が他のタブによってブロックされています。開いている他のタブをすべて閉じて、再読み込みしてください。');
                reject(new Error('IndexedDB blocked'));
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const oldVersion = e.oldVersion;

                // 取引（仕訳）ストア (v1)
                if (!db.objectStoreNames.contains('transactions')) {
                    const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    txStore.createIndex('date', 'date', { unique: false });
                    txStore.createIndex('yearMonth', 'yearMonth', { unique: false });
                    txStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 勘定科目ストア (v1)
                if (!db.objectStoreNames.contains('accounts')) {
                    const accountStore = db.createObjectStore('accounts', { keyPath: 'code' });
                    accountStore.createIndex('category', 'category', { unique: false });
                }

                // 設定ストア (v1)
                if (!db.objectStoreNames.contains('settings')) {
                    const settingsStore = db.createObjectStore('settings', { keyPath: 'id' });
                }

                // サブスクリプション管理用ストア (v2)
                if (!db.objectStoreNames.contains('subscriptions')) {
                    const subStore = db.createObjectStore('subscriptions', { keyPath: 'id' });
                    subStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 自動記帳用の同期ログストア (v2)
                if (!db.objectStoreNames.contains('sync_logs')) {
                    const syncStore = db.createObjectStore('sync_logs', { keyPath: 'yearMonth' });
                }

                // 店舗管理用ストア (v5) - Removed as per user request

                // 初期データの投入等は transaction が完了してから行う
                e.target.transaction.oncomplete = () => {
                    this.seedInitialData(db);
                    if (oldVersion > 0 && oldVersion < 4) {
                        this.migrateDataV4(db);
                    }
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
            industryType: 'Webショップ運営代行・業務委託',
            taxReturnMethod: 'blue',
            blueReturnDeduction: 650000
        });
    }

    migrateDataV4(db) {
        console.log('Migrating data to V4 (Apportionment Initialization)...');
        // We open a new transaction for the migration
        const transaction = db.transaction(['transactions'], 'readwrite');
        const store = transaction.objectStore('transactions');
        const request = store.getAll();

        request.onsuccess = (e) => {
            const txs = e.target.result;
            txs.forEach(tx => {
                // 借方が 5 始まり（費用）で利用区分が未設定の場合
                if (tx.debitAccount && tx.debitAccount.startsWith('5') && !tx.usageType && !tx.isApportionmentAdjustment) {
                    tx.usageType = 'business_only';
                    tx.businessUseRatio = 100;
                    store.put(tx);
                }
            });
            console.log('V4 Migration complete.');
        };
        request.onerror = (e) => {
            console.error('V4 Migration failed:', e);
        };
    }

    // --- Transactions (取引) ---

    async processAutoSubscriptions() {
        await this.ready;
        try {
            const subs = await this.getSubscriptions();
            if (!subs || subs.length === 0) return 0;

            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth() + 1;

            let syncedCount = 0;

            for (const sub of subs) {
                if (!sub.startMonth) continue;
                const [startYearStr, startMonthStr] = sub.startMonth.split('-');
                const startYear = parseInt(startYearStr, 10);
                const startMonthNum = parseInt(startMonthStr, 10);

                let endYear = currentYear;
                let endMonthNum = currentMonth;

                if (sub.endMonth) {
                    const [eyStr, emStr] = sub.endMonth.split('-');
                    const ey = parseInt(eyStr, 10);
                    const em = parseInt(emStr, 10);

                    if (ey < currentYear || (ey === currentYear && em < currentMonth)) {
                        endYear = ey;
                        endMonthNum = em;
                    }
                }

                let y = startYear;
                let m = startMonthNum;

                while (y < endYear || (y === endYear && m <= endMonthNum)) {
                    const lastDayOfMonth = new Date(y, m, 0).getDate();
                    const targetDay = sub.dayOfMonth === 99 ? lastDayOfMonth : Math.min(sub.dayOfMonth, lastDayOfMonth);

                    if (y === currentYear && m === currentMonth && today.getDate() < targetDay) {
                        m++;
                        if (m > 12) { m = 1; y++; }
                        continue;
                    }

                    const syncKey = `${sub.id}_${y}-${String(m).padStart(2, '0')}`;
                    const existingLog = await this.getSyncLog(syncKey);

                    if (existingLog) {
                        m++;
                        if (m > 12) { m = 1; y++; }
                        continue;
                    }

                    const txDate = `${y}-${String(m).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
                    const txId = crypto.randomUUID();
                    const tx = {
                        id: txId,
                        date: txDate,
                        debitAccount: sub.debitAccount,
                        creditAccount: sub.creditAccount,
                        amount: sub.amount,
                        description: sub.description + ' (自動記帳)',
                        partner: sub.partner || '',
                        tags: sub.tags || '',
                        subscriptionId: sub.id,
                        usageType: sub.usageType || 'business_only',
                        businessUseRatio: sub.businessUseRatio !== undefined ? sub.businessUseRatio : 100,
                        apportionmentMethod: sub.apportionmentMethod || 'fixed_ratio',
                        apportionmentMemo: sub.apportionmentMemo || '',
                        apportionmentOffsetAccountCode: sub.apportionmentOffsetAccountCode || '1005'
                    };

                    await this.addTransaction(tx);
                    await this.addSyncLog(syncKey, 'synced', txId);
                    syncedCount++;

                    m++;
                    if (m > 12) { m = 1; y++; }
                }
            }
            return syncedCount;
        } catch (err) {
            console.error('Auto subscription processing failed:', err);
            return 0;
        }
    }

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

            let adjTx = null;
            if (data.usageType === 'mixed' || data.usageType === 'private_only') {
                const ratio = data.usageType === 'private_only' ? 0 : Number(data.businessUseRatio || 0);
                const privateRatio = 100 - ratio;
                const adjAmount = Math.round(data.amount * (privateRatio / 100));

                if (adjAmount > 0) {
                    adjTx = {
                        id: data.linkedAdjustmentEntryId || crypto.randomUUID(),
                        date: data.date,
                        yearMonth: data.yearMonth,
                        debitAccount: data.apportionmentOffsetAccountCode || '1005', // 事業主貸
                        creditAccount: data.debitAccount, // 経費の取り消し
                        amount: adjAmount,
                        description: `家事按分調整: ${data.description}`,
                        isApportionmentAdjustment: true,
                        parentTxId: data.id,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    data.linkedAdjustmentEntryId = adjTx.id;
                }
            }

            store.add(data);
            if (adjTx) {
                store.add(adjTx);
            }

            transaction.oncomplete = async () => {
                // Supabase同期
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    this.syncTransactionToCloud(data, user.id);
                    if (adjTx) this.syncTransactionToCloud(adjTx, user.id);
                }
                resolve(data);
            };
            transaction.onerror = (e) => reject(e);
        });
    }

    // Supabaseへの同期ヘルパー
    async syncTransactionToCloud(tx, userId) {
        const cloudData = {
            id: tx.id,
            user_id: userId,
            date: tx.date,
            year_month: tx.yearMonth,
            debit_account: tx.debitAccount,
            credit_account: tx.creditAccount,
            amount: tx.amount,
            description: tx.description,
            partner: tx.partner,
            tags: tx.tags,
            usage_type: tx.usageType,
            business_use_ratio: tx.businessUseRatio,
            apportionment_method: tx.apportionmentMethod,
            apportionment_memo: tx.apportionmentMemo,
            apportionment_offset_account_code: tx.apportionmentOffsetAccountCode,
            is_apportionment_adjustment: tx.isApportionmentAdjustment || false,
            parent_tx_id: tx.parentTxId,
            linked_adjustment_entry_id: tx.linkedAdjustmentEntryId,
            app_type: 'manager',
            updated_at: tx.updatedAt
        };
        await supabase.from('transactions').upsert(cloudData);
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

            let adjTx = null;
            let shouldDeleteAdjId = null;

            if (data.usageType === 'mixed' || data.usageType === 'private_only') {
                const ratio = data.usageType === 'private_only' ? 0 : Number(data.businessUseRatio || 0);
                const privateRatio = 100 - ratio;
                const adjAmount = Math.round(data.amount * (privateRatio / 100));

                if (adjAmount > 0) {
                    adjTx = {
                        id: data.linkedAdjustmentEntryId || crypto.randomUUID(),
                        date: data.date,
                        yearMonth: data.yearMonth,
                        debitAccount: data.apportionmentOffsetAccountCode || '1005',
                        creditAccount: data.debitAccount,
                        amount: adjAmount,
                        description: `家事按分調整: ${data.description}`,
                        isApportionmentAdjustment: true,
                        parentTxId: data.id,
                        updatedAt: new Date().toISOString()
                    };
                    if (!data.linkedAdjustmentEntryId) {
                        adjTx.createdAt = new Date().toISOString();
                    }
                    data.linkedAdjustmentEntryId = adjTx.id;
                } else {
                    if (data.linkedAdjustmentEntryId) {
                        shouldDeleteAdjId = data.linkedAdjustmentEntryId;
                        data.linkedAdjustmentEntryId = null;
                    }
                }
            } else {
                if (data.linkedAdjustmentEntryId) {
                    shouldDeleteAdjId = data.linkedAdjustmentEntryId;
                    data.linkedAdjustmentEntryId = null;
                }
            }

            store.put(data);
            if (adjTx) {
                store.put(adjTx);
            }
            if (shouldDeleteAdjId) {
                store.delete(shouldDeleteAdjId);
            }

            transaction.oncomplete = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    this.syncTransactionToCloud(data, user.id);
                    if (adjTx) this.syncTransactionToCloud(adjTx, user.id);
                    if (shouldDeleteAdjId) await supabase.from('transactions').delete().eq('id', shouldDeleteAdjId);
                }
                resolve(data);
            };
            transaction.onerror = (e) => reject(e);
        });
    }

    async deleteTransaction(id) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');

            let linkedId = null;
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const tx = getReq.result;
                if (tx) {
                    linkedId = tx.linkedAdjustmentEntryId;
                    if (linkedId) {
                        store.delete(linkedId);
                    }
                    store.delete(id);
                }
            };

            transaction.oncomplete = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('transactions').delete().eq('id', id);
                    if (linkedId) {
                        await supabase.from('transactions').delete().eq('id', linkedId);
                    }
                }
                resolve();
            };
            transaction.onerror = (e) => reject(e);
        });
    }

    async syncTransactionsFromCloud() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. クラウドからデータを取得
        const { data: cloudTxs, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('app_type', 'manager');

        if (error) throw error;
        if (!cloudTxs) return;

        // IndexedDBに一括保存
        const transaction = this.db.transaction(['transactions'], 'readwrite');
        const store = transaction.objectStore('transactions');

        for (const ctx of cloudTxs) {
            const localData = {
                id: ctx.id,
                date: ctx.date,
                yearMonth: ctx.year_month,
                debitAccount: ctx.debit_account,
                creditAccount: ctx.credit_account,
                amount: ctx.amount,
                description: ctx.description,
                partner: ctx.partner || '',
                tags: ctx.tags || '',
                usageType: ctx.usage_type,
                businessUseRatio: ctx.business_use_ratio,
                apportionmentMethod: ctx.apportionment_method,
                apportionmentMemo: ctx.apportionment_memo,
                apportionmentOffsetAccountCode: ctx.apportionment_offset_account_code,
                isApportionmentAdjustment: ctx.is_apportionment_adjustment,
                parentTxId: ctx.parent_tx_id,
                linkedAdjustmentEntryId: ctx.linked_adjustment_entry_id,
                createdAt: ctx.created_at,
                updatedAt: ctx.updated_at
            };
            store.put(localData);
        }

        await new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e);
        });

        // 2. 逆に、ローカルにしかないデータをクラウドに送る（PCデータの同期用）
        const allLocalTxs = await this.getAllTransactions();
        const cloudIds = new Set(cloudTxs.map(tx => tx.id));
        const localOnlyTxs = allLocalTxs.filter(tx => !cloudIds.has(tx.id));

        if (localOnlyTxs.length > 0) {
            console.log(`Syncing ${localOnlyTxs.length} local-only transactions to cloud...`);
            for (const tx of localOnlyTxs) {
                await this.syncTransactionToCloud(tx, user.id);
            }
        }
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
            request.onsuccess = () => resolve(request.result);
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
    async importAllData(data) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const stores = ['transactions', 'accounts', 'settings', 'subscriptions', 'sync_logs'];
            const transaction = this.db.transaction(stores, 'readwrite');

            try {
                // すべてのストアをクリア
                stores.forEach(s => {
                    if (this.db.objectStoreNames.contains(s)) {
                        transaction.objectStore(s).clear();
                    }
                });

                // 取引データの投入
                if (data.transactions) {
                    const txStore = transaction.objectStore('transactions');
                    data.transactions.forEach(tx => txStore.add(tx));
                }

                // 勘定科目の投入
                if (data.accounts) {
                    const accStore = transaction.objectStore('accounts');
                    data.accounts.forEach(acc => accStore.add(acc));
                }

                // 設定の投入
                if (data.settings) {
                    const settingsStore = transaction.objectStore('settings');
                    const settings = data.settings.id ? data.settings : { id: 'profile', ...data.settings };
                    settingsStore.add(settings);
                }

                // 自動記帳の投入
                if (data.subscriptions) {
                    const subStore = transaction.objectStore('subscriptions');
                    data.subscriptions.forEach(sub => subStore.add(sub));
                }

                transaction.oncomplete = () => resolve();
                transaction.onerror = (e) => reject(e);
            } catch (err) {
                reject(err);
            }
        });
    }

    async clearAllData() {
        await this.ready;
        // ログアウトしてクラウド同期を止める
        await supabase.auth.signOut();

        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close();
                this.db = null;
            }

            const request = indexedDB.deleteDatabase(DB_NAME);

            request.onsuccess = () => {
                localStorage.clear();
                resolve();
            };
            request.onerror = (e) => reject(e);
            request.onblocked = () => {
                console.warn('Delete blocked, please close other tabs');
                localStorage.clear();
                resolve(); // 強行
            };
        });
    }

    // --- Subscriptions (毎月自動記帳) ---

    async addSubscription(sub) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['subscriptions'], 'readwrite');
            const store = transaction.objectStore('subscriptions');

            const data = {
                ...sub,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString()
            };

            const request = store.add(data);
            request.onsuccess = () => resolve(data);
            request.onerror = (e) => reject(e);
        });
    }

    async getSubscriptions() {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['subscriptions'], 'readonly');
            const store = transaction.objectStore('subscriptions');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    async updateSubscription(sub) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['subscriptions'], 'readwrite');
            const store = transaction.objectStore('subscriptions');

            const data = {
                ...sub,
                updatedAt: new Date().toISOString()
            };

            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = (e) => reject(e);
        });
    }

    async deleteSubscription(id) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['subscriptions'], 'readwrite');
            const store = transaction.objectStore('subscriptions');
            const request = store.delete(id);
            request.onsuccess = () => resolve(id);
            request.onerror = (e) => reject(e);
        });
    }

    // --- Sync Logs (自動記帳実行記録) ---

    async getSyncLog(yearMonth) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_logs'], 'readonly');
            const store = transaction.objectStore('sync_logs');
            const request = store.get(yearMonth);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    async addSyncLog(yearMonth, status = 'synced', txId = null) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_logs'], 'readwrite');
            const store = transaction.objectStore('sync_logs');
            const request = store.put({
                yearMonth,
                status, // 'synced' または 'skipped'
                txId,   // 関連するトランザクションID（スキップ時はnull）
                syncedAt: new Date().toISOString()
            });
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    // 特定のトランザクションIDに紐づく同期ログを更新（スキップ削除用）
    async skipSyncLogByTxId(txId) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_logs'], 'readwrite');
            const store = transaction.objectStore('sync_logs');
            const request = store.getAll();

            request.onsuccess = (e) => {
                const logs = e.target.result;
                const targetLog = logs.find(log => log.txId === txId);

                if (targetLog) {
                    targetLog.status = 'skipped';
                    store.put(targetLog).onsuccess = () => resolve(true);
                } else {
                    resolve(false);
                }
            };
            request.onerror = (e) => reject(e);
        });
    }

}

export const db = new Database();
