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
        confirmBtn.style.display = options.hideConfirmButton ? 'none' : 'inline-block';
        cancelBtn.textContent = options.cancelText || 'Отмена';

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

    // Закрытие модального окна по клику на оверлей (темный фон)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hide();
        }
    });

    // Закрытие модального окна по нажатию клавиши Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            hide();
        }
    });

    // Позволяем внешнему коду вешать обработчики на контент модального окна
    modal.addEventListener('click', (e) => {
        // Если клик был по кнопке, которая должна просто закрыть окно (без подтверждения),
        // и у нее нет своего обработчика, то закрываем.
        // Это предотвращает закрытие окна, когда на кнопке висит другая логика.
        if (e.target.classList.contains('modal-action-btn') && !onConfirmCallback) {
            hide();
        }
    });

    return {
        show
    };
})();