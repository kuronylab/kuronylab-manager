import { store } from '../store.js';

export function renderHeader() {
    const container = document.createElement('div');
    container.className = 'header-content';

    container.innerHTML = `
    <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
      <button class="mobile-menu-btn" id="mobile-menu-toggle">
        ☰
      </button>
      <h1 class="header-title" id="page-title">ダッシュボード</h1>
    </div>
    
    <div class="header-actions">
      <div class="header-month-selector">
        <button class="header-month-btn" id="prev-month">◀</button>
        <div class="header-month-label" id="current-month-label">
          2025年3月
        </div>
        <button class="header-month-btn" id="next-month">▶</button>
      </div>
    </div>
  `;

    // DOMがマウントされた後にイベントリスナーを設定する処理
    setTimeout(() => {
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        const menuBtn = document.getElementById('mobile-menu-toggle');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                let { currentYear, currentMonth } = store.state;
                currentMonth--;
                if (currentMonth < 1) {
                    currentMonth = 12;
                    currentYear--;
                }
                store.setMonth(currentYear, currentMonth);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                let { currentYear, currentMonth } = store.state;
                currentMonth++;
                if (currentMonth > 12) {
                    currentMonth = 1;
                    currentYear++;
                }
                store.setMonth(currentYear, currentMonth);
            });
        }

        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('open');
            });
        }

    }, 0);

    // Storeの購読
    store.subscribe((state) => {
        const monthLabel = document.getElementById('current-month-label');
        if (monthLabel) {
            monthLabel.textContent = `${state.currentYear}年${state.currentMonth}月`;
        }

        // ページタイトルの動的更新
        const titleMap = {
            'dashboard': 'ダッシュボード',
            'transactions': '取引入力・一覧',
            'journal': '仕訳帳',
            'ledger': '総勘定元帳',
            'trial-balance': '残高試算表',
            'pl': '損益計算書',
            'bs': '貸借対照表',
            'tax-summary': '確定申告サマリー',
            'accounts': '勘定科目設定',
            'settings': '事業者設定'
        };

        const pageTitle = document.getElementById('page-title');
        if (pageTitle && state.currentRoute) {
            pageTitle.textContent = titleMap[state.currentRoute] || 'ダッシュボード';
        }
    });

    return container;
}
