import { store } from '../store.js';
import { formatCurrency, toDateString, generateId } from '../utils/format.js';
import { renderModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { extractTextFromImage, extractTextFromPDF, parseReceiptText } from '../utils/ocr.js';

export function renderTransactions() {
  const container = document.createElement('div');
  container.className = 'page-section animate-fade-in';

  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left" style="display: flex; gap: var(--spacing-sm); align-items: center; flex-wrap: wrap;">
        <select id="tx-year-select" class="form-select" style="width: 100px;">
          ${[2024, 2025, 2026, 2027].map(y => `<option value="${y}" ${y === store.state.currentYear ? 'selected' : ''}>${y}年</option>`).join('')}
        </select>
        <select id="tx-month-select" class="form-select" style="width: 80px;">
          ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === store.state.currentMonth ? 'selected' : ''}>${i + 1}月</option>`).join('')}
        </select>
        <div class="search-wrapper">
          <input type="text" id="tx-search" class="search-input" placeholder="摘要や金額で検索...">
        </div>
      </div>
      <div class="toolbar-right" style="display: flex; gap: var(--spacing-sm); flex-wrap: wrap;">
        <input type="file" id="csv-upload" accept=".csv" style="display: none;">
        <button class="btn btn-secondary" id="btn-import-csv" title="CSVから取引を一括インポート">
          <span>📁 CSV追加</span>
        </button>
        <button class="btn btn-primary" id="btn-add-tx" title="Cmd/Ctrl + Nで開く">
          <span>十 新規入力</span>
        </button>
      </div>
    </div>
    
    <div class="templates-bar" style="display: flex; gap: 0.5rem; margin-bottom: var(--spacing-md); overflow-x: auto; padding-bottom: 0.5rem;">
      <span class="text-xs text-muted" style="white-space: nowrap; line-height: 28px;">テンプレート:</span>
      <button class="btn btn-ghost btn-sm btn-template" data-debit="1002" data-credit="4001" data-desc="業務委託費入金" data-partner="YourLife株式会社">💰 報酬入金(YourLife)</button>
      <button class="btn btn-ghost btn-sm btn-template" data-debit="5003" data-credit="1001" data-desc="ツール利用料" data-partner="OpenAI">🌐 ChatGPT (現金)</button>
      <button class="btn btn-ghost btn-sm btn-template" data-debit="5003" data-credit="2002" data-desc="サーバー代" data-partner="AWS">☁️ サーバー代 (未払金)</button>
      <button class="btn btn-ghost btn-sm btn-template" data-debit="5006" data-credit="1001" data-desc="事務用品購入">📝 消耗品 (現金)</button>
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
              <th>取引先</th>
              <th>タグ</th>
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

  // CSVインポート関連
  const importBtn = document.getElementById('btn-import-csv');
  const importFile = document.getElementById('csv-upload');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleCSVImport);
  }

  // 年度・月変更
  const yearSelect = document.getElementById('tx-year-select');
  const monthSelect = document.getElementById('tx-month-select');
  if (yearSelect) {
    yearSelect.addEventListener('change', (e) => {
      store.setYear(parseInt(e.target.value, 10));
    });
  }
  if (monthSelect) {
    monthSelect.addEventListener('change', (e) => {
      store.setMonth(store.state.currentYear, parseInt(e.target.value, 10));
    });
  }

  // 検索入力
  const searchInput = document.getElementById('tx-search');
  if (searchInput) searchInput.addEventListener('input', updateTransactionsUI);

  // テンプレートボタン
  document.querySelectorAll('.btn-template').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const t = e.currentTarget;
      openTransactionModal({
        isTemplate: true,
        debitAccount: t.dataset.debit,
        creditAccount: t.dataset.credit,
        description: t.dataset.desc || '',
        partner: t.dataset.partner || ''
      });
    });
  });

  // キーボードショートカット
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      openTransactionModal();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  // クリーンアップに追加
  const originalUnsub = window._currentUnsubscribe;
  window._currentUnsubscribe = () => {
    if (originalUnsub) originalUnsub();
    window.removeEventListener('keydown', handleKeyDown);
  };
}

async function handleCSVImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const Papa = await import('papaparse');
    Papa.default.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        const data = results.data;
        if (!data || data.length === 0) {
          showToast('CSVデータが空か不正です', 'error');
          return;
        }

        // 簡易的なマッピング処理（日付、金額、摘要が含まれているか確認）
        // 本来は列名のマッピングUIが必要だが今回は自動推測
        let importedCount = 0;

        for (const row of data) {
          // 全角数字やカンマ除去などの前処理
          const rawAmount = row['金額'] || row['入金金額'] || row['出金金額'] || row['Amount'] || '0';
          const amount = parseInt(rawAmount.toString().replace(/[,¥\\\s]/g, ''), 10);

          const dateRaw = row['日付'] || row['利用日'] || row['Date'] || '';
          const date = dateRaw.replace(/\//g, '-'); // YYYY/MM/DD -> YYYY-MM-DD

          const description = row['摘要'] || row['内容'] || row['利用店名・商品名'] || row['Description'] || '';
          const partner = row['取引先'] || row['支払先'] || row['Partner'] || '';
          const tags = row['タグ'] || row['プロジェクト'] || row['Tags'] || '';

          if (!amount || isNaN(amount) || !date || date.length < 8) continue;

          // 仮の科目判定（摘要の一部から推測するか、デフォルト設定を持たせる）
          // ここでは一律「未設定」のような処理にするか、売上・仕入に仮割り当てする
          const isIncome = row['入金金額'] || (row['金額'] && parseInt(row['金額'], 10) > 0);

          const debitAccount = isIncome ? '1001' : '5001'; // 入金なら現金、出金なら仕入(仮)
          const creditAccount = isIncome ? '4001' : '1001'; // 入金なら売上、出金なら現金

          const txData = {
            id: generateId(),
            date: date.length === 8 ? `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}` : date, // YYYYMMDD対応
            debitAccount,
            creditAccount,
            amount: Math.abs(amount),
            description: `[CSV] ${description}`,
            partner,
            tags
          };

          await store.addTransaction(txData);
          importedCount++;
        }

        showToast(`${importedCount}件の取引をインポートしました`, 'success');
        // input reset
        e.target.value = '';
      },
      error: function (err) {
        showToast('CSVの読み込みに失敗しました', 'error');
        console.error(err);
      }
    });
  } catch (err) {
    showToast('CSVモジュールの読み込みに失敗しました', 'error');
    console.error(err);
  }
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
    const partnerMatch = (tx.partner || '').toLowerCase().includes(keyword);
    const tagMatch = (tx.tags || '').toLowerCase().includes(keyword);
    const amountMatch = tx.amount.toString().includes(keyword);
    const debitName = store.getAccountName(tx.debitAccount).toLowerCase();
    const creditName = store.getAccountName(tx.creditAccount).toLowerCase();

    return descMatch || partnerMatch || tagMatch || amountMatch || debitName.includes(keyword) || creditName.includes(keyword);
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

    let apportionBadge = '';
    if (tx.isApportionmentAdjustment) {
      apportionBadge = `<span class="badge" style="background: var(--rose-light); color: var(--rose); margin-left: 8px; font-size: 0.7rem;">自動調整仕訳</span>`;
    } else if (tx.usageType === 'mixed' && tx.businessUseRatio !== undefined) {
      apportionBadge = `<span class="badge badge-outline" style="margin-left: 8px; font-size: 0.7rem;">混在 ${tx.businessUseRatio}%</span>`;
    } else if (tx.usageType === 'private_only') {
      apportionBadge = `<span class="badge badge-outline" style="margin-left: 8px; font-size: 0.7rem;">全額除外</span>`;
    }

    return `
      <tr ${tx.isApportionmentAdjustment ? 'style="background: rgba(244, 63, 94, 0.05);"' : ''}>
        <td class="date">${tx.date}</td>
        <td><span class="badge ${store.getAccountByCode(tx.debitAccount)?.category === 'expense' ? 'badge-expense' : 'badge-asset'}">${debitName}</span></td>
        <td><span class="badge ${store.getAccountByCode(tx.creditAccount)?.category === 'revenue' ? 'badge-income' : 'badge-asset'}">${creditName}</span></td>
        <td>${tx.description || ''}${apportionBadge}</td>
        <td>${tx.partner || '-'}</td>
        <td>${tx.tags ? tx.tags.split(',').map(tag => `<span class="badge" style="background: var(--bg-card-hover); color: var(--text-color); margin-right: 2px;">${tag.trim()}</span>`).join('') : '-'}</td>
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
      const tx = transactions.find(t => t.id === id);

      if (tx && tx.subscriptionId) {
        // 自動記帳されたデータの場合の特別ダイアログ
        const modalTemplate = `
            <div id="skip-delete-modal" class="modal-overlay" style="display:flex;">
              <div class="modal fade-in" style="max-width: 500px;">
                <h3 class="modal-title font-medium text-lg">自動記帳データの削除</h3>
                <div class="modal-body mt-md mb-lg">
                  <p class="text-sm">この取引は自動登録されたものです。今回だけ削除しますか？今後の予定もキャンセルしますか？</p>
                </div>
                <div class="modal-footer flex gap-sm justify-end">
                  <button class="btn btn-secondary" id="btn-cancel-delete">キャンセル</button>
                  <button class="btn btn-outline text-rose" id="btn-skip-only">今回だけ削除</button>
                  <button class="btn btn-danger" id="btn-delete-all">今後の予定もキャンセル</button>
                </div>
              </div>
            </div>
          `;

        document.body.insertAdjacentHTML('beforeend', modalTemplate);
        const modalEl = document.getElementById('skip-delete-modal');

        const closeModal = () => {
          modalEl.remove();
        };

        document.getElementById('btn-cancel-delete').addEventListener('click', closeModal);

        document.getElementById('btn-skip-only').addEventListener('click', async () => {
          try {
            await store.deleteTransaction(id);
            // 今回のみ削除（スキップ扱いにして再度全期間反映時に復活させない）
            const { db } = await import('../db.js');
            await db.skipSyncLogByTxId(id);
            showToast('今回分の取引を削除しました', 'success');
          } catch (err) {
            showToast('削除に失敗しました', 'error');
          }
          closeModal();
        });

        document.getElementById('btn-delete-all').addEventListener('click', async () => {
          try {
            await store.deleteTransaction(id);
            const { db } = await import('../db.js');
            await db.deleteSubscription(tx.subscriptionId);
            showToast('取引と今後の自動設定を削除しました', 'success');
          } catch (err) {
            showToast('削除に失敗しました', 'error');
          }
          closeModal();
        });

      } else {
        // 通常の削除ダイアログ
        confirmDialog('取引の削除', 'この取引を削除してもよろしいですか？この操作は元に戻せません。', async () => {
          await store.deleteTransaction(id);
          showToast('取引を削除しました', 'success');
        });
      }
    });
  });
}

