import { store } from '../store.js';
import { db } from '../db.js';
import { formatCurrency } from '../utils/format.js';

export function renderBS() {
  const container = document.createElement('div');
  container.className = 'page-section animate-fade-in';

  container.innerHTML = `
    <div class="card mb-lg">
      <div class="card-header">
        <h3 class="card-title">貸借対照表 (B/S) - ${store.state.currentYear}年期末</h3>
        <button class="btn btn-secondary btn-sm" id="btn-export-bs">CSVエクスポート</button>
      </div>
      
      <div class="grid-2">
        <!-- 資産の部 -->
        <div>
          <div class="statement-section-title">資産の部</div>
          <div id="bs-assets"><div class="text-center text-muted p-4">計算中...</div></div>
        </div>
        
        <!-- 負債・純資産の部 -->
        <div>
          <div class="statement-section-title">負債・純資産の部</div>
          <div id="bs-liabilities-equity"><div class="text-center text-muted p-4">計算中...</div></div>
        </div>
      </div>
    </div>
  `;

  return container;
}

export function onBSMount() {
  if (window._currentUnsubscribe) window._currentUnsubscribe();

  const unsubscribe = store.subscribe(() => {
    updateBSUI();
  });
  window._currentUnsubscribe = unsubscribe;
  const exportBtn = document.getElementById('btn-export-bs');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const { currentYear, accounts } = store.state;
      const txs = await db.getTransactionsByYear(currentYear);
      const { exportToCSV } = await import('../utils/export.js');

      const balances = { asset: {}, liability: {}, equity: {}, revenue: {}, expense: {} };
      accounts.forEach(acc => { balances[acc.category][acc.code] = { name: acc.name, balance: 0 }; });

      txs.forEach(tx => {
        const debit = store.getAccountByCode(tx.debitAccount);
        const credit = store.getAccountByCode(tx.creditAccount);

        if (debit) {
          if (['asset', 'expense'].includes(debit.category)) balances[debit.category][debit.code].balance += tx.amount;
          else balances[debit.category][debit.code].balance -= tx.amount;
        }
        if (credit) {
          if (['liability', 'equity', 'revenue'].includes(credit.category)) balances[credit.category][credit.code].balance += tx.amount;
          else balances[credit.category][credit.code].balance -= tx.amount;
        }
      });

      const totalRevenue = Object.values(balances.revenue).reduce((sum, item) => sum + item.balance, 0);
      const totalExpense = Object.values(balances.expense).reduce((sum, item) => sum + item.balance, 0);
      const netIncome = totalRevenue - totalExpense;

      const activeAssets = Object.values(balances.asset).filter(item => item.balance !== 0).sort((a, b) => b.balance - a.balance);
      const activeLiabilities = Object.values(balances.liability).filter(item => item.balance !== 0).sort((a, b) => b.balance - a.balance);
      const activeEquity = Object.values(balances.equity).filter(item => item.balance !== 0).sort((a, b) => b.balance - a.balance);

      let totalAssets = activeAssets.reduce((sum, item) => sum + item.balance, 0);
      let totalLiabilities = activeLiabilities.reduce((sum, item) => sum + item.balance, 0);
      let totalEquity = activeEquity.reduce((sum, item) => sum + item.balance, 0) + netIncome;

      const data = [];
      data.push({ '区分': '【資産の部】', '科目': '', '金額': '' });
      activeAssets.forEach(item => data.push({ '区分': '', '科目': item.name, '金額': item.balance }));
      data.push({ '区分': '資産の部 合計', '科目': '', '金額': totalAssets });

      data.push({ '区分': '', '科目': '', '金額': '' });

      data.push({ '区分': '【負債の部】', '科目': '', '金額': '' });
      activeLiabilities.forEach(item => data.push({ '区分': '', '科目': item.name, '金額': item.balance }));
      data.push({ '区分': '負債の部 合計', '科目': '', '金額': totalLiabilities });

      data.push({ '区分': '', '科目': '', '金額': '' });

      data.push({ '区分': '【純資産の部】', '科目': '', '金額': '' });
      activeEquity.forEach(item => data.push({ '区分': '', '科目': item.name, '金額': item.balance }));
      data.push({ '区分': '', '科目': '青色申告特別控除前の所得金額', '金額': netIncome });
      data.push({ '区分': '純資産の部 合計', '科目': '', '金額': totalEquity });

      data.push({ '区分': '', '科目': '', '金額': '' });

      data.push({ '区分': '負債・純資産の部 合計', '科目': '', '金額': totalLiabilities + totalEquity });

      exportToCSV(data, `貸借対照表_${currentYear}年`);
    });
  }
}

