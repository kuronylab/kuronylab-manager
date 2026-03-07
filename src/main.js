import './index.css';
import { db } from './db.js';
import { store } from './store.js';
import { router } from './router.js';

// コンポーネント
import { renderSidebar } from './components/sidebar.js';
import { renderHeader } from './components/header.js';

// ページ
import { renderDashboard, onDashboardMount } from './pages/dashboard.js';
import { renderTransactions, onTransactionsMount } from './pages/transactions.js';
import { renderJournal, onJournalMount } from './pages/journal.js';
import { renderLedger, onLedgerMount } from './pages/ledger.js';
import { renderTrialBalance, onTrialBalanceMount } from './pages/trial-balance.js';
import { renderPL, onPLMount } from './pages/pl.js';
import { renderBS, onBSMount } from './pages/bs.js';
import { renderTaxSummary, onTaxSummaryMount } from './pages/tax-summary.js';
import { renderAccounts, onAccountsMount } from './pages/accounts.js';
import { renderSettings, onSettingsMount } from './pages/settings.js';

async function bootstrap() {
    console.log('KURONYLAB Manager - Initializing...');

    // 1. データベースの初期化待機
    await db.ready;

    // 2. グローバルStoreの初期化 (DBからデータ読み込み)
    await store.init();

    // 3. 基本レイアウト（サイドバー・ヘッダー）の描画
    document.getElementById('sidebar').appendChild(renderSidebar());
    document.getElementById('app-header').appendChild(renderHeader());

    // 4. ルーターの設定
    router.addRoute('dashboard', renderDashboard, onDashboardMount);
    router.addRoute('transactions', renderTransactions, onTransactionsMount);
    router.addRoute('journal', renderJournal, onJournalMount);
    router.addRoute('ledger', renderLedger, onLedgerMount);
    router.addRoute('trial-balance', renderTrialBalance, onTrialBalanceMount);
    router.addRoute('pl', renderPL, onPLMount);
    router.addRoute('bs', renderBS, onBSMount);
    router.addRoute('tax-summary', renderTaxSummary, onTaxSummaryMount);
    router.addRoute('accounts', renderAccounts, onAccountsMount);
    router.addRoute('settings', renderSettings, onSettingsMount);

    // 5. ルーター起動 (現在のURLから最初のページを描画)
    router.init();

    // 画面ローディングを完了
    console.log('App initialized fully.');
}

// アプリの起動
document.addEventListener('DOMContentLoaded', bootstrap);
