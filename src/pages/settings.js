import { store } from '../store.js';
import { db } from '../db.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { formatCurrency } from '../utils/format.js';

export function renderSettings() {

  // アカウントオプション生成ロジックの再利用
  const generateAccountOptions = (selectedCode) => {
    let options = '';
    const groups = {
      'revenue': '収益 (売上など)',
      'expense': '費用 (経費など)',
      'asset': '資産 (現金・預金など)',
      'liability': '負債 (借入金・クレカなど)',
      'equity': '純資産 (元入金など)'
    };

    for (const [category, label] of Object.entries(groups)) {
      const accountsInCategory = store.state.accounts.filter(a => a.category === category);
      if (accountsInCategory.length > 0) {
        options += `<optgroup label="${label}">`;
        accountsInCategory.forEach(acc => {
          const isSelected = acc.code === selectedCode ? 'selected' : '';
          options += `<option value="${acc.code}" ${isSelected}>${acc.code} ${acc.name}</option>`;
        });
        options += `</optgroup>`;
      }
    }
    return options;
  };

  const container = document.createElement('div');
  container.className = 'page-section animate-fade-in';

  container.innerHTML = `
    <div class="grid-2">
      <!-- 事業者設定 -->
      <div class="card settings-card">
        <h3 class="settings-section-title">事業者設定</h3>
        <form id="settings-form">
          <div class="form-group">
            <label class="form-label">事業所名 (屋号)</label>
            <input type="text" id="set-business-name" class="form-input" placeholder="例: KURONYLAB">
          </div>
          
          <div class="form-group">
            <label class="form-label">事業主名</label>
            <input type="text" id="set-taxpayer-name" class="form-input" placeholder="例: 黒木 皓基">
          </div>
          
          <div class="form-group">
            <label class="form-label">業種・事業内容</label>
            <input type="text" id="set-industry-type" class="form-input" placeholder="例: EC販売の受託業務">
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">申告方法</label>
              <select id="set-tax-return" class="form-select">
                <option value="blue">青色申告</option>
                <option value="white">白色申告</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">青色申告特別控除額</label>
              <select id="set-blue-deduction" class="form-select">
                <option value="650000">65万円 (e-Tax)</option>
                <option value="550000">55万円</option>
                <option value="100000">10万円</option>
                <option value="0">なし (白色など)</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">他アプリのURL (家計簿など)</label>
            <input type="url" id="set-other-app-url" class="form-input" placeholder="https://example-kakeibo.vercel.app">
            <small class="text-xs text-muted">アプリ切り替えボタンの遷移先URLを入力します</small>
          </div>
          
          <button type="button" class="btn btn-primary mt-md" id="btn-save-settings">設定を保存する</button>
        </form>
      </div>

      <!-- 自動記帳（サブスクリプション）設定 -->
      <div class="card settings-card">
        <h3 class="settings-section-title">毎月の自動記帳・サブスクリプション</h3>
        <p class="text-sm text-muted mb-md">毎月決まった日に発生する固定費（ChatGPT代、家賃、サーバー代など）を登録しておくと、該当月にアプリを開いたタイミングで自動的に記帳されます。</p>
        
        <div class="table-wrapper mb-lg">
          <table class="data-table">
            <thead>
              <tr>
                <th>発生日</th>
                <th>摘要 / 取引先</th>
                <th>借方 / 貸方</th>
                <th>金額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="subscriptions-list">
              <tr><td colspan="5" class="text-center text-muted">読み込み中...</td></tr>
            </tbody>
          </table>
        </div>

        <h4 class="text-md font-medium mb-sm">新しく自動記帳を登録する</h4>
        <form id="subscription-form" class="bg-card-alt" style="padding: var(--spacing-md); border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">開始月</label>
              <input type="month" id="sub-start-month" class="form-input" required value="${new Date().toISOString().slice(0, 7)}">
              <small class="text-xs text-muted" style="display:block;margin-top:4px;">過去の月を指定した場合、現在月まで即座に一括反映されます</small>
            </div>
            <div class="form-group">
              <label class="form-label">終了月 (任意)</label>
              <input type="month" id="sub-end-month" class="form-input">
            </div>
            <div class="form-group" style="flex: 0 0 100px;">
              <label class="form-label">発生日</label>
              <select id="sub-day" class="form-select" required>
                ${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">${i + 1}日</option>`).join('')}
                <option value="99">末日</option>
              </select>
            </div>
          </div>
          <div class="form-row mt-sm">
            <div class="form-group">
              <label class="form-label">借方（増えたもの/費用）</label>
              <select id="sub-debit" class="form-select" required>
                ${generateAccountOptions('1001')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">貸方（減ったもの/収入）</label>
              <select id="sub-credit" class="form-select" required>
                ${generateAccountOptions('4001')}
              </select>
            </div>
          </div>
          <div class="form-row mt-sm">
            <div class="form-group">
              <label class="form-label">金額 (円)</label>
              <input type="number" id="sub-amount" class="form-input" required min="1" placeholder="例: 3000">
            </div>
            <div class="form-group">
              <label class="form-label">取引先 (任意)</label>
              <input type="text" id="sub-partner" class="form-input" placeholder="例: OpenAI">
            </div>
          </div>
          <div class="form-row mt-sm">
            <div class="form-group">
              <label class="form-label">摘要 (メモ)</label>
              <input type="text" id="sub-desc" class="form-input" list="sub-desc-list" required placeholder="例: ChatGPT Plus利用料">
              <datalist id="sub-desc-list"></datalist>
            </div>
            <div class="form-group">
              <label class="form-label">タグ / プロジェクト (任意)</label>
              <input type="text" id="sub-tags" class="form-input" list="sub-tags-list" placeholder="例: 〇〇事業">
              <datalist id="sub-tags-list"></datalist>
            </div>
          </div>
          <!-- 家事按分UI (サブスク) -->
          <div id="sub-apportionment-hint" class="text-xs text-muted mb-sm" style="border-top: 1px dashed var(--border-color); padding-top: var(--spacing-sm); margin-top: var(--spacing-sm);">
            ※ 借方に費用科目（5xxx）を選択すると、家事按分の設定が表示されます
          </div>
          <div class="form-group" id="sub-apportionment-section" style="display: none; border-top: 1px dashed var(--border-color); padding-top: var(--spacing-sm); margin-top: var(--spacing-sm);">
            <label class="form-label font-bold text-primary" style="font-size: 0.85rem;">⚖️ 家事按分・事業利用設定</label>
            
            <div class="form-row">
                <div class="form-group w-1/2">
                    <label class="form-label" style="font-size: 0.75rem;">利用区分</label>
                    <select id="sub-usage-type" class="form-select">
                        <option value="business_only" selected>100% 事業用</option>
                        <option value="mixed">家事按分（混在）</option>
                        <option value="private_only">100% 私用（全額除外）</option>
                    </select>
                </div>
                
                <div class="form-group w-1/2" id="sub-ratio-group" style="display: none;">
                    <label class="form-label" style="font-size: 0.75rem;">事業利用割合 (%)</label>
                    <input type="number" id="sub-business-ratio" class="form-input" min="0" max="100" value="100">
                </div>
            </div>
            
            <div id="sub-apportionment-details" style="display: none; background: var(--bg-color); padding: var(--spacing-sm); border-radius: var(--border-radius-sm); margin-bottom: var(--spacing-sm);">
                <div class="form-group mb-0">
                    <label class="form-label text-xs">按分根拠メモ <span class="text-rose">*</span></label>
                    <input type="text" id="sub-apportionment-memo" class="form-input text-sm" placeholder="例: AIツール開発や顧客対応に利用。私的利用も含むため事業割合80%とする">
                </div>
            </div>
          </div>

          <div class="flex gap-sm mt-sm">
            <button type="button" class="btn btn-secondary" id="btn-cancel-edit-subscription" style="display: none;">入力をクリア</button>
            <button type="submit" class="btn btn-primary" id="btn-add-subscription">自動記帳を登録する</button>
          </div>
        </form>
      </div>
    </div>

    <!-- データ管理・危険な操作 -->
    <div>
        <div class="card settings-card mb-lg">
          <h3 class="settings-section-title">データエクスポート・インポート</h3>
          <p class="text-sm text-muted mb-md">万が一のブラウザデータ消失に備えて、定期的にバックアップ（エクスポート）を保存してください。</p>
          
          <div class="flex gap-md mb-lg">
            <button class="btn btn-secondary" id="btn-export-backup">⬇️ フルバックアップ (JSON)</button>
          </div>
          
          <hr style="border:0; border-top:1px solid var(--border-color); margin: 16px 0;">
          
          <p class="text-sm text-muted mb-md">バックアップファイルからデータを復元します。（現在のデータは上書きされます）</p>
          <div class="flex items-center gap-md">
            <input type="file" id="import-file" accept=".json" class="form-input" style="padding: 6px;">
            <button class="btn btn-secondary" id="btn-import-backup">⬆️ 復元</button>
          </div>
        </div>

        <div class="card settings-card" style="border-color: rgba(244, 63, 94, 0.3);">
          <h3 class="settings-section-title text-rose">危険な操作</h3>
          <p class="text-sm text-muted mb-md">ブラウザに保存されているすべての仕訳、勘定科目、設定データを完全に削除します。この操作は元に戻せません。</p>
          <button class="btn btn-danger" id="btn-clear-data">🗑️ すべてのデータを初期化</button>
        </div>
      </div>
    </div>
  `;

  return container;
}

export function onSettingsMount() {
  if (window._currentUnsubscribe) window._currentUnsubscribe();

  // 初期値のセット
  const setFormValues = () => {
    const settings = store.state.settings || {};
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };

    setVal('set-business-name', settings.businessName || '');
    setVal('set-taxpayer-name', settings.taxpayerName || '');
    setVal('set-industry-type', settings.industryType || '');
    setVal('set-tax-return', settings.taxReturnMethod || 'blue');
    setVal('set-blue-deduction', settings.blueReturnDeduction || '650000');
    setVal('set-other-app-url', settings.otherAppUrl || '');
    setVal('set-fixed-rate', settings.fixedRatePerStore || 10000);
  };

  const unsubscribe = store.subscribe(() => {
    setFormValues();
  });
  window._currentUnsubscribe = unsubscribe;

  // 即時反映
  setFormValues();

  // 保存ボタン
  const saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const newSettings = {
        ...store.state.settings,
        businessName: document.getElementById('set-business-name').value,
        taxpayerName: document.getElementById('set-taxpayer-name').value,
        industryType: document.getElementById('set-industry-type').value,
        taxReturnMethod: document.getElementById('set-tax-return').value,
        blueReturnDeduction: parseInt(document.getElementById('set-blue-deduction').value, 10),
        otherAppUrl: document.getElementById('set-other-app-url').value,
        fixedRatePerStore: parseInt(document.getElementById('set-fixed-rate').value, 10) || 10000
      };

      try {
        await db.saveSettings(newSettings);
        store.setState({ settings: newSettings });
        showToast('設定を保存しました', 'success');
      } catch (err) {
        showToast('保存に失敗しました', 'error');
      }
    });
  }

  // 報酬設定のみ保存
  const saveStoreSettingsBtn = document.getElementById('btn-save-store-settings');
  if (saveStoreSettingsBtn) {
    saveStoreSettingsBtn.addEventListener('click', async () => {
      const fixedRate = parseInt(document.getElementById('set-fixed-rate').value, 10) || 10000;
      const newSettings = {
        ...store.state.settings,
        fixedRatePerStore: fixedRate
      };
      try {
        await db.saveSettings(newSettings);
        store.setState({ settings: newSettings });
        import('../components/toast.js').then(({ showToast }) => {
          showToast('報酬設定を保存しました', 'success');
        });
      } catch (err) {
        import('../components/toast.js').then(({ showToast }) => {
          showToast('保存に失敗しました', 'error');
        });
      }
    });
  }

  // フルバックアップ・エクスポート
  const exportBtn = document.getElementById('btn-export-backup');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const { settings, accounts, currentYear } = store.state;
      const allTxs = await db.getAllTransactions();
      const { exportToJSON } = await import('../utils/export.js');

      const backupData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        settings,
        accounts,
        transactions: allTxs
      };

      exportToJSON(backupData, `kuronylab_backup_${currentYear}_${Date.now()}`);
      showToast('バックアップをエクスポートしました', 'success');
    });
  }

  // 復元（インポート）処理
  const importBtn = document.getElementById('btn-import-backup');
  const importFile = document.getElementById('import-file');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', async () => {
      const file = importFile.files[0];
      if (!file) {
        showToast('ファイルを選択してください', 'error');
        return;
      }

      confirmDialog(
        'データの復元',
        '選択したバックアップファイルからデータを復元しますか？現在のデータはすべて上書きされます。',
        async () => {
          try {
            const { importFromJSON } = await import('../utils/export.js');
            const backupData = await importFromJSON(file);

            if (!backupData || (!backupData.transactions && !backupData.accounts)) {
              throw new Error('不適切な形式のバックアップファイルです');
            }

            await db.importAllData(backupData);
            await store.init(); // ストアを再初期化して最新データを反映

            showToast('データを復元しました', 'success');
            importFile.value = ''; // 選択をクリア
          } catch (err) {
            console.error('Restore error:', err);
            showToast(err.message || '復元に失敗しました', 'error');
          }
        },
        '復元を実行する'
      );
    });
  }

  // データ初期化
  const clearBtn = document.getElementById('btn-clear-data');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      confirmDialog(
        'データの全消去',
        '本当にすべてのデータを削除しますか？この操作は取り消せません。実行する前にバックアップを取ることを強くお勧めします。',
        async () => {
          try {
            await db.clearAllData();
            await store.init();
            showToast('すべてのデータを初期化しました', 'success');
          } catch (e) {
            showToast('データ初期化に失敗しました', 'error');
          }
        },
        '完全に削除する'
      );
    });
  }

  renderSubscriptions();

  // 入力履歴に基づくサジェストの準備
  const setupAutocomplete = async () => {
    const txs = await db.getAllTransactions();

    const descriptions = [...new Set(txs.map(t => t.description).filter(Boolean))].sort();
    const partners = [...new Set(txs.map(t => t.partner).filter(Boolean))].sort();

    // tagsはカンマ区切りの場合があるので分割して集計
    const tagsSet = new Set();
    txs.forEach(t => {
      if (t.tags) {
        t.tags.split(',').map(tag => tag.trim()).filter(Boolean).forEach(tag => tagsSet.add(tag));
      }
    });
    const tags = [...tagsSet].sort();

    const fillDatalist = (id, options) => {
      const dl = document.getElementById(id);
      if (dl) dl.innerHTML = options.map(opt => `<option value="${opt}">`).join('');
    };

    fillDatalist('sub-desc-list', descriptions);
    fillDatalist('sub-partner-list', partners);
    fillDatalist('sub-tags-list', tags);

    // 摘要入力時の自動反映ロジック
    const descInput = document.getElementById('sub-desc');
    if (descInput) {
      descInput.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;

        // 編集モード中は上書きしないようにする
        if (subForm && subForm.dataset.editingId) return;

        // 過去の取引から同じ摘要を探す（最新のものを優先するために逆順探索するか、ここではシンプルに検索）
        const matchedTx = txs.slice().reverse().find(t => t.description === val);
        if (matchedTx) {
          document.getElementById('sub-debit').value = matchedTx.debitAccount;
          document.getElementById('sub-credit').value = matchedTx.creditAccount;
          document.getElementById('sub-amount').value = matchedTx.amount;
          if (matchedTx.partner) document.getElementById('sub-partner').value = matchedTx.partner;
          if (matchedTx.tags) document.getElementById('sub-tags').value = matchedTx.tags;

          // 按分UIの連動
          const debitSelect = document.getElementById('sub-debit');
          if (debitSelect) debitSelect.dispatchEvent(new Event('change'));

          import('../components/toast.js').then(({ showToast }) => {
            showToast('過去の履歴から自動反映しました', 'info');
          });
        }
      });
    }
  };

  // 初期データがない可能性もあるので少し待ってから実行（または store にデータがあればそれを使う）
  setTimeout(setupAutocomplete, 500);

  // --- サブスク按分UI制御ロジック ---
  const subDebitSelect = document.getElementById('sub-debit');
  const subApportSection = document.getElementById('sub-apportionment-section');
  const subUsageSelect = document.getElementById('sub-usage-type');
  const subRatioGroup = document.getElementById('sub-ratio-group');
  const subRatioInput = document.getElementById('sub-business-ratio');
  const subDetailsDiv = document.getElementById('sub-apportionment-details');

  const subApportHint = document.getElementById('sub-apportionment-hint');

  const updateSubApportionmentUI = () => {
    if (!subDebitSelect || !subApportSection) return;

    const isExpense = subDebitSelect.value.startsWith('5');
    subApportSection.style.display = isExpense ? 'block' : 'none';
    if (subApportHint) subApportHint.style.display = isExpense ? 'none' : 'block';

    if (!isExpense) return;

    const usage = subUsageSelect.value;
    if (usage === 'business_only') {
      subRatioGroup.style.display = 'none';
      subDetailsDiv.style.display = 'none';
      subRatioInput.value = 100;
    } else if (usage === 'private_only') {
      subRatioGroup.style.display = 'none';
      subDetailsDiv.style.display = 'block';
      subRatioInput.value = 0;
    } else if (usage === 'mixed') {
      subRatioGroup.style.display = 'block';
      subDetailsDiv.style.display = 'block';
    }
  };

  if (subDebitSelect) {
    subDebitSelect.addEventListener('change', updateSubApportionmentUI);
    subDebitSelect.addEventListener('input', updateSubApportionmentUI);
  }
  if (subUsageSelect) subUsageSelect.addEventListener('change', updateSubApportionmentUI);

  // 初期化時に一度実行
  updateSubApportionmentUI();

  // サブスク登録・更新フォーム
  const subForm = document.getElementById('subscription-form');
  const cancelEditBtn = document.getElementById('btn-cancel-edit-subscription');
  const submitBtn = document.getElementById('btn-add-subscription');

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      subForm.reset();
      delete subForm.dataset.editingId;
      submitBtn.textContent = '自動記帳を登録する';
      cancelEditBtn.style.display = 'none';
      const select = document.getElementById('sub-debit');
      if (select) select.dispatchEvent(new Event('change'));
    });
  }

  if (subForm) {
    subForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;

      const dayOfMonth = parseInt(document.getElementById('sub-day').value, 10);
      const debitAccount = document.getElementById('sub-debit').value;
      const creditAccount = document.getElementById('sub-credit').value;
      const amount = parseInt(document.getElementById('sub-amount').value, 10);
      const partner = document.getElementById('sub-partner').value;
      const description = document.getElementById('sub-desc').value;
      const tags = document.getElementById('sub-tags').value;
      const startMonth = document.getElementById('sub-start-month').value;
      const endMonth = document.getElementById('sub-end-month').value || null;

      const isEditing = !!subForm.dataset.editingId;

      let usageType = 'business_only';
      let businessUseRatio = 100;
      let apportionmentMethod = 'fixed_ratio';
      let apportionmentMemo = '';

      if (debitAccount.startsWith('5')) {
        usageType = document.getElementById('sub-usage-type').value;
        if (usageType === 'mixed') {
          businessUseRatio = Number(document.getElementById('sub-business-ratio').value);
          apportionmentMemo = document.getElementById('sub-apportionment-memo').value.trim();
          if (!apportionmentMemo && businessUseRatio !== 100 && businessUseRatio !== 0) {
            import('../components/toast.js').then(({ showToast }) => {
              showToast('家事按分の場合、按分根拠メモは必須です', 'error');
            });
            submitBtn.disabled = false;
            return;
          }
        } else if (usageType === 'private_only') {
          businessUseRatio = 0;
          apportionmentMemo = document.getElementById('sub-apportionment-memo').value.trim();
        }
      }

      try {
        const subData = {
          dayOfMonth,
          debitAccount,
          creditAccount,
          amount,
          partner,
          description,
          tags,
          startMonth,
          endMonth,
          usageType,
          businessUseRatio,
          apportionmentMethod,
          apportionmentMemo,
          apportionmentOffsetAccountCode: '1005'
        };

        if (isEditing) {
          subData.id = subForm.dataset.editingId;
          const originalSub = await db.getSubscriptions().then(subs => subs.find(s => s.id === subData.id));
          if (originalSub) subData.createdAt = originalSub.createdAt; // 既存データ維持

          await db.updateSubscription(subData);

          // 過去の取引への遡及適用
          const txs = await db.getAllTransactions();
          const relatedTxs = txs.filter(t => t.subscriptionId === subData.id && !t.isApportionmentAdjustment);

          if (relatedTxs.length > 0) {
            for (const tx of relatedTxs) {
              // 取引側の按分情報を更新
              tx.usageType = subData.usageType;
              tx.businessUseRatio = subData.businessUseRatio;
              tx.apportionmentMemo = subData.apportionmentMemo;
              tx.apportionmentOffsetAccountCode = subData.apportionmentOffsetAccountCode;

              await db.updateTransaction(tx);
            }
            showToast(`自動記帳を更新し、過去の${relatedTxs.length}件の取引にも按分設定を適用しました`, 'success');
          } else {
            showToast('自動記帳を更新しました', 'success');
          }
        } else {
          const newSub = await db.addSubscription(subData);

          // 新規登録時も即座に過去分などを一括記帳
          const syncedCount = await db.processAutoSubscriptions();
          if (syncedCount > 0) {
            showToast(`自動記帳を登録し、過去の${syncedCount}件を記帳しました`, 'success');
          } else {
            showToast('自動記帳を登録しました', 'success');
          }
        }

        subForm.reset();
        delete subForm.dataset.editingId;
        submitBtn.textContent = '自動記帳を登録する';
        cancelEditBtn.style.display = 'none';

        renderSubscriptions();
      } catch (err) {
        console.error(err);
        showToast(isEditing ? '更新に失敗しました' : '登録に失敗しました', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
}

// サブスクリストの描画
async function renderSubscriptions() {
  const listEl = document.getElementById('subscriptions-list');
  if (!listEl) return;

  try {
    const subs = await db.getSubscriptions();
    const { formatCurrency } = await import('../utils/format.js');

    if (subs.length === 0) {
      listEl.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">登録されている自動記帳はありません</td></tr>`;
      return;
    }

    listEl.innerHTML = subs.sort((a, b) => a.dayOfMonth - b.dayOfMonth).map(sub => {
      const debitAcc = store.getAccountByCode(sub.debitAccount);
      const creditAcc = store.getAccountByCode(sub.creditAccount);
      const dayStr = sub.dayOfMonth === 99 ? '末日' : `${sub.dayOfMonth}日`;

      let periodStr = sub.startMonth ? `${sub.startMonth} ~ ` : '無期限';
      if (sub.startMonth && sub.endMonth) {
        periodStr = `${sub.startMonth} ~ ${sub.endMonth}`;
      } else if (sub.endMonth) {
        periodStr = `~ ${sub.endMonth}`;
      }

      return `
            <tr>
              <td><span class="badge badge-primary">毎月 ${dayStr}</span></td>
              <td class="text-sm font-mono text-secondary">${periodStr}</td>
              <td>
                <div class="font-medium">${sub.description}</div>
                ${sub.partner ? `<div class="text-xs text-muted">👤 ${sub.partner}</div>` : ''}
                ${sub.tags ? `<div class="text-xs text-muted mt-xs"><span class="badge badge-outline" style="font-size: 0.7rem; padding: 2px 6px;">${sub.tags}</span></div>` : ''}
              </td>
              <td>
                <div class="text-sm">借: ${debitAcc?.name || sub.debitAccount}</div>
                <div class="text-sm text-muted">貸: ${creditAcc?.name || sub.creditAccount}</div>
              </td>
              <td class="text-right font-medium">${formatCurrency(sub.amount)}</td>
              <td class="text-center" style="white-space: nowrap;">
                <button class="btn btn-ghost btn-sm text-primary mr-2" onclick="window.editSubscription('${sub.id}')" title="編集">✏️</button>
                <button class="btn btn-ghost btn-sm text-rose" onclick="window.deleteSubscription('${sub.id}')" title="削除">🗑️</button>
              </td>
            </tr>
            `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = `<tr><td colspan="5" class="text-center text-rose">データの読み込みに失敗しました</td></tr>`;
  }
}

