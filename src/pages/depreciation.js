import { store } from '../store.js';
import { db } from '../db.js';
import { formatCurrency, generateId } from '../utils/format.js';
import { renderModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export function renderDepreciation() {
  const container = document.createElement('div');
  container.className = 'page-section animate-fade-in';

  container.innerHTML = `
    <div class="card mb-lg">
      <div class="card-header flex-between align-center">
        <h3 class="card-title">固定資産台帳・減価償却 - ${store.state.currentYear}年度</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-asset">＋ 新しい資産を追加</button>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>資産名</th>
              <th>取得日</th>
              <th>取得価額</th>
              <th>耐用年数</th>
              <th>償却方法</th>
              <th class="text-right">本年償却額</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody id="asset-list">
            <tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="help-panel">
      <div class="help-panel-icon">💡</div>
      <div class="help-panel-content">
        <div class="help-panel-title">減価償却のルール（簡易解説）</div>
        <div class="help-panel-text">
          ・<b>10万円未満</b>：消耗品費として一括経費。この台帳への登録は不要です。<br>
          ・<b>10万〜30万円未満</b>：少額減価償却資産として、特例で一括経費にできる場合があります。<br>
          ・<b>30万円以上</b>：耐用年数に応じて数年かけて経費化（減価償却）します。
        </div>
      </div>
    </div>
  `;

  return container;
}

export async function onDepreciationMount() {
  await renderAssetList();

  const addBtn = document.getElementById('btn-add-asset');
  if (addBtn) addBtn.addEventListener('click', () => openAssetModal());
}

async function renderAssetList() {
  const listEl = document.getElementById('asset-list');
  if (!listEl) return;

  const { currentYear } = store.state;
  // ここでは取引データから「固定資産」タグがついた決算整理仕訳を探すか、別テーブルを持つべきですが、
  // 今回は簡易化のため「固定資産」としてのメタ情報を「設定」の一部に保存する形を想定します。
  // (実際のDB拡張が望ましいが、既存のdb.jsを大きく変えず settings で管理)
  const settings = await db.getSettings();
  const assets = settings.assets || [];

  if (assets.length === 0) {
    listEl.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 3rem;">登録されている固定資産はありません</td></tr>`;
    return;
  }

  listEl.innerHTML = assets.map(asset => {
    const depAmount = calculateYearDepreciation(asset, currentYear);
    return `
      <tr>
        <td><b>${asset.name}</b></td>
        <td>${asset.date}</td>
        <td>${formatCurrency(asset.amount)}</td>
        <td>${asset.usefulLife}年</td>
        <td>${asset.method === 'immediate' ? '即時償却 (30万未満特例)' : '定額法'}</td>
        <td class="text-right font-bold text-rose">${formatCurrency(depAmount)}</td>
        <td class="text-center">
          <button class="btn btn-ghost btn-sm text-primary" onclick="window.syncAssetToJournal('${asset.id}')">仕訳反映</button>
          <button class="btn btn-ghost btn-sm text-rose" onclick="window.deleteAsset('${asset.id}')">削除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function calculateYearDepreciation(asset, year) {
  const purchaseYear = parseInt(asset.date.substring(0, 4), 10);
  const purchaseMonth = parseInt(asset.date.substring(5, 7), 10);

  if (purchaseYear > year) return 0;

  if (asset.method === 'immediate') {
    return purchaseYear === year ? asset.amount : 0;
  }

  // 定額法の超簡易計算 (月割は簡略化)
  // 残存価額ゼロ、耐用年数で割る
  const annual = Math.floor(asset.amount / asset.usefulLife);
  const totalDepreciatedSoFar = (year - purchaseYear) * annual;

  if (totalDepreciatedSoFar >= asset.amount) return 0;

  // 最後の年は残額すべて
  if (totalDepreciatedSoFar + annual > asset.amount) return asset.amount - totalDepreciatedSoFar;

  // 購入初年度は月割
  if (purchaseYear === year) {
    const months = 12 - purchaseMonth + 1;
    return Math.floor(annual * (months / 12));
  }

  return annual;
}

function openAssetModal(existingAsset = null) {

  const body = `
    <form id="asset-form">
      <div class="form-group">
        <label class="form-label">資産名</label>
        <input type="text" id="ast-name" class="form-input" required placeholder="例: MacBook Air M5">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">取得日</label>
          <input type="date" id="ast-date" class="form-input" required value="${store.state.currentYear}-01-01">
        </div>
        <div class="form-group">
          <label class="form-label">取得価額 (円)</label>
          <input type="number" id="ast-amount" class="form-input" required min="100000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">耐用年数 (年)</label>
          <input type="number" id="ast-life" class="form-input" required min="1" value="4">
        </div>
        <div class="form-group">
          <label class="form-label">償却方法</label>
          <select id="ast-method" class="form-select">
            <option value="straight_line">定額法</option>
            <option value="immediate">少額資産特例 (即時償却)</option>
          </select>
        </div>
      </div>
    </form>
  `;

  const close = renderModal({
    title: '固定資産の登録',
    body,
    footer: `
      <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">キャンセル</button>
      <button class="btn btn-primary" id="btn-save-asset">登録する</button>
    `
  });

  document.getElementById('btn-save-asset').addEventListener('click', async () => {
    const name = document.getElementById('ast-name').value;
    const date = document.getElementById('ast-date').value;
    const amount = parseInt(document.getElementById('ast-amount').value, 10);
    const usefulLife = parseInt(document.getElementById('ast-life').value, 10);
    const method = document.getElementById('ast-method').value;

    if (!name || !date || !amount) return;

    const settings = await db.getSettings();
    const assets = settings.assets || [];
    assets.push({ id: generateId(), name, date, amount, usefulLife, method });

    await db.saveSettings({ ...settings, assets });
    showToast('資産を登録しました', 'success');
    close();
    renderAssetList();
  });
}

// グローバル関数として露出 (簡易実装のため)
window.syncAssetToJournal = async (assetId) => {
  const year = store.state.currentYear;
  const settings = await db.getSettings();
  const asset = settings.assets.find(a => a.id === assetId);
  if (!asset) return;

  const depAmount = calculateYearDepreciation(asset, year);
  if (depAmount <= 0) {
    showToast('今年度の償却額は0円のため仕訳は不要です', 'info');
    return;
  }

  try {
    const txs = await db.getTransactionsByYear(year);
    const desc = `[自動] 減価償却: ${asset.name}`;
    const existing = txs.find(t => t.description === desc);

    const txData = {
      id: existing ? existing.id : generateId(),
      date: `${year}-12-31`,
      debitAccount: '5011', // 減価償却費
      creditAccount: '1007', // 工具器具備品
      amount: depAmount,
      description: desc,
      tags: '決算整理,減価償却',
      usageType: 'business_only',
      businessUseRatio: 100
    };

    if (existing) await db.updateTransaction(txData);
    else await db.addTransaction(txData);

    showToast('減価償却費を仕訳帳に反映しました', 'success');
  } catch (err) {
    showToast('仕訳反映に失敗しました', 'error');
  }
};

window.deleteAsset = async (assetId) => {
  if (!confirm('この資産を削除しますか？')) return;
  const settings = await db.getSettings();
  const assets = (settings.assets || []).filter(a => a.id !== assetId);
  await db.saveSettings({ ...settings, assets });
  renderAssetList();
  showToast('削除しました', 'success');
};
