document.addEventListener('DOMContentLoaded', () => {
    // --- Элементы DOM ---
    const form = document.getElementById('add-part-form');
    const categorySelect = document.getElementById('part-material-category');
    const typeSelect = document.getElementById('part-material-type');
    const lengthInput = document.getElementById('part-length');
    const quantityInput = document.getElementById('part-quantity');
    const submitButton = form.querySelector('button[type="submit"]');
    const partListContainer = document.getElementById('parts-list-container');
    const cancelButton = document.getElementById('part-cancel-edit-btn');

    let editingPartId = null; // ID заготовки, которая редактируется

    // --- Функции для отрисовки ---
    // Заполняем список сортамент из базы getMaterials
    function populateCategories() {
        const categories = DB.getMaterials();
        categorySelect.innerHTML = '<option value="" disabled selected>Выберите тип</option>';
        // Уникальные категории материла из базы getMaterials
        const uniqueCategories = [...new Set(categories.map(material => material.category))];
        uniqueCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }


    // Заполняет выпадающий список типоразмеров на основе выбранной категории
    function populateTypes(selectedCategory) {
        const materials = DB.getMaterials();
        typeSelect.innerHTML = '<option value="" disabled selected>Выберите типоразмер</option>';
        typeSelect.disabled = true;

        const filteredMaterials = materials.filter(material => material.category === selectedCategory);

        // Получаем уникальные типоразмеры для выбранной категории
        const uniqueTypes = [...new Set(filteredMaterials.map(material => material.type))];

        if (uniqueTypes.length > 0) {
            uniqueTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                typeSelect.appendChild(option);
            });
            typeSelect.disabled = false;
        }
    }

    /**
     * Отрисовывает список добавленных заготовок
     */
    function renderPartList() {
        const parts = DB.getParts();
        partListContainer.innerHTML = ''; // Очищаем список

        if (parts.length === 0) {
            partListContainer.innerHTML = '<p class="text-muted">Нет добавленных заготовок.</p>';
            return;
        }

        parts.forEach(part => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'list-item';
            itemDiv.dataset.id = part.id;
            itemDiv.innerHTML = `
                <div class="item-info">
                    ${part.category} ${part.type}<br>
                    ${part.length} мм x ${part.quantity} шт.
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-edit-part fa-solid fa-pen"></button>
                    <button class="btn-icon btn-delete-part fa-solid fa-xmark"></button>
                </div>
            `;
            partListContainer.appendChild(itemDiv);
        });
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
        const partData = {
            category: categorySelect.value,
            type: typeSelect.value,
            length: parseInt(lengthInput.value, 10),
            quantity: parseInt(quantityInput.value, 10)
        };

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

    // Обработчик для удаления заготовки
    if (partListContainer) {
        partListContainer.addEventListener('click', (e) => {
            const itemDiv = e.target.closest('.list-item');
            if (!itemDiv) return;

            if (e.target.classList.contains('btn-delete-part')) {
                const partId = itemDiv.dataset.id;
                if (confirm('Вы уверены, что хотите удалить эту заготовку?')) {
                    DB.deletePart(partId);
                    renderPartList();
                }
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
    // Слушаем событие, чтобы обновлять категории после изменений в материалах
    window.addEventListener('assortmentUpdated', populateCategories);
    // Слушаем событие, чтобы обновлять список после списания заготовок
    window.addEventListener('dataUpdated', renderPartList);
});