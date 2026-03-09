import './index.css';
import { db } from './db.js';
import { store } from './store.js';
import { router } from './router.js';
import { supabase } from './utils/supabase.js';

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
import { renderInventory, onInventoryMount } from './pages/inventory.js';
import { renderDepreciation, onDepreciationMount } from './pages/depreciation.js';
import { renderSettings, onSettingsMount } from './pages/settings.js';
import { renderAuth, onAuthMount } from './pages/auth.js';


async function bootstrap() {
    console.log('KURONYLAB Manager - Initializing...');

    // 1. データベースの初期化待機
    await db.ready;

    // 2. グローバルStoreの初期化 (DBからデータ読み込み)
    await store.init();

    // 2.5 認証セッションの確認
    const { data: { session } } = await supabase.auth.getSession();
    store.setState({ user: session?.user || null });

    // 認証状態の変化を監視
    supabase.auth.onAuthStateChange(async (event, session) => {
        const previousUser = store.state.user;
        const newUser = session?.user || null;

        store.setState({ user: newUser });

        if (event === 'SIGNED_IN' && !previousUser) {
            const { showToast } = await import('./components/toast.js');
            showToast('ログインしました', 'success');
            // ログイン時に同期を実行
            await store.syncFromCloud();
        }

        if (!session) {
            window.location.hash = '#auth';
        }
    });

    // ログインしていない場合は認証画面へ（ハッシュがない、または認証が必要なページの場合）
    if (!session && !window.location.hash.includes('auth')) {
        window.location.hash = '#auth';
    }

    // 3. 基本レイアウト（サイドバー・ヘッダー）の描画
    document.getElementById('sidebar').appendChild(renderSidebar());
    document.getElementById('app-header').appendChild(renderHeader());

    // 3.5 モバイル用サイドバーオーバーレイの追加
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        overlay.classList.remove('open');
    });

    // サイドバー内のリンククリックでスマホの場合はサイドバーを閉じる
    document.getElementById('sidebar').addEventListener('click', (e) => {
        if (e.target.closest('.sidebar-link')) {
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
                overlay.classList.remove('open');
            }
        }
    });

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
    router.addRoute('inventory', renderInventory, onInventoryMount);
    router.addRoute('depreciation', renderDepreciation, onDepreciationMount);
    router.addRoute('settings', renderSettings, onSettingsMount);
    router.addRoute('auth', renderAuth, onAuthMount);

    // 4.5 自動記帳（サブスクリプション）の実行
    const syncedCount = await db.processAutoSubscriptions();
    if (syncedCount > 0) {
        const { showToast } = await import('./components/toast.js');
        showToast(`${syncedCount}件のサブスクリプションを自動記帳しました`, 'info');
    }

    // 5. ルーター起動 (現在のURLから最初のページを描画)
    router.init();

    // 画面ローディングを完了
    console.log('App initialized fully.');
}

// アプリの起動
document.addEventListener('DOMContentLoaded', bootstrap);
