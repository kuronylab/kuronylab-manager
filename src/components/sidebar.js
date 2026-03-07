import { store } from '../store.js';

export function renderSidebar() {
    const container = document.createElement('div');
    container.className = 'sidebar-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';

    const currentYear = store.state.currentYear || new Date().getFullYear();

    container.innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">K</div>
      <div class="sidebar-logo-text">
        <span class="sidebar-logo-name">KURONYLAB</span>
        <span class="sidebar-logo-label">Manager</span>
      </div>
    </div>
    
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
      <div class="sidebar-year-badge">
        📅 ${currentYear}年度
      </div>
    </div>
  `;

    // イベントリスナーやStore購読の設定
    store.subscribe((state) => {
        const yearBadge = container.querySelector('.sidebar-year-badge');
        if (yearBadge) {
            yearBadge.innerHTML = `📅 ${state.currentYear}年度`;
        }
    });

    return container;
}
