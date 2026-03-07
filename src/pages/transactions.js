import { store } from '../store.js';
import { formatCurrency, toDateString, generateId } from '../utils/format.js';
import { renderModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export function renderTransactions() {
    const container = document.createElement('div');
    container.className = 'page-section animate-fade-in';

    container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-wrapper">
          <input type="text" id="tx-search" class="search-input" placeholder="摘要や金額で検索...">
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" id="btn-add-tx">
          <span>十 新規取引入力</span>
        </button>
      </div>
    </div>
    
    <div class="card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>借方科目</th>
              <th>貸方科目</th>
              <th>摘要</th>
              <th class="text-right">金額</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody id="tx-list">
            <tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

    return container;
}

export function onTransactionsMount() {
    if (window._currentUnsubscribe) {
        window._currentUnsubscribe();
    }

    const unsubscribe = store.subscribe(() => {
        updateTransactionsUI();
    });
    window._currentUnsubscribe = unsubscribe;

    // 新規追加ボタン
    const addBtn = document.getElementById('btn-add-tx');
    if (addBtn) addBtn.addEventListener('click', () => openTransactionModal());

    // 検索入力
    const searchInput = document.getElementById('tx-search');
    if (searchInput) searchInput.addEventListener('input', updateTransactionsUI);
}

function updateTransactionsUI() {
    const { transactions, isLoading } = store.state;
    const listContainer = document.getElementById('tx-list');
    const searchInput = document.getElementById('tx-search');

    if (!listContainer || isLoading) return;

    const keyword = searchInput ? searchInput.value.toLowerCase() : '';

    // フィルタリング
    const filteredTxs = transactions.filter(tx => {
        if (!keyword) return true;
        const descMatch = (tx.description || '').toLowerCase().includes(keyword);
        const amountMatch = tx.amount.toString().includes(keyword);
        const debitName = store.getAccountName(tx.debitAccount).toLowerCase();
        const creditName = store.getAccountName(tx.creditAccount).toLowerCase();

        return descMatch || amountMatch || debitName.includes(keyword) || creditName.includes(keyword);
    });

    if (filteredTxs.length === 0) {
        listContainer.innerHTML = `
      <tr><td colspan="6" class="text-center text-muted" style="padding: 3rem;">
        <div class="empty-state">
          <span class="empty-state-icon">📝</span>
          <h3 class="empty-state-title">データがありません</h3>
          <p class="empty-state-description">今月の取引データがありません。右上のボタンから追加してください。</p>
        </div>
      </td></tr>
    `;
        return;
    }

    const txsHTML = filteredTxs.map(tx => {
        const debitName = store.getAccountName(tx.debitAccount);
        const creditName = store.getAccountName(tx.creditAccount);

        return `
      <tr>
        <td class="date">${tx.date}</td>
        <td><span class="badge ${store.getAccountByCode(tx.debitAccount)?.category === 'expense' ? 'badge-expense' : 'badge-asset'}">${debitName}</span></td>
        <td><span class="badge ${store.getAccountByCode(tx.creditAccount)?.category === 'revenue' ? 'badge-income' : 'badge-asset'}">${creditName}</span></td>
        <td>${tx.description || ''}</td>
        <td class="amount">${formatCurrency(tx.amount)}</td>
        <td class="text-center">
          <button class="btn btn-ghost btn-sm btn-edit" data-id="${tx.id}">編集</button>
          <button class="btn btn-ghost btn-sm text-rose btn-delete" data-id="${tx.id}">削除</button>
        </td>
      </tr>
    `;
    }).join('');

    listContainer.innerHTML = txsHTML;

    // 編集・削除イベントリスナーの登録
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const tx = transactions.find(t => t.id === id);
            if (tx) openTransactionModal(tx);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            confirmDialog('取引の削除', 'この取引を削除してもよろしいですか？この操作は元に戻せません。', async () => {
                await store.deleteTransaction(id);
                showToast('取引を削除しました', 'success');
            });
        });
    });
}

function openTransactionModal(existingTx = null) {
    const isEditing = !!existingTx;
    const accounts = store.state.accounts;

    // 選択肢の生成
    const generateAccountOptions = (selectedCode) => {
        // カテゴリごとにグループ化（資産、負債、純資産、収益、費用）
        const groups = {
            asset: { label: '資産', options: [] },
            liability: { label: '負債', options: [] },
            equity: { label: '純資産', options: [] },
            revenue: { label: '収益 (売上)', options: [] },
            expense: { label: '費用 (経費)', options: [] }
        };

        accounts.forEach(acc => {
            groups[acc.category].options.push(acc);
        });

        return Object.values(groups).map(g => `
      <optgroup label="${g.label}">
        ${g.options.map(acc => `
          <option value="${acc.code}" ${selectedCode === acc.code ? 'selected' : ''}>
            ${acc.code} ${acc.name}
          </option>
        `).join('')}
      </optgroup>
    `).join('');
    };

    const defaultDate = isEditing ? existingTx.date : toDateString(new Date());

    const bodyHtml = `
    <form id="tx-form">
      <div class="form-group">
        <label class="form-label">日付 <span class="text-rose">*</span></label>
        <input type="date" id="tx-date" class="form-input" value="${defaultDate}" required>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">借方（増えるもの・費用） <span class="text-rose">*</span></label>
          <select id="tx-debit" class="form-select" required>
            ${generateAccountOptions(isEditing ? existingTx.debitAccount : '1001')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">貸方（減るもの・収益） <span class="text-rose">*</span></label>
          <select id="tx-credit" class="form-select" required>
            ${generateAccountOptions(isEditing ? existingTx.creditAccount : '4001')}
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">金額 (円) <span class="text-rose">*</span></label>
        <input type="number" id="tx-amount" class="form-input" required min="1" value="${isEditing ? existingTx.amount : ''}" placeholder="例: 10000">
      </div>
      
      <div class="form-group">
        <label class="form-label">摘要 (メモ)</label>
        <input type="text" id="tx-desc" class="form-input" value="${isEditing ? (existingTx.description || '') : ''}" placeholder="例: 〇〇仕入代、△△様売上">
      </div>
    </form>
  `;

    const footerHtml = `
    <button class="btn btn-secondary" id="tx-modal-cancel">キャンセル</button>
    <button class="btn btn-primary" id="tx-modal-save">${isEditing ? '更新する' : '登録する'}</button>
  `;

    const close = renderModal({
        title: isEditing ? '取引の編集' : '新規取引入力',
        body: bodyHtml,
        footer: footerHtml
    });

    document.getElementById('tx-modal-cancel').addEventListener('click', close);
    document.getElementById('tx-modal-save').addEventListener('click', async () => {
        const form = document.getElementById('tx-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const date = document.getElementById('tx-date').value;
        const debitAccount = document.getElementById('tx-debit').value;
        const creditAccount = document.getElementById('tx-credit').value;
        const amount = parseInt(document.getElementById('tx-amount').value, 10);
        const description = document.getElementById('tx-desc').value;

        if (debitAccount === creditAccount) {
            showToast('借方と貸方に同じ科目は設定できません', 'error');
            return;
        }

        const txData = {
            id: isEditing ? existingTx.id : generateId(),
            date,
            debitAccount,
            creditAccount,
            amount,
            description
        };

        try {
            if (isEditing) {
                await store.updateTransaction(txData);
                showToast('取引を更新しました', 'success');
            } else {
                await store.addTransaction(txData);
                showToast('取引を登録しました', 'success');
            }
            close();
        } catch (e) {
            console.error(e);
            showToast('エラーが発生しました', 'error');
        }
    });
}
