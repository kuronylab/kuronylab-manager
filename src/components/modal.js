import { store } from '../store.js';
import { db } from '../db.js';

export function renderModal(options) {
    const {
        title,
        body,
        footer,
        onClose = () => { },
        closeOnBackdrop = true,
    } = options;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal';

    // モーダルヘッダー
    const headerHtml = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close" id="modal-close-btn">&times;</button>
    </div>
  `;

    // モーダルボディ
    const bodyHtml = `
    <div class="modal-body" id="modal-body-container"></div>
  `;

    // モーダルフッター（オプション）
    const footerHtml = footer ? `
    <div class="modal-footer" id="modal-footer-container"></div>
  ` : '';

    modal.innerHTML = headerHtml + bodyHtml + footerHtml;
    backdrop.appendChild(modal);

    // コンテンツの注入
    if (typeof body === 'string') {
        modal.querySelector('#modal-body-container').innerHTML = body;
    } else if (body instanceof Node) {
        modal.querySelector('#modal-body-container').appendChild(body);
    }

    if (footer) {
        if (typeof footer === 'string') {
            modal.querySelector('#modal-footer-container').innerHTML = footer;
        } else if (footer instanceof Node) {
            modal.querySelector('#modal-footer-container').appendChild(footer);
        }
    }

    // イベントリスナー
    const closeModal = () => {
        backdrop.style.animation = 'fadeIn 200ms reverse forwards';
        modal.style.animation = 'slideUp 200ms reverse forwards';
        setTimeout(() => {
            document.getElementById('modal-root').innerHTML = '';
            onClose();
        }, 200);
    };

    backdrop.querySelector('#modal-close-btn').addEventListener('click', closeModal);

    if (closeOnBackdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });
    }

    // レンダリング
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    root.appendChild(backdrop);

    return closeModal;
}

// 汎用の確認ダイアログ
export function confirmDialog(title, message, onConfirm, confirmText = '削除する', type = 'danger') {
    const body = `<p class="confirm-message">${message}</p>`;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = 'var(--spacing-md)';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'キャンセル';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `btn btn-${type}`;
    confirmBtn.textContent = confirmText;

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    const close = renderModal({
        title,
        body,
        footer
    });

    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', () => {
        onConfirm();
        close();
    });
}
