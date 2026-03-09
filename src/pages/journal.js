import { store } from '../store.js';
import { formatCurrency } from '../utils/format.js';

export function renderJournal() {
  const container = document.createElement('div');
  container.className = 'page-section animate-fade-in';

  container.innerHTML = `
    <div class="card mb-lg">
      <div class="card-header">
        <h3 class="card-title">仕訳帳 - ${store.state.currentYear}年${store.state.currentMonth}月</h3>
        <button class="btn btn-secondary btn-sm" id="btn-export-journal">CSVエクスポート</button>
      </div>
      
      <div class="help-panel" style="margin: 0 var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);">
        <div class="help-panel-icon">💡</div>
        <div class="help-panel-content">
          <div class="help-panel-title">「仕訳帳」とは？</div>
          <div class="help-panel-text">日々入力したすべての取引（売上や経費）が、日付順に1行ずつ記録された「基本の取引日記」です。何にいくら使ったか、いくら入ってきたかが時系列で一覧できます。</div>
        </div>
      </div>
      
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th width="10%">日付</th>
              <th width="20%">借方科目</th>
              <th width="20%">貸方科目</th>
              <th width="15%">摘要</th>
              <th width="10%">取引先</th>
              <th width="15%">タグ</th>
              <th width="10%" class="text-right">金額</th>
            </tr>
          </thead>
          <tbody id="journal-list">
            <tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  return container;
}

export function onJournalMount() {
  if (window._currentUnsubscribe) window._currentUnsubscribe();

  const unsubscribe = store.subscribe(() => {
    updateJournalUI();
  });
  window._currentUnsubscribe = unsubscribe;

  const exportBtn = document.getElementById('btn-export-journal');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const { exportToCSV } = await import('../utils/export.js');
      const { transactions, currentYear, currentMonth } = store.state;

      const data = transactions.map(tx => ({
        '日付': tx.date,
        '借方科目コード': tx.debitAccount,
        '借方科目名': store.getAccountName(tx.debitAccount),
        '貸方科目コード': tx.creditAccount,
        '貸方科目名': store.getAccountName(tx.creditAccount),
        '金額': tx.amount,
        '摘要': tx.description || '',
        '取引先': tx.partner || '',
        'タグ': tx.tags || ''
      }));

      exportToCSV(data, `仕訳帳_${currentYear}年${currentMonth}月`);
    });
  }
}

function updateJournalUI() {
  const { transactions, isLoading } = store.state;
  const listContainer = document.getElementById('journal-list');

  if (!listContainer || isLoading) return;

  if (transactions.length === 0) {
    listContainer.innerHTML = `
      <tr><td colspan="7" class="text-center text-muted" style="padding: 3rem;">
        この月の仕訳データはありません。
      </td></tr>
    `;
    return;
  }

  // 日付の古い順（昇順）で表示（仕訳帳の一般的な表示順）
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  let totalAmount = 0;

  const html = sortedTxs.map(tx => {
    totalAmount += tx.amount;
    const debitName = store.getAccountName(tx.debitAccount);
    const creditName = store.getAccountName(tx.creditAccount);

    return `
      <tr ${tx.isApportionmentAdjustment ? 'style="background: rgba(244, 63, 94, 0.05);"' : ''}>
        <td class="date">${tx.date.replace(/-/g, '/')}</td>
        <td>
          <div class="flex items-center gap-md">
            <span class="text-mono text-muted" style="font-size:0.75rem">${tx.debitAccount}</span>
            <span>${debitName}</span>
          </div>
        </td>
        <td>
          <div class="flex items-center gap-md">
            <span class="text-mono text-muted" style="font-size:0.75rem">${tx.creditAccount}</span>
            <span>${creditName}</span>
          </div>
        </td>
        <td class="text-muted" style="font-size:0.85rem">
          ${tx.description || ''}
          ${tx.isApportionmentAdjustment ? '<span class="badge" style="background: var(--rose-light); color: var(--rose); margin-left: 8px; font-size: 0.7rem;">自動調整仕訳</span>' : ''}
        </td>
        <td class="text-muted" style="font-size:0.85rem">${tx.partner || ''}</td>
        <td class="text-muted" style="font-size:0.85rem">${tx.tags || ''}</td>
        <td class="amount">${formatCurrency(tx.amount)}</td>
      </tr>
    `;
  }).join('');

  listContainer.innerHTML = html;

  // 合計行の追加
  listContainer.insertAdjacentHTML('beforeend', `
    <tr style="background: rgba(15, 23, 42, 0.4);">
      <td colspan="6" class="text-right font-bold">合計</td>
      <td class="amount font-bold text-emerald">${formatCurrency(totalAmount)}</td>
    </tr>
  `);
}
