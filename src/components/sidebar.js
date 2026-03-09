import { store } from '../store.js';
import { signOut } from '../utils/supabase.js';

export function renderSidebar() {
  const container = document.createElement('div');
  container.className = 'sidebar-container';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';

  const currentYear = store.state.currentYear || new Date().getFullYear();
  const user = store.state.user;

  container.innerHTML = `
    <a href="#dashboard" class="sidebar-logo" style="text-decoration: none; display: flex; align-items: center; gap: var(--spacing-md); cursor: pointer;">
      <div class="sidebar-logo-icon">
        <img src="/logo.png" alt="KURONYLAB" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
      </div>
      <div class="sidebar-logo-text">
        <span class="sidebar-logo-name">KURONYLAB</span>
        <span class="sidebar-logo-label">Manager</span>
      </div>
    </a>
    
    <nav class="sidebar-nav">
      <div class="sidebar-section">
        <div class="sidebar-section-title">メイン</div>
        <a href="#dashboard" class="sidebar-link active">
          <div class="sidebar-link-icon">📊</div>
          <span>ダッシュボード</span>
        </a>
        <a href="#transactions" class="sidebar-link">
          <div class="sidebar-link-icon">📝</div>
          <span>取引入力・一覧</span>
        </a>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">月次帳簿</div>
        <a href="#journal" class="sidebar-link">
          <div class="sidebar-link-icon">📖</div>
          <span>仕訳帳</span>
        </a>
        <a href="#ledger" class="sidebar-link">
          <div class="sidebar-link-icon">📒</div>
          <span>総勘定元帳</span>
        </a>
        <a href="#trial-balance" class="sidebar-link">
          <div class="sidebar-link-icon">⚖️</div>
          <span>残高試算表</span>
        </a>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">決算・申告</div>
        <a href="#pl" class="sidebar-link">
          <div class="sidebar-link-icon">📈</div>
          <span>損益計算書</span>
        </a>
        <a href="#bs" class="sidebar-link">
          <div class="sidebar-link-icon">🏛️</div>
          <span>貸借対照表</span>
        </a>
        <a href="#tax-summary" class="sidebar-link">
          <div class="sidebar-link-icon">📄</div>
          <span>確定申告サマリー</span>
        </a>
        <a href="#inventory" class="sidebar-link">
          <div class="sidebar-link-icon">🗃️</div>
          <span>棚卸資産（在庫なし可）</span>
        </a>
        <a href="#depreciation" class="sidebar-link">
          <div class="sidebar-link-icon">🖩</div>
          <span>減価償却</span>
        </a>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">設定</div>
        <a href="#accounts" class="sidebar-link">
          <div class="sidebar-link-icon">🏷️</div>
          <span>勘定科目設定</span>
        </a>
        <a href="#settings" class="sidebar-link">
          <div class="sidebar-link-icon">⚙️</div>
          <span>事業者設定</span>
        </a>
      </div>
    </nav>
    
    <div class="sidebar-footer">
      ${user ? `
        <div class="sidebar-user-info">
          <div class="user-email text-xs text-muted truncate">${user.email}</div>
          <button class="btn btn-ghost btn-xs btn-logout" style="width: 100%; margin-top: 5px;">ログアウト</button>
        </div>
      ` : ''}
      <div class="sidebar-year-badge">
        📅 ${currentYear}年度
      </div>
    </div>
  `;

  // イベントリスナー
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

  // Store購読の設定
  store.subscribe((state) => {
    // ユーザー情報の更新
    const footer = container.querySelector('.sidebar-footer');
    if (footer) {
      const user = state.user;
      const currentYear = state.currentYear;

      footer.innerHTML = `
        ${user ? `
          <div class="sidebar-user-info">
            <div class="user-email text-xs text-muted truncate">${user.email}</div>
            <button class="btn btn-ghost btn-xs btn-logout" style="width: 100%; margin-top: 5px;">ログアウト</button>
          </div>
        ` : ''}
        <div class="sidebar-year-badge">
          📅 ${currentYear}年度
        </div>
      `;

      const newLogoutBtn = footer.querySelector('.btn-logout');
      if (newLogoutBtn) {
        newLogoutBtn.addEventListener('click', async () => {
          await signOut();
          window.location.hash = '#auth';
        });
      }
    }
  });

  return container;
}
