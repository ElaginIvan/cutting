document.addEventListener('DOMContentLoaded', () => {
    // --- Элементы DOM ---
    const form = document.getElementById('add-material-form');
    const categorySelect = document.getElementById('material-category');
    const typeSelect = document.getElementById('material-type');
    const lengthInput = document.getElementById('material-length');
    const quantityInput = document.getElementById('material-quantity');
    const remnantCheckbox = document.getElementById('material-is-remnant');
    const submitButton = form.querySelector('button[type="submit"]');
    const materialListContainer = document.getElementById('material-list-container');
    const cancelButton = document.getElementById('material-cancel-edit-btn');

    let currentAssortment = [];
    let editingMaterialId = null; // ID материала, который редактируется

    // --- Функции для отрисовки ---

    /**
     * Заполняет выпадающий список категорий (типов материала)
     */
    function populateCategories() {
        currentAssortment = DB.getAssortment();
        categorySelect.innerHTML = '<option value="" disabled selected>Выберите тип</option>';

        currentAssortment.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            option.textContent = item.name;
            categorySelect.appendChild(option);
        });
    }

    /**
     * Заполняет выпадающий список типоразмеров на основе выбранной категории
     */
    function populateTypes(categoryName) {
        const selectedCategory = currentAssortment.find(item => item.name === categoryName);
        typeSelect.innerHTML = '<option value="" disabled selected>Выберите типоразмер</option>';
        typeSelect.disabled = true;

        if (selectedCategory && selectedCategory.sizes) {
            selectedCategory.sizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                typeSelect.appendChild(option);
            });
            typeSelect.disabled = false;
        }
    }

    /**
     * Отрисовывает список добавленных материалов
     */
    function renderMaterialList() {
        const materials = DB.getMaterials();
        materialListContainer.innerHTML = ''; // Очищаем список

        if (materials.length === 0) {
            materialListContainer.innerHTML = '<p class="text-muted">Нет добавленных материалов.</p>';
            return;
        }

        materials.forEach(material => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'list-item';
            if (material.isRemnant) {
                itemDiv.classList.add('remnant');
            }
            itemDiv.dataset.id = material.id;
            itemDiv.innerHTML = `
                <div class="item-info">
                    ${material.category} ${material.type}<br>
                    ${material.length} мм x ${material.quantity} шт.
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-edit-material fa-solid fa-pen"></button>
                    <button class="btn-icon btn-delete-material fa-solid fa-xmark"></button>
                </div>
            `;
            materialListContainer.appendChild(itemDiv);
        });
    }

    /**
     * Сбрасывает форму в начальное состояние и выходит из режима редактирования.
     */
    function resetFormState() {
        form.reset();
        typeSelect.innerHTML = '<option value="" disabled selected>Выберите тип</option>';
        typeSelect.disabled = true;
        editingMaterialId = null;
        remnantCheckbox.checked = false;
        submitButton.textContent = 'Добавить на склад';
        cancelButton.style.display = 'none';
        categorySelect.focus();
    }

    // --- Обработчики событий ---

    categorySelect.addEventListener('change', (e) => {
        populateTypes(e.target.value);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const materialData = {
            category: categorySelect.value,
            type: typeSelect.value,
            length: parseInt(lengthInput.value, 10),
            quantity: parseInt(quantityInput.value, 10),
            isRemnant: remnantCheckbox.checked
        };

        if (editingMaterialId) {
            // Режим редактирования: обновляем существующий материал
            DB.updateMaterial(editingMaterialId, materialData);
        } else {
            // Режим добавления: создаем новый материал
            DB.addMaterial(materialData);
        }

        resetFormState();
        renderMaterialList();

        // Отправляем событие, чтобы другие части приложения обновили свои списки
        window.dispatchEvent(new CustomEvent('assortmentUpdated'));
    });

    // Обработчик для кнопки "Отмена"
    cancelButton.addEventListener('click', resetFormState);

    // Обработчик для удаления материала
    if (materialListContainer) {
        materialListContainer.addEventListener('click', (e) => {
            const itemDiv = e.target.closest('.list-item');
            if (!itemDiv) return;

            const materialId = itemDiv.dataset.id;

            // Обработка нажатия на кнопку "Удалить"
            if (e.target.classList.contains('btn-delete-material')) {
                ConfirmationModal.show({
                    title: 'Удалить материал?',
                    message: 'Вы уверены, что хотите удалить этот материал со склада?',
                    onConfirm: () => {
                        DB.deleteMaterial(materialId);
                        renderMaterialList();
                    }
                });
            }

            // Обработка нажатия на кнопку "Редактировать"
            if (e.target.classList.contains('btn-edit-material')) {
                const materialToEdit = DB.getMaterials().find(m => m.id === materialId);

                if (materialToEdit) {
                    // Заполняем форму данными материала
                    categorySelect.value = materialToEdit.category;
                    populateTypes(materialToEdit.category); // Обновляем список типоразмеров
                    typeSelect.value = materialToEdit.type;
                    lengthInput.value = materialToEdit.length;
                    quantityInput.value = materialToEdit.quantity;
                    remnantCheckbox.checked = materialToEdit.isRemnant;

                    // Переключаем форму в режим редактирования
                    editingMaterialId = materialId;
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
    renderMaterialList();
    // Слушаем событие, чтобы обновлять категории после изменений в настройках
    window.addEventListener('assortmentUpdated', populateCategories);
    // Слушаем событие, чтобы обновлять список после списания материалов
    window.addEventListener('dataUpdated', renderMaterialList);
});