async function updateBSUI() {
  const { currentYear, accounts } = store.state;
  const assetsContainer = document.getElementById('bs-assets');
  const leContainer = document.getElementById('bs-liabilities-equity');

  if (!assetsContainer || !leContainer) return;

  const txs = await db.getTransactionsByYear(currentYear);

  // BS科目の初期化
  const balances = {
    asset: {},
    liability: {},
    equity: {},
    revenue: {}, // P/L計算用
    expense: {}  // P/L計算用
  };

  accounts.forEach(acc => {
    balances[acc.category][acc.code] = { name: acc.name, balance: 0 };
  });

  // 全取引の集計
  txs.forEach(tx => {
    const debit = store.getAccountByCode(tx.debitAccount);
    const credit = store.getAccountByCode(tx.creditAccount);

    // 借方は資産・費用が増加、負債・純資産・収益が減少
    if (debit) {
      if (['asset', 'expense'].includes(debit.category)) balances[debit.category][debit.code].balance += tx.amount;
      else balances[debit.category][debit.code].balance -= tx.amount;
    }

    // 貸方は負債・純資産・収益が増加、資産・費用が減少
    if (credit) {
      if (['liability', 'equity', 'revenue'].includes(credit.category)) balances[credit.category][credit.code].balance += tx.amount;
      else balances[credit.category][credit.code].balance -= tx.amount;
    }
  });

  // 当期純利益（青色申告特別控除前）の計算
  const totalRevenue = Object.values(balances.revenue).reduce((sum, item) => sum + item.balance, 0);
  const totalExpense = Object.values(balances.expense).reduce((sum, item) => sum + item.balance, 0);
  const netIncome = totalRevenue - totalExpense;

  // --- 資産の部の描画 ---
  let totalAssets = 0;
  const activeAssets = Object.values(balances.asset)
    .filter(item => item.balance !== 0)
    .sort((a, b) => b.balance - a.balance);

  const assetsHtml = activeAssets.map(item => {
    totalAssets += item.balance;
    return `
      <div class="statement-row">
        <div class="statement-label">${item.name}</div>
        <div class="statement-amount">${formatCurrency(item.balance)}</div>
      </div>
    `;
  }).join('');

  assetsContainer.innerHTML = `
    ${assetsHtml || '<div class="statement-row text-muted">資産はありません</div>'}
    <div class="statement-row grand-total mt-xl text-primary">
      <div class="statement-label font-bold text-primary">資産の部 合計</div>
      <div class="statement-amount">${formatCurrency(totalAssets)}</div>
    </div>
  `;

  // --- 負債・純資産の部の描画 ---
  let totalLiabilities = 0;
  let totalEquity = 0;

  const activeLiabilities = Object.values(balances.liability)
    .filter(item => item.balance !== 0)
    .sort((a, b) => b.balance - a.balance);

  const activeEquity = Object.values(balances.equity)
    .filter(item => item.balance !== 0)
    .sort((a, b) => b.balance - a.balance);

  const liabHtml = activeLiabilities.map(item => {
    totalLiabilities += item.balance;
    return `
      <div class="statement-row">
        <div class="statement-label">${item.name}</div>
        <div class="statement-amount">${formatCurrency(item.balance)}</div>
      </div>
    `;
  }).join('');

  const equityHtml = activeEquity.map(item => {
    totalEquity += item.balance;
    return `
      <div class="statement-row">
        <div class="statement-label">${item.name}</div>
        <div class="statement-amount">${formatCurrency(item.balance)}</div>
      </div>
    `;
  }).join('');

  // 元入金等 + 当期純利益
  totalEquity += netIncome;

  leContainer.innerHTML = `
    <div class="font-bold text-muted mb-sm text-sm">負債</div>
    ${liabHtml || '<div class="statement-row text-muted">負債はありません</div>'}
    <div class="statement-row total mb-lg">
      <div class="statement-label">負債 合計</div>
      <div class="statement-amount">${formatCurrency(totalLiabilities)}</div>
    </div>
    
    <div class="font-bold text-muted mb-sm mt-lg text-sm">純資産（資本）</div>
    ${equityHtml}
    <div class="statement-row text-emerald">
      <div class="statement-label">青色申告特別控除前の所得金額</div>
      <div class="statement-amount">${formatCurrency(netIncome)}</div>
    </div>
    <div class="statement-row total mb-md">
      <div class="statement-label">純資産 合計</div>
      <div class="statement-amount">${formatCurrency(totalEquity)}</div>
    </div>
    
    <div class="statement-row grand-total mt-lg text-primary">
      <div class="statement-label font-bold text-primary">負債・純資産の部 合計</div>
      <div class="statement-amount">${formatCurrency(totalLiabilities + totalEquity)}</div>
    </div>
  `;
}
