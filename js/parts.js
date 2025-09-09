document.addEventListener('DOMContentLoaded', () => {
    // --- Элементы DOM ---
    const formTemplateContainer = document.getElementById('form-templates');
    const form = document.getElementById('add-part-form');
    const categorySelect = document.getElementById('part-material-category');
    const assortmentFields = form.querySelector('.assortment-fields');
    const typeSelect = document.getElementById('part-material-type');
    const lengthInput = document.getElementById('part-length');
    const quantityInput = document.getElementById('part-quantity');
    const submitButton = form.querySelector('button[type="submit"]');
    const addPartBtn = document.getElementById('add-part-btn');
    const partListContainer = document.getElementById('parts-list-container');
    const clearPartsBtn = document.getElementById('clear-parts-btn');
    const cancelButton = document.getElementById('part-cancel-edit-btn');

    let editingPartId = null; // ID заготовки, которая редактируется
    let isSimpleMode = false;

    // --- Функции для отрисовки ---
    // Заполняем список сортамент из базы getMaterials
    function populateCategories() {
        const assortment = DB.getAssortment();
        const settings = DB.getSettings();
        isSimpleMode = settings.workMode === 'simple';

        if (isSimpleMode) {
            assortmentFields.style.display = 'none';
            categorySelect.required = false;
            typeSelect.required = false;
        } else {
            assortmentFields.style.display = 'block';
            categorySelect.required = true;
            typeSelect.required = true;
            categorySelect.innerHTML = '<option value="" disabled selected>Выберите тип</option>';
            assortment.forEach(item => {
                const option = document.createElement('option');
                option.value = item.name;
                option.textContent = item.name;
                categorySelect.appendChild(option);
            });
        }
    }


    // Заполняет выпадающий список типоразмеров на основе выбранной категории
    function populateTypes(selectedCategory) {
        const materials = DB.getMaterials();
        typeSelect.innerHTML = '<option value="" disabled selected>Выберите типоразмер</option>';
        typeSelect.disabled = true;

        const assortment = DB.getAssortment();
        const selectedAssortment = assortment.find(item => item.name === selectedCategory);

        if (selectedAssortment && selectedAssortment.sizes) {
            selectedAssortment.sizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                typeSelect.appendChild(option);
            });
            typeSelect.disabled = false;
        }
    }

    /**
     * Отрисовывает список добавленных заготовок
     */
    function renderPartList() {
        let parts = DB.getParts();
        partListContainer.innerHTML = ''; // Очищаем список

        // Фильтруем заготовки в зависимости от режима работы
        const settings = DB.getSettings();
        const isSimpleMode = settings.workMode === 'simple';
        parts = parts.filter(part => {
            const isDefaultCategory = part.category === 'Основной';
            return isSimpleMode ? isDefaultCategory : !isDefaultCategory;
        });

        if (parts.length === 0) {
            partListContainer.innerHTML = '<p class="text-muted">Нет добавленных заготовок.</p>';
            // Скрываем кнопку очистки, если список пуст
            clearPartsBtn.style.display = 'none';
            return;
        }

        // 1. Группируем заготовки
        const groupedParts = parts.reduce((acc, part) => {
            const key = `${part.category}|${part.type}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(part);
            return acc;
        }, {});

        // 2. Отрисовываем группы
        for (const groupKey in groupedParts) {
            const [category, type] = groupKey.split('|');
            const group = groupedParts[groupKey];

            const groupContainer = document.createElement('div');
            // Переиспользуем стили от группировки материалов
            groupContainer.className = 'material-group';

            const header = document.createElement('div');
            header.className = 'material-group-header';
            header.textContent = isSimpleMode ? 'Заготовки' : `${category} ${type}`;

            const content = document.createElement('div');
            content.className = 'material-group-content';

            group.forEach(part => content.appendChild(createPartItem(part, isSimpleMode)));

            groupContainer.appendChild(header);
            groupContainer.appendChild(content);
            partListContainer.appendChild(groupContainer);
        }

        // Показываем кнопку очистки, если в списке есть элементы
        clearPartsBtn.style.display = 'block';
    }

    function createPartItem(part, isSimpleMode) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'list-item';
        itemDiv.dataset.id = part.id;
        itemDiv.innerHTML = `
            <div class="item-info">
                <strong>${part.length} мм</strong> x ${part.quantity} шт.
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-edit-part fa-solid fa-pen"></button>
                <button class="btn-icon btn-delete-part fa-solid fa-xmark"></button>
            </div>
        `;
        return itemDiv;
    }

    /**
     * Сбрасывает форму в начальное состояние и выходит из режима редактирования.
     */
    function resetFormState() {
        form.reset();
        typeSelect.innerHTML = '<option value="" disabled selected>Выберите типоразмер</option>';
        typeSelect.disabled = true;
        editingPartId = null;
        submitButton.textContent = 'Добавить'; // eslint-disable-line
        FormModal.hide(); // eslint-disable-line
    }

    // --- Обработчики событий ---

    categorySelect.addEventListener('change', (e) => {
        populateTypes(e.target.value);
    });

    addPartBtn.addEventListener('click', () => {
        editingPartId = null;
        form.reset();
        submitButton.textContent = 'Добавить';
        FormModal.show({ title: 'Добавить заготовку', formId: 'add-part-form' }); // eslint-disable-line
    });

    cancelButton.addEventListener('click', resetFormState);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        let partData = {
            length: parseInt(lengthInput.value, 10),
            quantity: parseInt(quantityInput.value, 10)
        };

        if (isSimpleMode) {
            partData.category = 'Основной';
            partData.type = 'Материал';
        } else {
            partData.category = categorySelect.value;
            partData.type = typeSelect.value;
        }

        if (editingPartId) {
            // Режим редактирования: обновляем существующую заготовку
            DB.updatePart(editingPartId, partData);
        } else {
            // Режим добавления: создаем новую заготовку
            DB.addPart(partData);
        }

        resetFormState();
        renderPartList();
    });

    clearPartsBtn.addEventListener('click', () => {
        const settings = DB.getSettings();
        const parts = DB.getParts();
        const isSimpleMode = settings.workMode === 'simple';
        const filteredParts = parts.filter(part => {
            const isDefaultCategory = part.category === 'Основной';
            return isSimpleMode ? isDefaultCategory : !isDefaultCategory;
        });

        if (filteredParts.length === 0) return; // Не делать ничего, если список уже пуст

        const modeText = isSimpleMode ? "простого режима" : "складского режима";
        ConfirmationModal.show({
            title: 'Очистить список?',
            message: `Вы уверены, что хотите очистить все заготовки для ${modeText}?`,
            onConfirm: () => {
                DB.clearPartsByMode(settings.workMode);
                renderPartList();
            }
        });
    });

    // Обработчик для удаления заготовки
    if (partListContainer) {
        partListContainer.addEventListener('click', (e) => {
            const itemDiv = e.target.closest('.list-item');
            if (!itemDiv) return;

            if (e.target.classList.contains('btn-delete-part')) {
                const partId = itemDiv.dataset.id;
                ConfirmationModal.show({
                    title: 'Удалить заготовку?',
                    message: 'Вы уверены, что хотите удалить эту заготовку из списка?',
                    onConfirm: () => {
                        DB.deletePart(partId);
                        renderPartList();
                    }
                });
            }

            // Обработка нажатия на кнопку "Редактировать"
            if (e.target.classList.contains('btn-edit-part')) {
                const partId = itemDiv.dataset.id;
                const partToEdit = DB.getParts().find(p => p.id === partId);

                if (partToEdit) {
                    // Заполняем форму данными заготовки
                    categorySelect.value = partToEdit.category;
                    populateTypes(partToEdit.category); // Обновляем список типоразмеров
                    typeSelect.value = partToEdit.type;
                    lengthInput.value = partToEdit.length;
                    quantityInput.value = partToEdit.quantity;

                    // Переключаем форму в режим редактирования
                    editingPartId = partId;
                    submitButton.textContent = 'Сохранить';
                    FormModal.show({ title: 'Редактировать заготовку', formId: 'add-part-form' }); // eslint-disable-line
                }
            }
        });

        // Обработчик для аккордеона
        partListContainer.addEventListener('click', (e) => {
            const header = e.target.closest('.material-group-header');
            if (header) {
                header.classList.toggle('active');
                header.nextElementSibling.style.display = header.classList.contains('active') ? 'block' : 'none';
            }
        });
    }


    // Инициализация
    populateCategories();
    renderPartList();
    // Слушаем события для обновления UI
    window.addEventListener('assortmentUpdated', populateCategories);
    window.addEventListener('dataUpdated', renderPartList);
    window.addEventListener('workModeChanged', () => {
        // При смене режима полностью переинициализируем вкладку
        populateCategories();
        renderPartList();
    });
});