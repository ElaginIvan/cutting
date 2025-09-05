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
    // Элементы настроек печати
    const pdfFilenameInput = document.getElementById('settings-pdf-filename');
    const pdfShowUnplacedCheckbox = document.getElementById('settings-pdf-show-unplaced');
    const pdfGroupBarsCheckbox = document.getElementById('settings-pdf-group-bars');
    const pdfOrientationSelect = document.getElementById('settings-pdf-orientation');
    const pdfJpegQualitySlider = document.getElementById('settings-pdf-jpeg-quality');    
    const workModeCheckbox = document.getElementById('settings-work-mode');
    const jpegQualityValueSpan = document.getElementById('jpeg-quality-value');


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
            const lengthsStr = e.target.value.trim();
            const areAllNumbers = lengthsStr.split(',').every(s => {
                const num = parseInt(s.trim(), 10);
                return !isNaN(num) && num > 0; // Проверяем, что это число и оно положительное
            });

            if (lengthsStr === '') { // Если поле очищено
                DB.updateSetting('deficitCalcLength', ''); // Сохраняем пустую строку
            } else if (areAllNumbers) { // Если введены корректные числа
                DB.updateSetting('deficitCalcLength', lengthsStr);
            } else { // Если введены некорректные данные
                alert('Пожалуйста, введите список длин через запятую, например: 6000, 12000. Длины должны быть положительными числами.');
                e.target.value = DB.getSettings().deficitCalcLength; // Возвращаем старое значение
            }
        });

        strategySelect.addEventListener('change', (e) => {
            DB.updateSetting('cuttingStrategy', e.target.value);
        });
    }

    // --- Логика для настроек печати ---
    function initializePrintSettings() {
        const settings = DB.getSettings();
        pdfFilenameInput.value = settings.pdfFilename;
        pdfShowUnplacedCheckbox.checked = settings.pdfShowUnplaced;
        pdfGroupBarsCheckbox.checked = settings.pdfGroupBars;
        pdfOrientationSelect.value = settings.pdfOrientation;
        pdfJpegQualitySlider.value = settings.pdfImageQuality * 100; // Конвертируем 0.85 в 85
        jpegQualityValueSpan.textContent = settings.pdfImageQuality * 100;

        pdfFilenameInput.addEventListener('change', (e) => DB.updateSetting('pdfFilename', e.target.value));
        pdfShowUnplacedCheckbox.addEventListener('change', (e) => DB.updateSetting('pdfShowUnplaced', e.target.checked));
        pdfGroupBarsCheckbox.addEventListener('change', (e) => DB.updateSetting('pdfGroupBars', e.target.checked));
        pdfOrientationSelect.addEventListener('change', (e) => DB.updateSetting('pdfOrientation', e.target.value));

        pdfJpegQualitySlider.addEventListener('input', (e) => { // 'input' для обновления текста в реальном времени
            jpegQualityValueSpan.textContent = e.target.value;
        });

        pdfJpegQualitySlider.addEventListener('change', (e) => { // 'change' для сохранения после отпускания мыши
            const quality = parseInt(e.target.value, 10) / 100;
            DB.updateSetting('pdfImageQuality', quality);
        });
    }

    // --- Логика для режима работы ---
    function initializeWorkModeSettings() {
        const settings = DB.getSettings();
        workModeCheckbox.checked = settings.workMode === 'simple';

        workModeCheckbox.addEventListener('change', (e) => {
            const newMode = e.target.checked ? 'simple' : 'warehouse';
            DB.updateSetting('workMode', newMode);
            window.dispatchEvent(new CustomEvent('workModeChanged', { detail: { mode: newMode } }));
        });
    }

    // --- Логика для UI аккордеона ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', function () {
            const content = this.nextElementSibling;
            this.classList.toggle('active');

            // Если это аккордеон с инструкцией и он еще не загружен
            if (content.id === 'instructions-content' && !content.dataset.loaded) {
                fetch('instructions.html')
                    .then(response => response.ok ? response.text() : Promise.reject('Failed to load'))
                    .then(html => {
                        content.innerHTML = html;
                        content.dataset.loaded = 'true';
                        // После загрузки контента, если аккордеон активен, устанавливаем высоту
                        if (this.classList.contains('active')) {
                            content.style.maxHeight = 'max-content'; // Задаем заведомо большую высоту
                        }
                    })
                    .catch(() => {
                        content.innerHTML = '<p class="text-muted" style="padding: 1rem;">Не удалось загрузить инструкцию.</p>';
                    });
                // Устанавливаем высоту сразу, чтобы анимация сработала
                content.style.maxHeight = this.classList.contains('active') ? '5000px' : null;
            } else {
                // Для остальных аккордеонов и для уже загруженной инструкции
                content.style.maxHeight = this.classList.contains('active') ? content.scrollHeight + "px" : null;
            }
        });
    });

    // --- Инициализация при загрузке страницы ---
    renderAssortmentList();
    initializeCuttingSettings();
    initializePrintSettings();
    initializeWorkModeSettings();
});