import { store } from '../store.js';

export function renderHeader() {
    const container = document.createElement('div');
    container.className = 'header-content';

    const today = new Date();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const formattedDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 (${days[today.getDay()]})`;

    container.innerHTML = `
    <div style="display: flex; align-items: center; gap: var(--spacing-md);">
      <button class="mobile-menu-btn" id="mobile-menu-toggle">
        ☰
      </button>
      <h1 class="header-title" id="page-title">ダッシュボード</h1>
      <span class="header-today-date" style="font-size: 0.9rem; color: var(--text-muted); padding-left: 1rem; border-left: 1px solid var(--border-color);">
        本日: ${formattedDate}
      </span>
    </div>
    
    <div class="header-actions">
      <button class="btn btn-ghost btn-sm" id="btn-theme-toggle" title="テーマ切り替え" style="font-size: 1.2rem; padding: 4px 8px;">
        <span id="theme-icon">🌞</span>
      </button>
      <button class="btn btn-ghost btn-sm" id="btn-global-help" title="使い方・用語集">
        <span style="font-size: 1.1rem;">❓ ヘルプ</span>
      </button>
      <div class="header-month-selector">
        <button class="header-month-btn" id="prev-month">◀</button>
        <div class="header-month-label" id="current-month-label">
          2025年3月
        </div>
        <button class="header-month-btn" id="next-month">▶</button>
      </div>
    </div>
  `;

    // DOM要素の取得（containerから直接検索）
    const prevBtn = container.querySelector('#prev-month');
    const nextBtn = container.querySelector('#next-month');
    const menuBtn = container.querySelector('#mobile-menu-toggle');

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
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.toggle('open');
            const overlay = document.getElementById('sidebar-overlay');
            if (overlay) overlay.classList.toggle('open');
        });
    }

    const helpBtn = container.querySelector('#btn-global-help');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            import('./help.js').then(module => {
                module.showHelpModal();
            }).catch(err => console.error('Failed to load help module', err));
        });
    }

    const themeToggleBtn = container.querySelector('#btn-theme-toggle');
    const themeIcon = container.querySelector('#theme-icon');

    if (themeToggleBtn && themeIcon) {
        // 初期状態のチェックとアイコン設定
        if (document.documentElement.getAttribute('data-theme') === 'light') {
            themeIcon.textContent = '🌙';
        } else {
            themeIcon.textContent = '🌞';
        }

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'light') {
                // ダークテーマへ変更
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'dark');
                themeIcon.textContent = '🌞';
            } else {
                // ライトテーマへ変更
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                themeIcon.textContent = '🌙';
            }
        });
    }


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
