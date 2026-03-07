import { store } from '../store.js';
import { formatCurrency } from '../utils/format.js';

export function renderDashboard() {
    const container = document.createElement('div');
    container.className = 'page-section animate-fade-in';

    container.innerHTML = `
    <!-- Top Summaries -->
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
        <div class="chart-container" id="dashboard-chart" style="display:flex;align-items:center;justify-content:center;background:var(--bg-card);border-radius:var(--border-radius-sm);">
           <span class="text-muted">グラフエリア</span>
        </div>
      </div>
      
      <!-- 最近の取引 -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">最近の取引 (${store.state.currentMonth}月)</h3>
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
    // Storeを購読してデータを描画
    const unsubscribe = store.subscribe(() => {
        updateDashboardUI();
    });

    // コンポーネントが破棄されたときのクリーンアップのために
    // 本来はルーター側でunsubscribeを呼ぶ仕組みが必要ですが簡易的に配置
    window._currentUnsubscribe = unsubscribe;
}

function updateDashboardUI() {
    const { transactions, isLoading, currentMonth } = store.state;

    if (isLoading) return;

    // 計算
    let totalIncome = 0;
    let totalExpense = 0;

    const recentTxsHTML = [];

    transactions.forEach((tx, idx) => {
        // 科目カテゴリによる判断 (簡易版)
        const debitAccount = store.getAccountByCode(tx.debitAccount);
        const creditAccount = store.getAccountByCode(tx.creditAccount);

        // 売上等
        if (creditAccount?.category === 'revenue') {
            totalIncome += tx.amount;
        }
        // 経費等
        if (debitAccount?.category === 'expense') {
            totalExpense += tx.amount;
        }

        // 最近の取引 (先頭5件)
        if (idx < 5) {
            recentTxsHTML.push(`
        <tr>
          <td class="date">${tx.date.substring(5).replace('-', '/')}</td>
          <td>${tx.description || '摘要なし'}</td>
          <td class="amount ${debitAccount?.category === 'expense' ? 'credit' : 'debit'}">
            ${formatCurrency(tx.amount)}
          </td>
        </tr>
      `);
        }
    });

    const profit = totalIncome - totalExpense;

    // サマリー更新
    const summariesContainer = document.getElementById('dashboard-summaries');
    if (summariesContainer) {
        summariesContainer.innerHTML = `
      <div class="card summary-card income">
        <div class="card-header">
          <h3 class="card-title">${currentMonth}月 収入</h3>
          <div class="card-icon income">📈</div>
        </div>
        <div class="card-value">${formatCurrency(totalIncome)}</div>
      </div>
      
      <div class="card summary-card expense">
        <div class="card-header">
          <h3 class="card-title">${currentMonth}月 支出</h3>
          <div class="card-icon expense">📉</div>
        </div>
        <div class="card-value">${formatCurrency(totalExpense)}</div>
      </div>
      
      <div class="card summary-card profit">
        <div class="card-header">
          <h3 class="card-title">${currentMonth}月 利益</h3>
          <div class="card-icon profit">✨</div>
        </div>
        <div class="card-value ${profit >= 0 ? 'text-emerald' : 'text-rose'}">${formatCurrency(profit)}</div>
      </div>
    `;
    }

    // 最近の取引更新
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
}
