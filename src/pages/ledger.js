import { store } from '../store.js';
import { db } from '../db.js';
import { formatCurrency } from '../utils/format.js';

export function renderLedger() {
  const container = document.createElement('div');
  container.className = 'page-section animate-fade-in';

  // 勘定科目のセレクトボックス生成
  const accountOptions = store.state.accounts.map(acc =>
    `<option value="${acc.code}">${acc.code} ${acc.name}</option>`
  ).join('');

  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="form-group" style="margin-bottom: 0;">
          <select id="ledger-account-select" class="form-select" style="min-width: 250px;">
            <option value="">科目を選択してください...</option>
            ${accountOptions}
          </select>
        </div>
      </div>
    </div>
    
    <div class="card" id="ledger-content" style="display: none;">
      <div class="card-header">
        <h3 class="card-title" id="ledger-title">総勘定元帳</h3>
        <button class="btn btn-secondary btn-sm" id="btn-export-ledger" style="display: none;">CSVエクスポート</button>
      </div>
      
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th width="15%">日付</th>
              <th width="25%">相手科目</th>
              <th width="20%">摘要</th>
              <th width="13%" class="text-right">借方</th>
              <th width="13%" class="text-right">貸方</th>
              <th width="14%" class="text-right">差引残高</th>
            </tr>
          </thead>
          <tbody id="ledger-list">
            <!-- 動的生成 -->
          </tbody>
        </table>
      </div>
    </div>
    
    <div id="ledger-empty" class="empty-state">
      <span class="empty-state-icon">📒</span>
      <h3 class="empty-state-title">勘定科目を選択</h3>
      <p class="empty-state-description">上部のドロップダウンから確認したい勘定科目を選択してください。</p>
    </div>
  `;

  return container;
}

export function onLedgerMount() {
  if (window._currentUnsubscribe) window._currentUnsubscribe();

  const unsubscribe = store.subscribe(() => {
    // 選択されている科目があれば再計算
    const select = document.getElementById('ledger-account-select');
    if (select && select.value) {
      updateLedgerUI(select.value);
    }
  });
  window._currentUnsubscribe = unsubscribe;

  const select = document.getElementById('ledger-account-select');
  if (select) {
    // 初期選択（現金など）があればセットしたいが、今回は空にする
    select.addEventListener('change', (e) => {
      const code = e.target.value;
      if (code) {
        document.getElementById('ledger-empty').style.display = 'none';
        document.getElementById('ledger-content').style.display = 'block';
        updateLedgerUI(code);
      } else {
        document.getElementById('ledger-empty').style.display = 'flex';
        document.getElementById('ledger-content').style.display = 'none';
      }
    });
  }

  const exportBtn = document.getElementById('btn-export-ledger');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const select = document.getElementById('ledger-account-select');
      if (!select || !select.value) return;
      const accountCode = select.value;
      const account = store.getAccountByCode(accountCode);
      const { currentYear } = store.state;

      const { exportToCSV } = await import('../utils/export.js');
      const txs = await db.getTransactionsByYear(currentYear);
      const targetTxs = txs.filter(tx => tx.debitAccount === accountCode || tx.creditAccount === accountCode);

      let balance = 0;
      const isDebitPlus = ['asset', 'expense'].includes(account.category);

      const data = targetTxs.map(tx => {
        let debitAmount = '';
        let creditAmount = '';
        let oppAccountCode = '';

        if (tx.debitAccount === accountCode) {
          debitAmount = tx.amount;
          oppAccountCode = tx.creditAccount;
          balance += isDebitPlus ? tx.amount : -tx.amount;
        }
        if (tx.creditAccount === accountCode) {
          creditAmount = tx.amount;
          oppAccountCode = tx.debitAccount;
          balance += isDebitPlus ? -tx.amount : tx.amount;
        }

        const oppAccountName = store.getAccountName(oppAccountCode);

        return {
          '日付': tx.date,
          '相手科目': oppAccountName,
          '摘要': tx.description || '',
          '借方': debitAmount,
          '貸方': creditAmount,
          '差引残高': balance
        };
      });

      exportToCSV(data, `総勘定元帳_${account.name}_${currentYear}年`);
    });
  }
}

async function updateLedgerUI(accountCode) {
  const { currentYear } = store.state;
  const listContainer = document.getElementById('ledger-list');
  const title = document.getElementById('ledger-title');

  if (!listContainer || !accountCode) return;

  const account = store.getAccountByCode(accountCode);
  title.textContent = `総勘定元帳 - ${account.name} (${currentYear}年)`;

  listContainer.innerHTML = `<tr><td colspan="6" class="text-center text-muted">計算中...</td></tr>`;

  // 年間の全取引を取得
  const txs = await db.getTransactionsByYear(currentYear);

  // 対象科目の取引のみ抽出
  const targetTxs = txs.filter(tx => tx.debitAccount === accountCode || tx.creditAccount === accountCode);

  const exportBtn = document.getElementById('btn-export-ledger');

  if (targetTxs.length === 0) {
    if (exportBtn) exportBtn.style.display = 'none';
    listContainer.innerHTML = `
      <tr><td colspan="6" class="text-center text-muted" style="padding: 3rem;">
        ${currentYear}年の取引データはありません。
      </td></tr>
    `;
    return;
  }

  if (exportBtn) exportBtn.style.display = 'inline-block';

  let balance = 0;
  // 資産・費用は借方でプラス、負債・純資産・収益は貸方でプラス
  const isDebitPlus = ['asset', 'expense'].includes(account.category);

  const html = targetTxs.map(tx => {
    let debitAmount = null;
    let creditAmount = null;
    let oppAccountCode = '';

    if (tx.debitAccount === accountCode) {
      debitAmount = tx.amount;
      oppAccountCode = tx.creditAccount;
      balance += isDebitPlus ? tx.amount : -tx.amount;
    }
    if (tx.creditAccount === accountCode) {
      creditAmount = tx.amount;
      oppAccountCode = tx.debitAccount;
      balance += isDebitPlus ? -tx.amount : tx.amount;
    }

    const oppAccountName = store.getAccountName(oppAccountCode);

    return `
      <tr>
        <td class="date">${tx.date.replace(/-/g, '/')}</td>
        <td>${oppAccountName}</td>
        <td class="text-muted" style="font-size:0.85rem">${tx.description || ''}</td>
        <td class="amount text-emerald">${debitAmount ? formatCurrency(debitAmount) : ''}</td>
        <td class="amount text-rose">${creditAmount ? formatCurrency(creditAmount) : ''}</td>
        <td class="amount font-bold">${formatCurrency(balance)}</td>
      </tr>
    `;
  }).join('');

  listContainer.innerHTML = html;
}
