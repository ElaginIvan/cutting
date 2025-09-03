document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-assortment-form');
    const nameInput = document.getElementById('assortment-name');
    const sizesInput = document.getElementById('assortment-sizes');
    const listContainer = document.getElementById('assortment-list-container');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelButton = document.getElementById('assortment-cancel-edit-btn');
    const kerfInput = document.getElementById('settings-kerf');
    const minRemnantInput = document.getElementById('settings-min-remnant');
    const deficitLengthInput = document.getElementById('settings-deficit-length');
    const strategySelect = document.getElementById('settings-strategy');

    let isEditMode = false;
    let originalNameToEdit = null;

    // Обработчик отправки формы
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        // Превращаем строку "20x20, 40x20" в массив ["20x20", "40x20"]
        const sizes = sizesInput.value.split(',').map(s => s.trim()).filter(s => s);

        if (!name || sizes.length === 0) {
            alert('Пожалуйста, заполните все поля.');
            return;
        }

        const assortmentItem = { name, sizes };

        if (isEditMode) {
            DB.updateAssortment(originalNameToEdit, assortmentItem);
        } else {
            DB.addAssortment(assortmentItem);
        }

        exitEditMode(); // Сбрасываем форму и режим редактирования
        renderAssortmentList();
        updateAccordionHeight(); // Обновляем высоту аккордеона
        // Оповещаем другие части приложения, что данные обновились
        window.dispatchEvent(new Event('assortmentUpdated'));
    });

    // Функция для отрисовки списка
    function renderAssortmentList() {
        const assortmentItems = DB.getAssortment();
        listContainer.innerHTML = ''; // Очищаем список

        if (assortmentItems.length === 0) {
            listContainer.innerHTML = '<p class="text-muted">Вы еще не добавили ни одного типа материала.</p>';
            return;
        }

        assortmentItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'list-item'; // Используем стили как у material-list
            itemDiv.innerHTML = `
                    <div class="item-info">
                        ${item.name}
                        ${item.sizes.join(', ')}
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon btn-edit-assortment fa-solid fa-pen" data-name="${item.name}"></button>
                        <button class="btn-icon btn-delete-assortment fa-solid fa-xmark" data-name="${item.name}"></button>
                    </div>
                `;
            listContainer.appendChild(itemDiv);
        });
    }

    // Функция для обновления высоты открытого аккордеона
    function updateAccordionHeight() {
        // Находим родительский контейнер аккордеона для нашего списка
        const accordionContent = listContainer.closest('.accordion-content');

        // Проверяем, открыт ли аккордеон (у него будет установлен maxHeight)
        if (accordionContent && accordionContent.style.maxHeight) {
            // Обновляем maxHeight, чтобы вместить новое содержимое
            accordionContent.style.maxHeight = accordionContent.scrollHeight + "px";
        }
    }

    // Делегирование события для кнопок удаления
    listContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('btn-delete-assortment')) {
            const name = e.target.dataset.name;
            if (confirm(`Вы уверены, что хотите удалить "${name}"?`)) {
                DB.deleteAssortment(name);
                renderAssortmentList();
                updateAccordionHeight(); // Обновляем высоту аккордеона
                window.dispatchEvent(new Event('assortmentUpdated'));
            }
        } else if (target.classList.contains('btn-edit-assortment')) {
            const name = target.dataset.name;
            enterEditMode(name);
        }
    });

    function enterEditMode(name) {
        const assortmentItem = DB.getAssortment().find(item => item.name === name);
        if (!assortmentItem) return;

        isEditMode = true;
        originalNameToEdit = name;

        nameInput.value = assortmentItem.name;
        sizesInput.value = assortmentItem.sizes.join(', ');

        submitButton.textContent = 'Сохранить';
        cancelButton.style.display = 'inline-block';
        nameInput.focus(); // Фокус на первом поле для удобства
    }

    function exitEditMode() {
        isEditMode = false;
        originalNameToEdit = null;

        form.reset();
        submitButton.textContent = 'Добавить сортамент';
        cancelButton.style.display = 'none';
    }

    cancelButton.addEventListener('click', exitEditMode);

    // --- Логика для настроек раскроя ---
    function initializeCuttingSettings() {
        const settings = DB.getSettings();
        kerfInput.value = settings.kerf;
        minRemnantInput.value = settings.minRemnantSize;
        deficitLengthInput.value = settings.deficitCalcLength;
        strategySelect.value = settings.cuttingStrategy;

        kerfInput.addEventListener('change', (e) => {
            const newKerf = parseInt(e.target.value, 10);
            // Сохраняем, только если значение корректно
            if (!isNaN(newKerf) && newKerf >= 0) {
                DB.updateSetting('kerf', newKerf);
            }
        });

        minRemnantInput.addEventListener('change', (e) => {
            const newSize = parseInt(e.target.value, 10);
            // Сохраняем, только если значение корректно
            if (!isNaN(newSize) && newSize >= 0) {
                DB.updateSetting('minRemnantSize', newSize);
            }
        });

        deficitLengthInput.addEventListener('change', (e) => {
            const newLength = parseInt(e.target.value, 10);
            // Сохраняем, только если значение корректно
            if (!isNaN(newLength) && newLength > 0) {
                DB.updateSetting('deficitCalcLength', newLength);
            }
        });

        strategySelect.addEventListener('change', (e) => {
            DB.updateSetting('cuttingStrategy', e.target.value);
        });
    }

    // --- Логика для UI аккордеона ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', function () {
            // Переключаем класс 'active' на заголовке
            this.classList.toggle('active');

            // Находим следующий элемент - контент аккордеона
            const content = this.nextElementSibling;

            // Управляем высотой для плавной анимации
            if (content.style.maxHeight) {
                content.style.maxHeight = null; // Закрываем
            } else {
                content.style.maxHeight = content.scrollHeight + "px"; // Открываем
            }
        });
    });

    // --- Инициализация при загрузке страницы ---
    renderAssortmentList();
    initializeCuttingSettings();
});