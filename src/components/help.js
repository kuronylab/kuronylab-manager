import { renderModal } from './modal.js';

export function showHelpModal() {
    const bodyHtml = `
    <div class="help-content">
      <div class="help-section mb-lg">
        <h4 style="color: var(--accent-emerald); margin-bottom: var(--spacing-sm); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">1. 簿記のキホン（借方と貸方）</h4>
        <p class="text-secondary" style="font-size: 0.9rem; line-height: 1.6; margin-bottom: var(--spacing-md);">
          複式簿記では、1つの取引を「原因」と「結果」の2つに分けて記録します。これが左側（借方）と右側（貸方）です。<br>
          難しく考えず、以下のルールだけ覚えておけば大丈夫です。
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: var(--spacing-md); border-radius: var(--border-radius-sm);">
            <div style="font-weight: bold; color: var(--accent-emerald); margin-bottom: 8px;">👈 借方（左側）</div>
            <ul style="font-size: 0.85rem; padding-left: 1.2rem; color: var(--text-secondary);">
              <li><strong>資産が増えた</strong> (銀行にお金が入った 等)</li>
              <li><strong>費用が発生した</strong> (経費を払った 等)</li>
            </ul>
          </div>
          <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); padding: var(--spacing-md); border-radius: var(--border-radius-sm);">
            <div style="font-weight: bold; color: var(--accent-rose); margin-bottom: 8px;">👉 貸方（右側）</div>
            <ul style="font-size: 0.85rem; padding-left: 1.2rem; color: var(--text-secondary);">
              <li><strong>資産が減った</strong> (銀行からお金を払った 等)</li>
              <li><strong>収益が発生した</strong> (売上が出た 等)</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="help-section mb-lg">
        <h4 style="color: var(--accent-blue); margin-bottom: var(--spacing-sm); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">2. よく使う仕訳パターン（EC・受託向け）</h4>
        <div class="table-wrapper">
          <table class="data-table" style="font-size: 0.8rem;">
            <thead>
              <tr>
                <th width="30%">こんなとき</th>
                <th width="35%">借方 (左)</th>
                <th width="35%">貸方 (右)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>商品を販売し、現金をもらった</td>
                <td class="text-emerald">現金</td>
                <td class="text-rose">売上高</td>
              </tr>
              <tr>
                <td>商品をクレジットカードで仕入れた</td>
                <td class="text-emerald">仕入高</td>
                <td class="text-rose">未払金</td>
              </tr>
              <tr>
                <td>商品を発送し、送料を現金で払った</td>
                <td class="text-emerald">荷造運賃</td>
                <td class="text-rose">現金</td>
              </tr>
              <tr>
                <td>事業用のスマホ代が口座から引かれた</td>
                <td class="text-emerald">通信費</td>
                <td class="text-rose">普通預金</td>
              </tr>
              <tr>
                <td>クレジットカードの代金が口座から引き落とされた</td>
                <td class="text-emerald">未払金</td>
                <td class="text-rose">普通預金</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-muted" style="font-size: 0.75rem; margin-top: 8px;">※ 取引入力画面の「テンプレート」ボタンを使えば、これらの一般的な仕訳が1クリックで自動入力されます。</p>
      </div>

      <div class="help-section">
        <h4 style="color: var(--accent-purple); margin-bottom: var(--spacing-sm); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">3. 各画面（帳簿）の意味</h4>
        <dl style="font-size: 0.85rem; line-height: 1.6;">
          <dt style="font-weight: bold; color: var(--text-primary); margin-top: 8px;">📖 仕訳帳（しわけちょう）</dt>
          <dd style="color: var(--text-secondary); margin-left: 0;">全てのお金の動きを日付順に記録した日記帳。ここを見れば1日の取引の流れがわかります。</dd>
          
          <dt style="font-weight: bold; color: var(--text-primary); margin-top: 8px;">📒 総勘定元帳（そうかんじょうもとちょう）</dt>
          <dd style="color: var(--text-secondary); margin-left: 0;">「現金」や「売上」など、科目ごとに分けた専用ノート。特定の科目の残高の変化を追うのに使います。</dd>
          
          <dt style="font-weight: bold; color: var(--text-primary); margin-top: 8px;">⚖️ 残高試算表（ざんだかしさんひょう）</dt>
          <dd style="color: var(--text-secondary); margin-left: 0;">全ての科目の現在の合計残高を並べた一覧表。入力ミス（借方と貸方のズレ）がないかを確認する健康診断表です。</dd>
        </dl>
      </div>
    </div>
  `;

    const footerHtml = `
    <button class="btn btn-primary" id="help-modal-close">閉じる</button>
  `;

    const close = renderModal({
        title: '📘 経営初心者向け：勘定科目・仕訳ガイド',
        body: bodyHtml,
        footer: footerHtml
    });

    document.getElementById('help-modal-close').addEventListener('click', close);
}
