import { store } from '../store.js';
import { formatCurrency } from '../utils/format.js';

let currentDashboardView = localStorage.getItem('kuronylab_dashboard_view') || 'month';
let currentDashboardSearchQuery = '';

export function renderDashboard() {
  const container = document.createElement('div');
  container.className = 'page-section animate-fade-in';

  container.innerHTML = `
    <!-- Top Summaries & View Toggle & Search -->
    <div class="flex flex-col mb-md" style="gap: var(--spacing-sm);">
      <div class="flex flex-between align-center">
        <h2 class="page-title" style="margin:0;">ダッシュボード</h2>
        <div class="toggle-group" style="display: flex; gap: 0.25rem; background: var(--bg-card); padding: 0.25rem; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
          <button id="btn-view-month" class="btn btn-sm ${currentDashboardView === 'month' ? 'btn-primary' : 'btn-outline'}" style="border: none; border-radius: var(--border-radius-sm);">今月</button>
          <button id="btn-view-year" class="btn btn-sm ${currentDashboardView === 'year' ? 'btn-primary' : 'btn-outline'}" style="border: none; border-radius: var(--border-radius-sm);">今年</button>
        </div>
      </div>
      
      <!-- 検索バー -->
      <div class="search-bar" style="max-width: 400px; width: 100%;">
        <div class="input-with-icon">
          <span class="icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);">🔍</span>
          <input type="text" id="dashboard-search" class="form-input" placeholder="摘要、タグ、取引先で検索..." value="${currentDashboardSearchQuery}" style="padding-left: 2.5rem; width: 100%;">
        </div>
      </div>
    </div>
    
    <div class="summary-cards" id="dashboard-summaries">
      <div class="card summary-card income skeleton" style="min-height: 120px;"></div>
      <div class="card summary-card expense skeleton" style="min-height: 120px;"></div>
      <div class="card summary-card profit skeleton" style="min-height: 120px;"></div>
    </div>
    
    <div class="grid-2 mt-lg">
      <!-- 収支推移ダミー領域 (Chart.jsが後で実装されることを想定) -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">収支推移 (${store.state.currentYear}年)</h3>
        </div>
        <div class="chart-container" style="position: relative; height: 300px; width: 100%; background:var(--bg-card); border-radius:var(--border-radius-sm); padding: var(--spacing-md);">
           <canvas id="dashboard-chart"></canvas>
        </div>
      </div>
      
      <!-- 最近の取引 -->
      <div class="card">
        <div class="card-header flex-between align-center">
          <h3 class="card-title" id="dashboard-recent-txs-title">最近の取引</h3>
        </div>
        <div class="table-wrapper" style="max-height: 300px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>摘要</th>
                <th class="text-right">金額</th>
              </tr>
            </thead>
            <tbody id="dashboard-recent-txs">
              <tr><td colspan="3" class="text-center text-muted" style="padding: 2rem;">読み込み中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  return container;
}

export function onDashboardMount() {
  const btnMonth = document.getElementById('btn-view-month');
  const btnYear = document.getElementById('btn-view-year');

  if (btnMonth && btnYear) {
    btnMonth.addEventListener('click', () => {
      if (currentDashboardView === 'month') return;
      currentDashboardView = 'month';
      localStorage.setItem('kuronylab_dashboard_view', 'month');
      btnMonth.className = 'btn btn-sm btn-primary';
      btnYear.className = 'btn btn-sm btn-outline';
      updateDashboardUI();
    });

    btnYear.addEventListener('click', () => {
      if (currentDashboardView === 'year') return;
      currentDashboardView = 'year';
      localStorage.setItem('kuronylab_dashboard_view', 'year');
      btnYear.className = 'btn btn-sm btn-primary';
      btnMonth.className = 'btn btn-sm btn-outline';
      updateDashboardUI();
    });
  }

  const searchInput = document.getElementById('dashboard-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentDashboardSearchQuery = e.target.value.toLowerCase().trim();
      updateDashboardUI();
    });
  }

  // Storeを購読してデータを描画
  const unsubscribe = store.subscribe(() => {
    updateDashboardUI();
  });

  // コンポーネントが破棄されたときのクリーンアップのために
  // 本来はルーター側でunsubscribeを呼ぶ仕組みが必要ですが簡易的に配置
  window._currentUnsubscribe = unsubscribe;
}

async function updateDashboardUI() {
  const { isLoading, currentMonth, currentYear } = store.state;

  if (isLoading) return;

  // 年次表示の場合は1年分のデータをDBから直接取得し、月次表示の場合はStoreのキャッシュ（単月）を使用するか、
  // あるいは一貫性のために常に1年分のデータを取得してクライアント側でフィルタリングする方が安全です。
  // ここではより正確な年間グラフと年次サマリーを描画するため、常に今年1年分の全データを取得します。
  const { db } = await import('../db.js');
  const allYearTransactions = await db.getTransactionsByYear(currentYear);

  // 計算
  let totalIncome = 0;
  let totalExpense = 0;
  const filteredRecentTxs = [];

  // グラフ用月別集計データ
  const monthlyData = {
    incomes: new Array(12).fill(0),
    expenses: new Array(12).fill(0)
  };

  // 検索クエリが存在する場合にAND検索するためのキーワード配列
  const searchKeywords = currentDashboardSearchQuery.split(/\s+/).filter(k => k);

  allYearTransactions.forEach((tx) => {
    // 検索フィルタリング
    if (searchKeywords.length > 0) {
      const targetString = [
        tx.description,
        tx.tags,
        tx.partner,
        tx.amount.toString()
      ].filter(Boolean).join(' ').toLowerCase();

      const isMatch = searchKeywords.every(keyword => targetString.includes(keyword));
      if (!isMatch) return; // 検索に合致しなければスキップ
    }

    const debitAccount = store.getAccountByCode(tx.debitAccount);
    const creditAccount = store.getAccountByCode(tx.creditAccount);

    const txDate = new Date(tx.date);
    const txMonthZeroIndexed = txDate.getMonth(); // 0-11

    const isCurrentMonthTx = (txMonthZeroIndexed === currentMonth - 1);
    const belongsToCurrentView = currentDashboardView === 'year' || isCurrentMonthTx;

    // 売上等
    if (creditAccount?.category === 'revenue') {
      if (belongsToCurrentView) totalIncome += tx.amount;
      monthlyData.incomes[txMonthZeroIndexed] += tx.amount;
    }
    // 経費等
    if (debitAccount?.category === 'expense') {
      if (belongsToCurrentView) totalExpense += tx.amount;
      monthlyData.expenses[txMonthZeroIndexed] += tx.amount;
    }

    // 今のビューに該当する直近の取引を収集
    if (belongsToCurrentView) {
      filteredRecentTxs.push(tx);
    }
  });

  // 年間データは日付昇順（getTransactionsByYearの仕様）なので、最近の取引表示用に降順にリバースする
  filteredRecentTxs.reverse();


  const recentTxsHTML = filteredRecentTxs.slice(0, 5).map(tx => {
    const debitAccount = store.getAccountByCode(tx.debitAccount);
    const partnerPrefix = tx.partner ? `<span class="text-xs text-muted" style="margin-right:4px;">[${tx.partner}]</span>` : '';
    return `
      <tr>
        <td class="date">${tx.date.substring(5).replace('-', '/')}</td>
        <td>${partnerPrefix}${tx.description || '摘要なし'}</td>
        <td class="amount ${debitAccount?.category === 'expense' ? 'credit' : 'debit'}">
          ${formatCurrency(tx.amount)}
        </td>
      </tr>
    `;
  });

  const profit = totalIncome - totalExpense;

  // タイトルの設定
  const titlePrefix = currentDashboardView === 'month' ? `${currentMonth}月` : `${store.state.currentYear}年`;

  // サマリー更新
  const summariesContainer = document.getElementById('dashboard-summaries');
  if (summariesContainer) {
    summariesContainer.innerHTML = `
      <div class="card summary-card income">
        <div class="card-header">
          <h3 class="card-title">${titlePrefix} 収入</h3>
          <div class="card-icon income">📈</div>
        </div>
        <div class="card-value" data-target="${totalIncome}">¥0</div>
      </div>
      
      <div class="card summary-card expense">
        <div class="card-header">
          <h3 class="card-title">${titlePrefix} 支出</h3>
          <div class="card-icon expense">📉</div>
        </div>
        <div class="card-value" data-target="${totalExpense}">¥0</div>
      </div>
      
      <div class="card summary-card profit">
        <div class="card-header">
          <h3 class="card-title">${titlePrefix} 利益</h3>
          <div class="card-icon profit">✨</div>
        </div>
        <div class="card-value ${profit >= 0 ? 'text-emerald' : 'text-rose'}" data-target="${profit}">¥0</div>
      </div>
    `;

    // アニメーション適用
    requestAnimationFrame(() => {
      document.querySelectorAll('#dashboard-summaries .card-value').forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        animateValue(el, 0, target, 800);
      });
    });
  }

  // 最近の取引タイトル更新
  const recentTxsTitle = document.getElementById('dashboard-recent-txs-title');
  if (recentTxsTitle) {
    recentTxsTitle.textContent = `最近の取引 (${titlePrefix})`;
  }

  // 最近の取引更新...
  const recentTxsContainer = document.getElementById('dashboard-recent-txs');
  if (recentTxsContainer) {
    if (recentTxsHTML.length > 0) {
      recentTxsContainer.innerHTML = recentTxsHTML.join('');
    } else {
      recentTxsContainer.innerHTML = `
        <tr><td colspan="3" class="text-center text-muted" style="padding: 2rem;">取引データがありません</td></tr>
      `;
    }
  }

  // グラフの描画
  const canvas = document.getElementById('dashboard-chart');
  if (canvas) {
    import('../components/chart.js').then(module => {
      module.renderIncomeExpenseChart(canvas, monthlyData);
    }).catch(err => console.error('Failed to load chart module', err));
  }
}

// カウントアップアニメーション関数
function animateValue(obj, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // イーズアウト
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(easeProgress * (end - start) + start);

    obj.innerHTML = formatCurrency(current);

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = formatCurrency(end); // 最終値を確実にセット
    }
  };
  window.requestAnimationFrame(step);
}
