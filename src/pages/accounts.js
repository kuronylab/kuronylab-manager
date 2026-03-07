import { store } from '../store.js';
import { db } from '../db.js';
import { getCategoryLabel, getCategoryBadgeClass } from '../utils/accounts-master.js';
import { renderModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export function renderAccounts() {
    const container = document.createElement('div');
    container.className = 'page-section animate-fade-in';

    container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-wrapper">
          <input type="text" id="acc-search" class="search-input" placeholder="科目名やコードで検索...">
        </div>
        <select id="acc-filter-category" class="form-select" style="min-width: 150px;">
          <option value="">すべて</option>
          <option value="asset">資産</option>
          <option value="liability">負債</option>
          <option value="equity">純資産</option>
          <option value="revenue">収益</option>
          <option value="expense">費用</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" id="btn-add-acc">
          <span>十 新規科目追加</span>
        </button>
      </div>
    </div>
    
    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th width="15%">コード</th>
              <th width="30%">勘定科目名</th>
              <th width="20%">区分</th>
              <th width="20%">表示名(B/S,P/L)</th>
              <th width="15%" class="text-center">操作</th>
            </tr>
          </thead>
          <tbody id="acc-list">
            <tr><td colspan="5" class="text-center text-muted" style="padding: 2rem;">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

    return container;
}

export function onAccountsMount() {
    if (window._currentUnsubscribe) window._currentUnsubscribe();

    const unsubscribe = store.subscribe(() => {
        updateAccountsUI();
    });
    window._currentUnsubscribe = unsubscribe;

    // 新規追加ボタン
    const addBtn = document.getElementById('btn-add-acc');
    if (addBtn) addBtn.addEventListener('click', () => openAccountModal());

    // 検索・フィルタ入力
    const searchInput = document.getElementById('acc-search');
    const filterSelect = document.getElementById('acc-filter-category');
    if (searchInput) searchInput.addEventListener('input', updateAccountsUI);
    if (filterSelect) filterSelect.addEventListener('change', updateAccountsUI);
}

function updateAccountsUI() {
    const { accounts, isLoading } = store.state;
    const listContainer = document.getElementById('acc-list');
    const searchInput = document.getElementById('acc-search');
    const filterSelect = document.getElementById('acc-filter-category');

    if (!listContainer || isLoading) return;

    const keyword = searchInput ? searchInput.value.toLowerCase() : '';
    const category = filterSelect ? filterSelect.value : '';

    // フィルタリングとソート（コード昇順）
    const filteredAccs = accounts.filter(acc => {
        if (category && acc.category !== category) return false;
        if (!keyword) return true;
        return acc.code.includes(keyword) || acc.name.toLowerCase().includes(keyword);
    }).sort((a, b) => a.code.localeCompare(b.code));

    if (filteredAccs.length === 0) {
        listContainer.innerHTML = `
      <tr><td colspan="5" class="text-center text-muted" style="padding: 3rem;">
        該当する勘定科目がありません。
      </td></tr>
    `;
        return;
    }

    const accsHTML = filteredAccs.map(acc => `
    <tr>
      <td class="text-mono font-bold">${acc.code}</td>
      <td class="font-bold">${acc.name}</td>
      <td><span class="badge ${getCategoryBadgeClass(acc.category)}">${getCategoryLabel(acc.category)}</span></td>
      <td class="text-muted text-sm">${acc.type || getCategoryLabel(acc.category)}</td>
      <td class="text-center">
        <button class="btn btn-ghost btn-sm btn-edit-acc" data-code="${acc.code}">編集</button>
      </td>
    </tr>
  `).join('');

    listContainer.innerHTML = accsHTML;

    // 編集イベントリスナーの登録
    document.querySelectorAll('.btn-edit-acc').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const code = e.target.dataset.code;
            const acc = accounts.find(a => a.code === code);
            if (acc) openAccountModal(acc);
        });
    });
}

