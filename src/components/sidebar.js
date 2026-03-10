import { store } from '../store.js';
import { signOut } from '../utils/supabase.js';

export function renderSidebar() {
  const container = document.createElement('div');
  container.className = 'sidebar-container';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';

  function updateSidebarContent(state) {
    const user = state.user;
    const settings = state.settings || {};
    const currentYear = state.currentYear || new Date().getFullYear();

    container.innerHTML = `
      <a href="#dashboard" class="sidebar-logo" style="text-decoration: none; display: flex; align-items: center; gap: var(--spacing-md); cursor: pointer;">
        <div class="sidebar-logo-icon">
          <img src="/logo.png" alt="KURONYLAB" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
        </div>
        <div class="sidebar-logo-text">
          <span class="sidebar-logo-name">KURONYLAB</span>
          <span class="sidebar-logo-label">帳簿</span>
        </div>
      </a>
      
      <nav class="sidebar-nav">
        <div class="sidebar-section">
          <div class="sidebar-section-title">メイン</div>
          <a href="#dashboard" class="sidebar-link ${window.location.hash === '#dashboard' || !window.location.hash ? 'active' : ''}">
            <div class="sidebar-link-icon">📊</div>
            <span>ダッシュボード</span>
          </a>
          <a href="#transactions" class="sidebar-link ${window.location.hash === '#transactions' ? 'active' : ''}">
            <div class="sidebar-link-icon">📝</div>
            <span>取引入力・一覧</span>
          </a>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-title">月次帳簿</div>
          <a href="#journal" class="sidebar-link ${window.location.hash === '#journal' ? 'active' : ''}">
            <div class="sidebar-link-icon">📖</div>
            <span>仕訳帳</span>
          </a>
          <a href="#ledger" class="sidebar-link ${window.location.hash === '#ledger' ? 'active' : ''}">
            <div class="sidebar-link-icon">📒</div>
            <span>総勘定元帳</span>
          </a>
          <a href="#trial-balance" class="sidebar-link ${window.location.hash === '#trial-balance' ? 'active' : ''}">
            <div class="sidebar-link-icon">⚖️</div>
            <span>残高試算表</span>
          </a>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-title">決算・申告</div>
          <a href="#pl" class="sidebar-link ${window.location.hash === '#pl' ? 'active' : ''}">
            <div class="sidebar-link-icon">📈</div>
            <span>損益計算書</span>
          </a>
          <a href="#bs" class="sidebar-link ${window.location.hash === '#bs' ? 'active' : ''}">
            <div class="sidebar-link-icon">🏛️</div>
            <span>貸借対照表</span>
          </a>
          <a href="#tax-summary" class="sidebar-link ${window.location.hash === '#tax-summary' ? 'active' : ''}">
            <div class="sidebar-link-icon">📄</div>
            <span>確定申告サマリー</span>
          </a>
          <a href="#inventory" class="sidebar-link ${window.location.hash === '#inventory' ? 'active' : ''}">
            <div class="sidebar-link-icon">🗃️</div>
            <span>棚卸資産（在庫なし可）</span>
          </a>
          <a href="#depreciation" class="sidebar-link ${window.location.hash === '#depreciation' ? 'active' : ''}">
            <div class="sidebar-link-icon">🖩</div>
            <span>減価償却</span>
          </a>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-title">設定</div>
          <a href="#accounts" class="sidebar-link ${window.location.hash === '#accounts' ? 'active' : ''}">
            <div class="sidebar-link-icon">🏷️</div>
            <span>勘定科目設定</span>
          </a>
          <a href="#settings" class="sidebar-link ${window.location.hash === '#settings' ? 'active' : ''}">
            <div class="sidebar-link-icon">⚙️</div>
            <span>事業者設定</span>
          </a>
        </div>

        ${settings.otherAppUrl ? `
        <div class="sidebar-section">
          <div class="sidebar-section-title">アプリ切り替え</div>
          <a href="${settings.otherAppUrl}" class="sidebar-link" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2);">
            <div class="sidebar-link-icon">🔄</div>
            <span class="font-bold text-primary">家計簿へ切り替え</span>
          </a>
        </div>
        ` : ''}
      </nav>
      
      <div class="sidebar-footer">
        ${user ? `
          <div class="sidebar-user-info">
            <div class="user-email text-xs text-muted truncate">${user.email}</div>
            <button class="btn btn-ghost btn-xs btn-logout" style="width: 100%; margin-top: 5px;">ログアウト</button>
          </div>
        ` : `
          <div class="sidebar-user-info">
            <button class="btn btn-primary btn-xs btn-login" style="width: 100%;">ログイン</button>
          </div>
        `}
        <div class="sidebar-year-badge">
          📅 ${currentYear}年度
        </div>
      </div>
    `;

    const logoutBtn = container.querySelector('.btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await signOut();
          window.location.hash = '#auth';
        } catch (err) {
          console.error('Logout failed:', err);
        }
      });
    }

    const loginBtn = container.querySelector('.btn-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        window.location.hash = '#auth';
      });
    }
  }

  // 初期描画
  updateSidebarContent(store.state);

  // Store購読の設定
  store.subscribe((state) => {
    updateSidebarContent(state);
  });

  return container;
}
