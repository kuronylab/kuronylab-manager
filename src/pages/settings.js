import { store } from '../store.js';
import { db } from '../db.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';

export function renderSettings() {
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
          
          <button type="button" class="btn btn-primary mt-md" id="btn-save-settings">設定を保存する</button>
        </form>
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
        const { settings } = store.state;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined) el.value = val;
        };

        setVal('set-business-name', settings.businessName || '');
        setVal('set-taxpayer-name', settings.taxpayerName || '');
        setVal('set-industry-type', settings.industryType || '');
        setVal('set-tax-return', settings.taxReturnMethod || 'blue');
        setVal('set-blue-deduction', settings.blueReturnDeduction || '650000');
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
                blueReturnDeduction: parseInt(document.getElementById('set-blue-deduction').value, 10)
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
}
