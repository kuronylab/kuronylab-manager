import { store } from '../store.js';
import { db } from '../db.js';
import { formatCurrency } from '../utils/format.js';

export function renderTrialBalance() {
  const container = document.createElement('div');
  container.className = 'page-section animate-fade-in';

  container.innerHTML = `
    <div class="card mb-lg">
      <div class="card-header">
        <h3 class="card-title">残高試算表 - ${store.state.currentYear}年${store.state.currentMonth}月時点</h3>
        <button class="btn btn-secondary btn-sm" id="btn-export-tb">CSVエクスポート</button>
      </div>
      
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th width="20%" class="text-center">借方残高</th>
              <th width="40%" class="text-center">勘定科目</th>
              <th width="40%" class="text-center">貸方残高</th>
            </tr>
          </thead>
          <tbody id="tb-list">
            <tr><td colspan="3" class="text-center text-muted" style="padding: 2rem;">計算中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  return container;
}

export function onTrialBalanceMount() {
  if (window._currentUnsubscribe) window._currentUnsubscribe();

  const unsubscribe = store.subscribe(() => {
    updateTrialBalanceUI();
  });
  window._currentUnsubscribe = unsubscribe;

  // Export button
  const exportBtn = document.getElementById('btn-export-tb');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const { exportToCSV } = await import('../utils/export.js');
      const { currentYear, currentMonth, accounts } = store.state;

      const allYearTxs = await db.getTransactionsByYear(currentYear);
      const targetMonthEnd = new Date(currentYear, currentMonth, 0).getTime();
      const txs = allYearTxs.filter(tx => new Date(tx.date).getTime() <= targetMonthEnd);

      const balances = {};
      accounts.forEach(acc => {
        balances[acc.code] = { code: acc.code, name: acc.name, category: acc.category, balance: 0 };
      });

      txs.forEach(tx => {
        const debit = balances[tx.debitAccount];
        const credit = balances[tx.creditAccount];
        if (debit) {
          const isDebitPlus = ['asset', 'expense'].includes(debit.category);
          debit.balance += isDebitPlus ? tx.amount : -tx.amount;
        }
        if (credit) {
          const isCreditPlus = ['liability', 'equity', 'revenue'].includes(credit.category);
          credit.balance += isCreditPlus ? tx.amount : -tx.amount;
        }
      });

      const categoryOrder = { 'asset': 1, 'liability': 2, 'equity': 3, 'revenue': 4, 'expense': 5 };
      const activeBalances = Object.values(balances)
        .filter(b => b.balance !== 0)
        .sort((a, b) => {
          if (categoryOrder[a.category] !== categoryOrder[b.category]) return categoryOrder[a.category] - categoryOrder[b.category];
          return a.code.localeCompare(b.code);
        });

      let totalDebit = 0;
      let totalCredit = 0;

      const data = activeBalances.map(b => {
        const isDebitSide = ['asset', 'expense'].includes(b.category);
        let debitBal = '';
        let creditBal = '';
        if (isDebitSide) {
          debitBal = b.balance;
          totalDebit += b.balance;
        } else {
          creditBal = b.balance;
          totalCredit += b.balance;
        }
        return {
          '借方残高': debitBal,
          '勘定科目一覧': `${b.name} (${b.code})`,
          '貸方残高': creditBal
        };
      });

      data.push({
        '借方残高': totalDebit,
        '勘定科目一覧': '合計',
        '貸方残高': totalCredit
      });

      exportToCSV(data, `残高試算表_${currentYear}年${currentMonth}月`);
    });
  }
}

async function updateTrialBalanceUI() {
  const { currentYear, currentMonth, accounts } = store.state;
  const listContainer = document.getElementById('tb-list');

  if (!listContainer) return;

  // 今月分までの全取引を取得（年初から指定月末まで）
  const allYearTxs = await db.getTransactionsByYear(currentYear);
  const targetMonthEnd = new Date(currentYear, currentMonth, 0).getTime();

  const txs = allYearTxs.filter(tx => new Date(tx.date).getTime() <= targetMonthEnd);

  if (txs.length === 0) {
    listContainer.innerHTML = `
      <tr><td colspan="3" class="text-center text-muted" style="padding: 3rem;">
        計算対象の取引データがありません。
      </td></tr>
    `;
    return;
  }

  // 科目ごとの残高を集計
  const balances = {};
  accounts.forEach(acc => {
    balances[acc.code] = {
      code: acc.code,
      name: acc.name,
      category: acc.category,
      type: acc.type,
      balance: 0
    };
  });

  txs.forEach(tx => {
    const debit = balances[tx.debitAccount];
    const credit = balances[tx.creditAccount];

    if (debit) {
      const isDebitPlus = ['asset', 'expense'].includes(debit.category);
      debit.balance += isDebitPlus ? tx.amount : -tx.amount;
    }

    if (credit) {
      const isCreditPlus = ['liability', 'equity', 'revenue'].includes(credit.category);
      credit.balance += isCreditPlus ? tx.amount : -tx.amount;
    }
  });

  // 残高がある科目のみ抽出し、区分順・コード順でソート
  const categoryOrder = { 'asset': 1, 'liability': 2, 'equity': 3, 'revenue': 4, 'expense': 5 };

  const activeBalances = Object.values(balances)
    .filter(b => b.balance !== 0)
    .sort((a, b) => {
      if (categoryOrder[a.category] !== categoryOrder[b.category]) {
        return categoryOrder[a.category] - categoryOrder[b.category];
      }
      return a.code.localeCompare(b.code);
    });

  let totalDebit = 0;
  let totalCredit = 0;

  const html = activeBalances.map(b => {
    const isDebitSide = ['asset', 'expense'].includes(b.category);

    if (isDebitSide) {
      totalDebit += b.balance;
      return `
        <tr>
          <td class="amount text-emerald text-center">${formatCurrency(b.balance)}</td>
          <td class="text-center font-bold">${b.name} <span class="text-muted text-mono" style="font-size:0.7em">${b.code}</span></td>
          <td class="text-center"></td>
        </tr>
      `;
    } else {
      totalCredit += b.balance;
      return `
        <tr>
          <td class="text-center"></td>
          <td class="text-center font-bold">${b.name} <span class="text-muted text-mono" style="font-size:0.7em">${b.code}</span></td>
          <td class="amount text-rose text-center">${formatCurrency(b.balance)}</td>
        </tr>
      `;
    }
  }).join('');

  listContainer.innerHTML = html;

  // 合計行
  listContainer.insertAdjacentHTML('beforeend', `
    <tr style="background: rgba(15, 23, 42, 0.4); border-top: 2px solid var(--border-color);">
      <td class="amount font-bold text-center ${totalDebit === totalCredit ? 'text-emerald' : 'text-rose'}">${formatCurrency(totalDebit)}</td>
      <td class="text-center font-bold">合計</td>
      <td class="amount font-bold text-center ${totalDebit === totalCredit ? 'text-emerald' : 'text-rose'}">${formatCurrency(totalCredit)}</td>
    </tr>
  `);
}