function openTransactionModal(existingTx = null) {
  const isEditing = existingTx && !existingTx.isTemplate;
  const isTemplate = existingTx && existingTx.isTemplate;
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
    <div style="margin-bottom: var(--spacing-md); display: flex; justify-content: flex-end;">
      <input type="file" id="tx-ocr-input" accept="image/*,application/pdf" style="display: none;">
      <button class="btn btn-outline btn-sm" id="btn-ocr-trigger" type="button">
        <span style="margin-right: 4px;">📸</span> 画像 / PDF から自動入力 (OCR)
      </button>
    </div>
    <form id="tx-form">
      <div class="form-group">
        <label class="form-label">日付 <span class="text-rose">*</span></label>
        <input type="date" id="tx-date" class="form-input" value="${defaultDate}" required>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">借方（増えるもの・費用） <span class="help-icon" data-tooltip="事業の口座にお金が入ったときや、経費を払ったときは左側（借方）を使います。">?</span> <span class="text-rose">*</span></label>
          <select id="tx-debit" class="form-select" required>
            ${generateAccountOptions(existingTx ? existingTx.debitAccount : '1001')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">貸方（減るもの・収益） <span class="help-icon" data-tooltip="事業の口座からお金が減ったときや、売上が出たときは右側（貸方）を使います。">?</span> <span class="text-rose">*</span></label>
          <select id="tx-credit" class="form-select" required>
            ${generateAccountOptions(existingTx ? existingTx.creditAccount : '4001')}
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">金額 (円) <span class="text-rose">*</span></label>
          <input type="number" id="tx-amount" class="form-input" required min="1" value="${isEditing ? existingTx.amount : ''}" placeholder="例: 10000" ${isTemplate ? 'autofocus' : ''}>
        </div>
        <div class="form-group">
          <label class="form-label">取引先 <span class="text-sm text-muted">(任意)</span></label>
          <input type="text" id="tx-partner" class="form-input" list="tx-partner-list" value="${existingTx ? (existingTx.partner || '') : ''}" placeholder="例: Amazon, A社">
          <datalist id="tx-partner-list"></datalist>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">摘要 (メモ) <span class="help-icon" data-tooltip="「誰に」「何の目的で」をメモしておくと、後から見返すときや確定申告の際にわかりやすくなります。">?</span></label>
        <input type="text" id="tx-desc" class="form-input" list="tx-desc-list" value="${existingTx ? (existingTx.description || '') : ''}" placeholder="例: 〇〇様へ商品発送代金、△△事務用品購入">
        <datalist id="tx-desc-list"></datalist>
      </div>

      <div class="form-group">
        <label class="form-label">タグ / プロジェクト <span class="text-sm text-muted">(任意・カンマ区切り)</span></label>
        <input type="text" id="tx-tags" class="form-input" list="tx-tags-list" value="${existingTx ? (existingTx.tags || '') : ''}" placeholder="例: 物販事業, YouTube">
        <datalist id="tx-tags-list"></datalist>
      </div>

      <!-- 家事按分UI -->
      <div class="form-group" id="tx-apportionment-section" style="display: none; border-top: 1px dashed var(--border-color); padding-top: var(--spacing-md); margin-top: var(--spacing-md);">
        <label class="form-label font-bold text-primary">⚖️ 家事按分・事業利用設定</label>
        
        <div class="form-row">
            <div class="form-group w-1/2">
                <label class="form-label">利用区分</label>
                <select id="tx-usage-type" class="form-select">
                    <option value="business_only" ${existingTx && existingTx.usageType === 'business_only' ? 'selected' : (!existingTx ? 'selected' : '')}>100% 事業用</option>
                    <option value="mixed" ${existingTx && existingTx.usageType === 'mixed' ? 'selected' : ''}>家事按分（混在）</option>
                    <option value="private_only" ${existingTx && existingTx.usageType === 'private_only' ? 'selected' : ''}>100% 私用（全額除外）</option>
                </select>
            </div>
            
            <div class="form-group w-1/2" id="tx-ratio-group" style="display: none;">
                <label class="form-label">事業利用割合 (%)</label>
                <input type="number" id="tx-business-ratio" class="form-input" min="0" max="100" value="${existingTx && existingTx.businessUseRatio !== undefined ? existingTx.businessUseRatio : 100}">
            </div>
        </div>
        
        <div id="tx-apportionment-details" style="display: none; background: var(--bg-color); padding: var(--spacing-sm); border-radius: var(--border-radius-sm); margin-bottom: var(--spacing-md);">
            <div class="text-sm flex justify-between mb-xs"><span>按分後 経費計上額:</span> <span id="tx-calc-business-amount" class="font-bold">0円</span></div>
            <div class="text-sm flex justify-between text-rose"><span>家事按分 除外額 (調整仕訳):</span> <span id="tx-calc-private-amount" class="font-bold">0円</span></div>
            
            <div class="form-group mt-sm mb-0">
                <label class="form-label text-xs">按分根拠メモ <span class="text-rose">*</span></label>
                <input type="text" id="tx-apportionment-memo" class="form-input text-sm" placeholder="例: KURONYLABのAIツール開発等に利用。私的利用も含むため事業割合80%とする" value="${existingTx ? (existingTx.apportionmentMemo || '') : ''}">
            </div>
        </div>
      </div>
    </form>
    
    <div class="help-panel" style="margin-top: var(--spacing-md); margin-bottom: 0;">
      <div class="help-panel-icon">💡</div>
      <div class="help-panel-content">
        <div class="help-panel-title">初心者の方へ：迷ったらテンプレートを！</div>
        <div class="help-panel-text">仕訳（借方・貸方）についてよくわからない場合は、キャンセルして画面上部の「テンプレート」ボタンを使うと自動で正しい科目が選択されます。</div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" id="tx-modal-cancel">キャンセル</button>
    <button class="btn btn-primary" id="tx-modal-save">${isEditing ? '更新する' : '登録する'}</button>
  `;

  const close = renderModal({
    title: isTemplate ? 'テンプレート入力' : (isEditing ? '取引の編集' : '新規取引入力'),
    body: bodyHtml,
    footer: footerHtml
  });

  // --- 按分UI制御ロジック ---
  setTimeout(() => {
    const debitSelect = document.getElementById('tx-debit');
    const amountInput = document.getElementById('tx-amount');
    const apportSection = document.getElementById('tx-apportionment-section');
    const usageSelect = document.getElementById('tx-usage-type');
    const ratioGroup = document.getElementById('tx-ratio-group');
    const ratioInput = document.getElementById('tx-business-ratio');
    const detailsDiv = document.getElementById('tx-apportionment-details');
    const calcBiz = document.getElementById('tx-calc-business-amount');
    const calcPriv = document.getElementById('tx-calc-private-amount');

    const updateApportionmentUI = () => {
      if (!debitSelect || !apportSection) return;

      const isExpense = debitSelect.value.startsWith('5');
      apportSection.style.display = isExpense ? 'block' : 'none';

      if (!isExpense) return;

      const usage = usageSelect.value;
      const amount = Number(amountInput.value) || 0;

      if (usage === 'business_only') {
        ratioGroup.style.display = 'none';
        detailsDiv.style.display = 'none';
        ratioInput.value = 100;
      } else if (usage === 'private_only') {
        ratioGroup.style.display = 'none';
        detailsDiv.style.display = 'block';
        ratioInput.value = 0;
        calcBiz.textContent = '0円';
        calcPriv.textContent = amount.toLocaleString() + '円';
      } else if (usage === 'mixed') {
        ratioGroup.style.display = 'block';
        detailsDiv.style.display = 'block';
        let ratio = Number(ratioInput.value);
        if (ratio < 0) ratio = 0;
        if (ratio > 100) ratio = 100;
        const privateRatio = 100 - ratio;
        const adjAmount = Math.round(amount * (privateRatio / 100));
        const bizAmount = amount - adjAmount;

        calcBiz.textContent = bizAmount.toLocaleString() + '円';
        calcPriv.textContent = adjAmount.toLocaleString() + '円';
      }
    };

    if (debitSelect) debitSelect.addEventListener('change', updateApportionmentUI);
    if (usageSelect) usageSelect.addEventListener('change', updateApportionmentUI);
    if (amountInput) amountInput.addEventListener('input', updateApportionmentUI);
    if (ratioInput) ratioInput.addEventListener('input', updateApportionmentUI);

    updateApportionmentUI();
  }, 50);

  // --- 入力履歴オートコンプリート（サジェスト）と自動反映の準備 ---
  const setupAutocomplete = async () => {
    try {
      const { db } = await import('../db.js');
      const txs = await db.getAllTransactions();

      // ユニークな履歴を抽出
      const descriptions = [...new Set(txs.map(t => t.description).filter(Boolean))].sort();
      const partners = [...new Set(txs.map(t => t.partner).filter(Boolean))].sort();

      const tagsSet = new Set();
      txs.forEach(t => {
        if (t.tags) {
          t.tags.split(',').map(tag => tag.trim()).filter(Boolean).forEach(tag => tagsSet.add(tag));
        }
      });
      const tags = [...tagsSet].sort();

      const fillList = (id, options) => {
        const dl = document.getElementById(id);
        if (dl) dl.innerHTML = options.map(opt => `<option value="${opt}">`).join('');
      };

      fillList('tx-desc-list', descriptions);
      fillList('tx-partner-list', partners);
      fillList('tx-tags-list', tags);

      // 摘要が入力（選択）された連動して自動反映
      const descInput = document.getElementById('tx-desc');
      if (descInput) {
        descInput.addEventListener('change', (e) => {
          const val = e.target.value;
          if (!val || isEditing) return; // 編集時は邪魔しない

          // 最新のものを使用するため、逆順で検索
          const matchedTx = txs.slice().reverse().find(t => t.description === val);
          if (matchedTx) {
            document.getElementById('tx-debit').value = matchedTx.debitAccount;
            document.getElementById('tx-credit').value = matchedTx.creditAccount;
            document.getElementById('tx-amount').value = matchedTx.amount;

            if (matchedTx.partner && !document.getElementById('tx-partner').value) {
              document.getElementById('tx-partner').value = matchedTx.partner;
            }
            if (matchedTx.tags && !document.getElementById('tx-tags').value) {
              document.getElementById('tx-tags').value = matchedTx.tags;
            }

            import('../components/toast.js').then(({ showToast }) => {
              showToast('過去の履歴から科目を自動反映しました', 'info');
            });
          }
        });
      }
    } catch (e) {
      console.error("Autocomplete setup failed:", e);
    }
  };

  // モーダル表示直後に実行
  setTimeout(setupAutocomplete, 50);

  // OCR 機能のイベントリスナー
  const ocrInput = document.getElementById('tx-ocr-input');
  const ocrTrigger = document.getElementById('btn-ocr-trigger');

  if (ocrTrigger && ocrInput) {
    ocrTrigger.addEventListener('click', () => {
      ocrInput.click();
    });

    ocrInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const originalText = ocrTrigger.innerHTML;
      ocrTrigger.innerHTML = '<span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid; border-radius:50%; border-top-color:transparent; animation:spin 1s linear infinite; margin-right:4px;"></span> 読み取り中...';
      ocrTrigger.disabled = true;

      try {
        let text = "";
        if (file.type === 'application/pdf') {
          text = await extractTextFromPDF(file);
        } else {
          text = await extractTextFromImage(file);
        }

        const parsed = parseReceiptText(text);

        let fieldsUpdated = 0;
        if (parsed.date) {
          document.getElementById('tx-date').value = parsed.date;
          fieldsUpdated++;
        }
        if (parsed.amount) {
          document.getElementById('tx-amount').value = parsed.amount;
          fieldsUpdated++;
        }
        if (parsed.partner) {
          document.getElementById('tx-partner').value = parsed.partner;
          fieldsUpdated++;
        }
        if (parsed.description) {
          document.getElementById('tx-desc').value = parsed.description;
          fieldsUpdated++;
        }

        if (fieldsUpdated > 0) {
          showToast(`画像から${fieldsUpdated}件の情報を読み取りました！内容を確認してください。`, 'success');
        } else {
          showToast('画像を読み取りましたが、日付や金額などの情報が見つかりませんでした。手動で入力するか、別の画像をお試しください。', 'warning');
        }
      } catch (error) {
        showToast(error.message || '画像の読み取りに失敗しました。', 'error');
        console.error(error);
      } finally {
        ocrTrigger.innerHTML = originalText;
        ocrTrigger.disabled = false;
        ocrInput.value = ''; // Reset input
      }
    });
  }

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
    const partner = document.getElementById('tx-partner').value;
    const tags = document.getElementById('tx-tags').value;

    if (debitAccount === creditAccount) {
      showToast('借方と貸方に同じ科目は設定できません', 'error');
      return;
    }

    let usageType = 'business_only';
    let businessUseRatio = 100;
    let apportionmentMethod = 'fixed_ratio';
    let apportionmentMemo = '';

    if (debitAccount.startsWith('5')) {
      usageType = document.getElementById('tx-usage-type').value;
      if (usageType === 'mixed') {
        businessUseRatio = Number(document.getElementById('tx-business-ratio').value);
        apportionmentMemo = document.getElementById('tx-apportionment-memo').value.trim();
        if (!apportionmentMemo && businessUseRatio !== 100 && businessUseRatio !== 0) {
          showToast('家事按分の場合、按分根拠メモは必須です', 'error');
          return;
        }
      } else if (usageType === 'private_only') {
        businessUseRatio = 0;
        apportionmentMemo = document.getElementById('tx-apportionment-memo').value.trim();
      }
    }

    const txData = {
      id: isEditing ? existingTx.id : generateId(),
      date,
      debitAccount,
      creditAccount,
      amount,
      description,
      partner,
      tags,
      usageType,
      businessUseRatio,
      apportionmentMethod,
      apportionmentMemo,
      apportionmentOffsetAccountCode: '1005'
    };

    // 編集時は元の調整仕訳IDを引き継ぐ
    if (isEditing && existingTx.linkedAdjustmentEntryId) {
      txData.linkedAdjustmentEntryId = existingTx.linkedAdjustmentEntryId;
    }

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
