import { store } from '../store.js';
import { db } from '../db.js';
import { formatCurrency, generateId } from '../utils/format.js';
import { showToast } from '../components/toast.js';

export function renderInventory() {
    const container = document.createElement('div');
    container.className = 'page-section animate-fade-in';

    container.innerHTML = `
    <div class="card mb-lg">
      <div class="card-header">
        <h3 class="card-title">棚卸資産（在庫）の設定 - ${store.state.currentYear}年度</h3>
      </div>
      <div class="p-md">
        <p class="text-sm text-muted mb-lg">
          EC販売業では、年末（12月31日）時点で手元に残っている商品の原価を「期末棚卸高」として計上する必要があります。
          これにより、正しい売上原価が計算されます。
        </p>

        <form id="inventory-form">
          <div class="grid-2">
            <div class="form-group">
                <label class="form-label">期首棚卸高（1月1日時点の在庫額）</label>
                <div class="input-with-unit">
                    <input type="number" id="inv-opening" class="form-input" placeholder="0">
                    <span class="unit">円</span>
                </div>
                <small class="text-xs text-muted">前年末の期末棚卸高と同じ額を入力します</small>
            </div>
            
            <div class="form-group">
                <label class="form-label">期末棚卸高（12月31日時点の在庫額）</label>
                <div class="input-with-unit">
                    <input type="number" id="inv-closing" class="form-input" placeholder="0">
                    <span class="unit">円</span>
                </div>
                <small class="text-xs text-muted">今年の年末に売れ残っている商品の仕入原価です</small>
            </div>
          </div>

          <div class="mt-lg">
            <button type="button" id="btn-save-inventory" class="btn btn-primary">
                在庫仕訳を生成・更新する
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="help-panel">
      <div class="help-panel-icon">💡</div>
      <div class="help-panel-content">
        <div class="help-panel-title">在庫仕訳の役割</div>
        <div class="help-panel-text">
          この設定を保存すると、以下の2つの振替仕訳が自動的に生成（または更新）されます：<br>
          1. 1/1： <b>仕入高 (費用) / 棚卸資産 (資産)</b> （期首在庫を費用に振替）<br>
          2. 12/31： <b>棚卸資産 (資産) / 仕入高 (費用)</b> （売れ残りを資産に振替）
        </div>
      </div>
    </div>
  `;

    return container;
}

export async function onInventoryMount() {
    const loadInventoryData = async () => {
        const year = store.state.currentYear;
        const txs = await db.getTransactionsByYear(year);

        // 期首・期末の在庫仕訳を探す
        const openingTx = txs.find(t => t.date === `${year}-01-01` && t.description.includes('期首棚卸'));
        const closingTx = txs.find(t => t.date === `${year}-12-31` && t.description.includes('期末棚卸'));

        if (openingTx) {
            document.getElementById('inv-opening').value = openingTx.amount;
        }
        if (closingTx) {
            document.getElementById('inv-closing').value = closingTx.amount;
        }
    };

    await loadInventoryData();

    const saveBtn = document.getElementById('btn-save-inventory');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const year = store.state.currentYear;
            const openingAmount = parseInt(document.getElementById('inv-opening').value, 10) || 0;
            const closingAmount = parseInt(document.getElementById('inv-closing').value, 10) || 0;

            try {
                const txs = await db.getTransactionsByYear(year);
                const existingOpening = txs.find(t => t.date === `${year}-01-01` && t.description.includes('期首棚卸'));
                const existingClosing = txs.find(t => t.date === `${year}-12-31` && t.description.includes('期末棚卸'));

                // 期首棚卸の処理
                if (openingAmount > 0) {
                    const openingData = {
                        id: existingOpening ? existingOpening.id : generateId(),
                        date: `${year}-01-01`,
                        debitAccount: '5001', // 仕入高
                        creditAccount: '1004', // 棚卸資産
                        amount: openingAmount,
                        description: '[自動] 期首棚卸高振替',
                        tags: '決算整理',
                        usageType: 'business_only',
                        businessUseRatio: 100
                    };
                    if (existingOpening) await db.updateTransaction(openingData);
                    else await db.addTransaction(openingData);
                } else if (existingOpening) {
                    await db.deleteTransaction(existingOpening.id);
                }

                // 期末棚卸の処理
                if (closingAmount > 0) {
                    const closingData = {
                        id: existingClosing ? existingClosing.id : generateId(),
                        date: `${year}-12-31`,
                        debitAccount: '1004', // 棚卸資産
                        creditAccount: '5001', // 仕入高
                        amount: closingAmount,
                        description: '[自動] 期末棚卸高振替',
                        tags: '決算整理',
                        usageType: 'business_only',
                        businessUseRatio: 100
                    };
                    if (existingClosing) await db.updateTransaction(closingData);
                    else await db.addTransaction(closingData);
                } else if (existingClosing) {
                    await db.deleteTransaction(existingClosing.id);
                }

                showToast('在庫仕訳を更新しました', 'success');
                await store.loadTransactions(); // 現在の月に影響があるかもしれないので
            } catch (err) {
                console.error(err);
                showToast('保存に失敗しました', 'error');
            }
        });
    }
}
