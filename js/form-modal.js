const FormModal = (() => {
    const modal = document.getElementById('form-modal');
    const titleEl = document.getElementById('form-modal-title');
    const bodyEl = document.getElementById('form-modal-body');
    const closeBtn = document.getElementById('form-modal-close-btn');

    let currentForm = null;

    function show({ title, formId }) {
        titleEl.textContent = title;

        // Перемещаем нужную форму из шаблонов в тело модального окна
        const formTemplate = document.getElementById(formId);
        if (formTemplate) {
            currentForm = formTemplate;
            bodyEl.appendChild(currentForm);
        }

        modal.style.display = 'flex';
    }

    function hide() {
        // Возвращаем форму обратно в контейнер шаблонов, чтобы она не потерялась
        if (currentForm) {
            document.getElementById('form-templates').appendChild(currentForm);
            currentForm = null;
        }
        modal.style.display = 'none';
    }

    // Закрытие по кнопке и оверлею
    closeBtn.addEventListener('click', hide);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hide();
        }
    });

    return { show, hide };
})();