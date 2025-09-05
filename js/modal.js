const ConfirmationModal = (() => {
    const modal = document.getElementById('confirmation-modal');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const closeBtn = document.getElementById('modal-close-btn');

    let onConfirmCallback = null;

    const show = (options = {}) => {
        titleEl.textContent = options.title || 'Подтверждение';
        confirmBtn.textContent = options.confirmText || 'Подтвердить';

        if (options.html) {
            messageEl.innerHTML = options.html;
        } else {
            messageEl.textContent = options.message || 'Вы уверены?';
        }
        
        onConfirmCallback = options.onConfirm;

        modal.style.display = 'flex';
    };

    const hide = () => {
        modal.style.display = 'none';
        onConfirmCallback = null;
    };

    confirmBtn.addEventListener('click', () => {
        if (typeof onConfirmCallback === 'function') {
            onConfirmCallback();
        }
        hide();
    });

    cancelBtn.addEventListener('click', hide);
    closeBtn.addEventListener('click', hide);

    return {
        show
    };
})();