window.editSubscription = async function (id) {
  try {
    const { db } = await import('../db.js');
    const subs = await db.getSubscriptions();
    const sub = subs.find(s => s.id === id);
    if (!sub) return;

    const setVal = (elId, val) => {
      const el = document.getElementById(elId);
      if (el && val !== undefined && val !== null) el.value = val;
    };

    setVal('sub-start-month', sub.startMonth);
    setVal('sub-end-month', sub.endMonth || '');
    setVal('sub-day', sub.dayOfMonth);
    setVal('sub-debit', sub.debitAccount);
    setVal('sub-credit', sub.creditAccount);
    setVal('sub-amount', sub.amount);
    setVal('sub-partner', sub.partner || '');
    setVal('sub-desc', sub.description || '');
    setVal('sub-tags', sub.tags || '');

    setVal('sub-usage-type', sub.usageType || 'business_only');
    setVal('sub-business-ratio', sub.businessUseRatio !== undefined ? sub.businessUseRatio : 100);
    setVal('sub-apportionment-memo', sub.apportionmentMemo || '');

    const select = document.getElementById('sub-debit');
    if (select) select.dispatchEvent(new Event('change'));

    const form = document.getElementById('subscription-form');
    const submitBtn = document.getElementById('btn-add-subscription');
    const cancelBtn = document.getElementById('btn-cancel-edit-subscription');

    form.dataset.editingId = id;
    submitBtn.innerHTML = '<span class="mr-xs">✏️</span> 自動記帳を更新';
    cancelBtn.style.display = 'block';

    // フォームが見えるようにスクロール
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    console.error(err);
  }
};

// グローバルスコープに削除関数を露出
window.deleteSubscription = (id) => {
  confirmDialog(
    '自動記帳の削除',
    'この自動記帳設定を削除しますか？（すでに記帳済みの過去の取引は消えません）',
    async () => {
      try {
        const { db } = await import('../db.js');
        await db.deleteSubscription(id);
        const { showToast } = await import('../components/toast.js');
        showToast('削除しました', 'success');

        // 編集中のものを削除した場合のリセット
        const form = document.getElementById('subscription-form');
        if (form && form.dataset.editingId === id) {
          document.getElementById('btn-cancel-edit-subscription').click();
        }

        // renderSubscriptions がグローバルにないため、イベントを発火させるなどするか、
        // settings.jsが再読み込みされるかだが、ここでは簡略化のためリロード
        window.location.reload();
      } catch (e) {
        console.error(e);
        const { showToast } = await import('../components/toast.js');
        showToast('削除に失敗しました', 'error');
      }
    },
    '削除する'
  );
};
