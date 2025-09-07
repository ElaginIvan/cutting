document.addEventListener('DOMContentLoaded', () => {
    // --- Элементы DOM ---
    const form = document.getElementById('add-part-form');
    const categorySelect = document.getElementById('part-material-category');
    const assortmentFields = form.querySelector('.assortment-fields');
    const typeSelect = document.getElementById('part-material-type');
    const lengthInput = document.getElementById('part-length');
    const quantityInput = document.getElementById('part-quantity');
    const submitButton = form.querySelector('button[type="submit"]');
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

        parts.forEach(part => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'list-item';
            const infoText = !isSimpleMode
                ? `${part.category} ${part.type}<br>`
                : '';

            itemDiv.dataset.id = part.id;
            itemDiv.innerHTML = `
                <div class="item-info">
                    ${infoText}
                    ${part.length} мм x ${part.quantity} шт.
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-edit-part fa-solid fa-pen"></button>
                    <button class="btn-icon btn-delete-part fa-solid fa-xmark"></button>
                </div>
            `;
            partListContainer.appendChild(itemDiv);
        });

        // Показываем кнопку очистки, если в списке есть элементы
        clearPartsBtn.style.display = 'block';
    }

    /**
     * Сбрасывает форму в начальное состояние и выходит из режима редактирования.
     */
    function resetFormState() {
        form.reset();
        typeSelect.innerHTML = '<option value="" disabled selected>Выберите типоразмер</option>';
        typeSelect.disabled = true;
        editingPartId = null;
        submitButton.textContent = 'Добавить заготовку';
        cancelButton.style.display = 'none';
        categorySelect.focus();
    }

    // --- Обработчики событий ---

    categorySelect.addEventListener('change', (e) => {
        populateTypes(e.target.value);
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
                    cancelButton.style.display = 'inline-block';

                    // Плавно прокручиваем контейнер вверх к форме,
                    // чтобы избежать "подпрыгивания" всей страницы.
                    const contentSection = form.closest('.content-section');
                    if (contentSection) {
                        contentSection.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
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