function openAccountModal(existingAcc = null) {
    const isEditing = !!existingAcc;

    const bodyHtml = `
    <form id="acc-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">科目コード <span class="text-rose">*</span></label>
          <input type="text" id="acc-code" class="form-input text-mono" required pattern="^[1-5][0-9]{3}$" 
            value="${isEditing ? existingAcc.code : ''}" ${isEditing ? 'readonly style="opacity:0.7"' : ''}
            placeholder="例: 5020 (1〜5で始まる4桁)">
          <small class="text-muted text-xs mt-sm block">1xxx:資産, 2xxx:負債, 3xxx:純資産, 4xxx:収益, 5xxx:費用</small>
        </div>
        
        <div class="form-group">
          <label class="form-label">区分 <span class="text-rose">*</span></label>
          <select id="acc-category" class="form-select" required ${isEditing ? 'disabled style="opacity:0.7"' : ''}>
            <option value="asset" ${isEditing && existingAcc.category === 'asset' ? 'selected' : ''}>資産</option>
            <option value="liability" ${isEditing && existingAcc.category === 'liability' ? 'selected' : ''}>負債</option>
            <option value="equity" ${isEditing && existingAcc.category === 'equity' ? 'selected' : ''}>純資産</option>
            <option value="revenue" ${isEditing && existingAcc.category === 'revenue' ? 'selected' : ''}>収益</option>
            <option value="expense" ${isEditing && existingAcc.category === 'expense' ? 'selected' : ''}>費用</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">勘定科目名 <span class="text-rose">*</span></label>
        <input type="text" id="acc-name" class="form-input" required value="${isEditing ? existingAcc.name : ''}" placeholder="例: 会議費">
      </div>
      
      <div class="form-group">
        <label class="form-label">表示名 (P/L, B/Sでの表示カテゴリ)</label>
        <input type="text" id="acc-type" class="form-input" value="${isEditing ? (existingAcc.type || '') : ''}" placeholder="例: 経費, 流動資産など">
      </div>
    </form>
  `;

    const footerHtml = `
    <button class="btn btn-secondary" id="acc-modal-cancel">キャンセル</button>
    <button class="btn btn-primary" id="acc-modal-save">${isEditing ? '更新する' : '登録する'}</button>
  `;

    const close = renderModal({
        title: isEditing ? '勘定科目の編集' : '新規勘定科目の追加',
        body: bodyHtml,
        footer: footerHtml
    });

    document.getElementById('acc-modal-cancel').addEventListener('click', close);

    // カテゴリ自動設定ロジック（コード入力時）
    if (!isEditing) {
        document.getElementById('acc-code').addEventListener('input', (e) => {
            const code = e.target.value;
            if (code.length >= 1) {
                const firstDigit = code.charAt(0);
                const select = document.getElementById('acc-category');
                if (firstDigit === '1') select.value = 'asset';
                else if (firstDigit === '2') select.value = 'liability';
                else if (firstDigit === '3') select.value = 'equity';
                else if (firstDigit === '4') select.value = 'revenue';
                else if (firstDigit === '5') select.value = 'expense';
            }
        });
    }

    document.getElementById('acc-modal-save').addEventListener('click', async () => {
        const form = document.getElementById('acc-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const code = document.getElementById('acc-code').value;
        const categorySelector = document.getElementById('acc-category');
        // disabled対応のためisEditingをチェック
        const category = isEditing ? existingAcc.category : categorySelector.value;
        const name = document.getElementById('acc-name').value;
        const typeStr = document.getElementById('acc-type').value;

        // 新規登録の場合の重複チェック
        if (!isEditing && store.state.accounts.some(a => a.code === code)) {
            showToast('この科目コードは既に使用されています', 'error');
            return;
        }

        const accData = {
            code,
            category,
            name,
            type: typeStr || getCategoryLabel(category)
        };

        try {
            await db.saveAccount(accData);

            // Storeの更新を手動で呼び出し
            const updatedAccounts = await db.getAccounts();
            store.setState({ accounts: updatedAccounts });

            showToast(`科目を${isEditing ? '更新' : '登録'}しました`, 'success');
            close();
        } catch (e) {
            console.error(e);
            showToast('エラーが発生しました', 'error');
        }
    });
}
