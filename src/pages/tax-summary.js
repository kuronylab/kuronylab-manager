import { store } from '../store.js';
import { db } from '../db.js';
import { formatCurrency } from '../utils/format.js';

export function renderTaxSummary() {
    const container = document.createElement('div');
    container.className = 'page-section animate-fade-in';

    container.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">確定申告サマリー - ${store.state.currentYear}年度</h3>
        </div>
        
        <div id="tax-summary-content">
          <div class="text-center text-muted" style="padding: 2rem;">計算中...</div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">申告ステータスと次のステップ</h3>
        </div>
        
        <div class="mb-lg">
          <div class="tax-highlight">
            <div class="tax-highlight-label">最終的な事業所得金額</div>
            <div class="tax-highlight-value" id="tax-final-income">¥0</div>
          </div>
        </div>
        
        <div class="settings-section">
          <h4 class="font-bold mb-md">確定申告に必要なアクション</h4>
          <ul style="list-style-position: inside; color: var(--text-secondary); line-height: 1.8; padding-left: 0.5rem;">
            <li><span class="text-emerald">✓</span> 日々の取引の記帳を完了する</li>
            <li><span class="text-emerald">✓</span> 減価償却費・家事按分などの決算整理を行う</li>
            <li><span>□</span> <strong>shinkoku CLI</strong> を使用して申告書データを作成する</li>
            <li><span>□</span> <strong>Claude in Chrome</strong> で e-Tax へ自動入力する</li>
          </ul>
        </div>

        <div class="p-4" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--border-radius-sm); margin-top: var(--spacing-lg);">
          <h4 class="font-bold text-emerald mb-sm flex items-center gap-sm">💡 shinkoku連携用データエクスポート</h4>
          <p class="text-sm text-muted mb-md">shinkoku CLI（AIエージェント連動用）向けに今年の仕訳データをエクスポートします。このファイルを shinkoku-main フォルダに配置することで、AIがシームレスに税額計算や e-Tax への入力を行います。</p>
          <button class="btn btn-primary w-full" style="width: 100%; justify-content: center;" id="btn-export-shinkoku">
            📁 shinkoku用エクスポート (JSON)
          </button>
        </div>
      </div>
    </div>
  `;

    return container;
}

export function onTaxSummaryMount() {
    if (window._currentUnsubscribe) window._currentUnsubscribe();

    const unsubscribe = store.subscribe(() => {
        updateTaxSummaryUI();
    });
    window._currentUnsubscribe = unsubscribe;

    const exportBtn = document.getElementById('btn-export-shinkoku');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const { currentYear, settings } = store.state;
            const txs = await db.getTransactionsByYear(currentYear);
            const { exportToJSON } = await import('../utils/export.js');

            const payload = {
                metadata: {
                    system: "KURONYLAB Manager",
                    version: "1.0",
                    exportDate: new Date().toISOString(),
                    fiscalYear: currentYear
                },
                profile: settings,
                journals: txs.map(tx => ({
                    id: tx.id,
                    date: tx.date,
                    debit_account: tx.debitAccount,
                    credit_account: tx.creditAccount,
                    amount: tx.amount,
                    description: tx.description
                }))
            };

            exportToJSON(payload, `shinkoku-data-${currentYear}`);
        });
    }
}

async function updateTaxSummaryUI() {
    const { currentYear, settings, accounts } = store.state;
    const content = document.getElementById('tax-summary-content');
    const finalIncomeEl = document.getElementById('tax-final-income');

    if (!content) return;

    const txs = await db.getTransactionsByYear(currentYear);

    let salesAmount = 0;
    let costOfSales = 0;
    let totalExpense = 0;
    let miscellaneousIncome = 0;

    txs.forEach(tx => {
        const debit = store.getAccountByCode(tx.debitAccount);
        const credit = store.getAccountByCode(tx.creditAccount);

        // 売上高 (4001)
        if (credit && credit.code === '4001') salesAmount += tx.amount;
        if (debit && debit.code === '4001') salesAmount -= tx.amount;

        // 雑収入 (4002)
        if (credit && credit.code === '4002') miscellaneousIncome += tx.amount;
        if (debit && debit.code === '4002') miscellaneousIncome -= tx.amount;

        // 仕入高 (5001)
        if (debit && debit.code === '5001') costOfSales += tx.amount;
        if (credit && credit.code === '5001') costOfSales -= tx.amount;

        // その他経費 (5xxxで5001以外)
        if (debit && debit.category === 'expense' && debit.code !== '5001') totalExpense += tx.amount;
        if (credit && credit.category === 'expense' && credit.code !== '5001') totalExpense -= tx.amount;
    });

    const grossProfit = salesAmount - costOfSales;
    const operatingProfit = grossProfit - totalExpense;
    const incomeBeforeDeduction = operatingProfit + miscellaneousIncome;

    // 青色申告特別控除の計算（実際の利益を上限とする）
    // ※ここでは簡易的に計算。最終的な税法上の計算はshinkokuツールに委譲
    const maxDeduction = settings.taxReturnMethod === 'blue' ? (settings.blueReturnDeduction || 650000) : 0;

    // 事業所得が0以下の場合は控除ゼロ
    let appliedDeduction = 0;
    if (incomeBeforeDeduction > 0) {
        appliedDeduction = Math.min(incomeBeforeDeduction, maxDeduction);
    }

    // 最終的な事業所得
    const finalIncome = Math.max(0, incomeBeforeDeduction - appliedDeduction);

    content.innerHTML = `
    <div class="statement-row">
      <div class="statement-label">売上（収入）金額</div>
      <div class="statement-amount font-bold">${formatCurrency(salesAmount)}</div>
    </div>
    <div class="statement-row">
      <div class="statement-label">雑収入</div>
      <div class="statement-amount">${formatCurrency(miscellaneousIncome)}</div>
    </div>
    <div class="statement-row mt-md">
      <div class="statement-label">売上原価（仕入）</div>
      <div class="statement-amount text-rose">${formatCurrency(costOfSales)}</div>
    </div>
    <div class="statement-row">
      <div class="statement-label">必要経費</div>
      <div class="statement-amount text-rose">${formatCurrency(totalExpense)}</div>
    </div>
    
    <div class="statement-row total mb-lg">
      <div class="statement-label font-bold text-primary">青色申告特別控除前の所得金額</div>
      <div class="statement-amount font-bold text-primary">${formatCurrency(incomeBeforeDeduction)}</div>
    </div>
    
    <div class="statement-row">
      <div class="statement-label">申告方法</div>
      <div class="statement-amount">
        <span class="badge ${settings.taxReturnMethod === 'blue' ? 'badge-income' : 'badge-asset'}">
          ${settings.taxReturnMethod === 'blue' ? '青色申告' : '白色申告'}
        </span>
      </div>
    </div>
    <div class="statement-row">
      <div class="statement-label">青色申告特別控除額</div>
      <div class="statement-amount text-emerald">${formatCurrency(-appliedDeduction)}</div>
    </div>
    
    <div class="statement-row grand-total mt-xl text-primary">
      <div class="statement-label">事業所得金額</div>
      <div class="statement-amount">${formatCurrency(finalIncome)}</div>
    </div>
  `;

    if (finalIncomeEl) {
        finalIncomeEl.textContent = formatCurrency(finalIncome);
    }
}
