document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculate-cutting-btn');
    const resultsContainer = document.getElementById('cutting-results-container');
    const applyPlanBtn = document.getElementById('apply-cutting-plan-btn');
    let activeCutPlans = {}; // Хранилище состояния для всех планов раскроя
    let selectedBar = { groupKey: null, barIndex: null }; // Для отслеживания выбранного хлыста

    if (calculateBtn) {
        calculateBtn.addEventListener('click', handleCalculation);
    }
    applyPlanBtn.addEventListener('click', handleApplyPlan);

    resultsContainer.addEventListener('click', handlePlanInteraction);

    function handleCalculation() {
        const settings = DB.getSettings();
        const kerf = parseInt(settings.kerf, 10) || 0;
        const strategy = settings.cuttingStrategy || 'minimal-waste'; // Получаем стратегию
        const materials = DB.getMaterials(); // Получаем все материалы, включая остатки
        const parts = DB.getParts();

        activeCutPlans = {}; // Сбрасываем старые планы
        resultsContainer.innerHTML = ''; // Очищаем контейнер
        applyPlanBtn.style.display = 'none';

        if (materials.length === 0 || parts.length === 0) {
            resultsContainer.innerHTML = '<p class="text-muted">Недостаточно данных. Добавьте материалы на склад и заготовки для раскроя.</p>';
            return;
        }

        const groupedData = groupData(materials, parts);

        let hasResults = false;
        for (const groupKey in groupedData) {
            const group = groupedData[groupKey];
            if (group.stock.length > 0 && group.parts.length > 0) {
                // Сортируем хлысты по возрастанию длины, чтобы остатки использовались первыми
                group.stock.sort((a, b) => a.length - b.length);

                // Определяем параметры стандартного хлыста для этой группы
                const standardStock = group.stock.filter(s => !s.isRemnant);
                const standardStockLength = standardStock.length > 0 ? standardStock[0].length : 0;
                const initialStandardStockCount = standardStock.length;

                const cutPlan = CuttingTools.calculate(group.stock, group.parts, kerf, strategy);

                // Сохраняем результат в глобальное состояние
                activeCutPlans[groupKey] = {
                    ...cutPlan,
                    kerf: kerf,
                    standardStockLength: standardStockLength,
                    initialStandardStockCount: initialStandardStockCount,
                    isEditable: false, // Изначально планы не редактируемые
                    ungroupedSignatures: [] // Хранит подписи разгруппированных вручную групп
                };

                CuttingRenderer.render(groupKey, activeCutPlans, selectedBar, resultsContainer);
                hasResults = true;
            }
        }

        if (!hasResults) {
            resultsContainer.innerHTML = '<p class="text-muted">Не найдено совпадений по сортаменту между материалами и заготовками.</p>';
        } else {
            // Сохраняем предложенный план и уведомляем статистику
            DB.saveProposedCuttingResult(activeCutPlans);
            window.dispatchEvent(new CustomEvent('statsUpdated'));
            applyPlanBtn.style.display = 'block';
        }
    }

    function handleApplyPlan() {
        if (Object.keys(activeCutPlans).length === 0) {
            alert('Нет активного плана раскроя для применения.');
            return;
        }

        if (confirm('Это действие спишет использованный материал со склада и добавит полезные остатки. Продолжить?')) {
            DB.applyCuttingPlan(activeCutPlans);
            alert('Склад успешно обновлен!');
            // Сбрасываем состояние
            activeCutPlans = {};
            resultsContainer.innerHTML = '<p class="text-muted">Нажмите "Рассчитать раскрой", чтобы сгенерировать план.</p>';
            applyPlanBtn.style.display = 'none';
            window.dispatchEvent(new CustomEvent('dataUpdated')); // Обновляем списки материалов и заготовок
        }
    }

    function handlePlanInteraction(e) {
        const groupCard = e.target.closest('.cutting-plan-card');
        if (!groupCard) return;
        const groupKey = groupCard.dataset.groupKey;
        const planState = activeCutPlans[groupKey];

        // --- Обрабатываем самые конкретные клики первыми ---

        // Клик по кнопке "Редактировать"
        const editBtn = e.target.closest('.btn-ungroup');
        if (editBtn) {
            e.stopPropagation();
            planState.isEditable = true;
            CuttingRenderer.render(groupKey, activeCutPlans, selectedBar, resultsContainer);
            return;
        }

        // Клик по кнопке "Завершить и сгруппировать"
        const groupLayoutsBtn = e.target.closest('.btn-group-layouts');
        if (groupLayoutsBtn) {
            e.stopPropagation();
            planState.isEditable = false;
            planState.ungroupedSignatures = []; // Сбрасываем ручную разгруппировку
            CuttingRenderer.render(groupKey, activeCutPlans, selectedBar, resultsContainer);
            return;
        }

        // Клик по кнопке "Разгруппировать" (вручную)
        const manualUngroupBtn = e.target.closest('.btn-manual-ungroup');
        if (manualUngroupBtn) {
            e.stopPropagation();
            const signature = manualUngroupBtn.dataset.signature;
            CuttingEditor.manualUngroup(groupKey, signature, activeCutPlans, (key) => CuttingRenderer.render(key, activeCutPlans, selectedBar, resultsContainer));
            return;
        }

        // Клик по кнопке "Добавить хлыст"
        const addBarBtn = e.target.closest('.btn-add-bar');
        if (addBarBtn) {
            e.stopPropagation();
            CuttingEditor.addBar(groupKey, activeCutPlans, (key) => CuttingRenderer.render(key, activeCutPlans, selectedBar, resultsContainer));
            return;
        }

        // Клик по кнопке "Очистить"
        const clearPlanBtn = e.target.closest('.btn-clear-plan');
        if (clearPlanBtn) {
            e.stopPropagation();
            if (confirm('Вы уверены, что хотите очистить весь план раскроя для этого материала? Все детали вернутся в неразмещенные.')) {
                CuttingEditor.clearPlan(groupKey, activeCutPlans, (key) => CuttingRenderer.render(key, activeCutPlans, selectedBar, resultsContainer));
            }
            return;
        }

        // Клик по кнопке удаления хлыста
        const deleteBtn = e.target.closest('.btn-delete-bar');
        if (deleteBtn) {
            e.stopPropagation();
            const barId = deleteBtn.dataset.barId;
            CuttingEditor.deleteBar(groupKey, barId, activeCutPlans, (key) => CuttingRenderer.render(key, activeCutPlans, selectedBar, resultsContainer));
            return;
        }

        // --- Дальнейшие действия только в режиме редактирования ---
        if (!planState.isEditable) return;

        // Клик по детали на хлысте (для удаления)
        const cutPiece = e.target.closest('.cut-piece');
        if (cutPiece) {
            e.stopPropagation();
            const barId = cutPiece.dataset.barId;
            const partLength = parseInt(cutPiece.dataset.partLength, 10);
            if (barId && !isNaN(partLength)) {
                if (barId.startsWith('group_')) {
                    // Удаление детали из сгруппированного хлыста
                    const signature = barId.replace('group_', '');
                    CuttingEditor.breakGroupAndRemovePart(groupKey, signature, partLength, activeCutPlans, (key) => CuttingRenderer.render(key, activeCutPlans, selectedBar, resultsContainer));
                } else {
                    CuttingEditor.movePartToUnplaced(groupKey, barId, partLength, activeCutPlans, (key) => CuttingRenderer.render(key, activeCutPlans, selectedBar, resultsContainer));
                }
            }
            return;
        }

        // Клик по неразмещенной детали (для добавления)
        const unplacedItem = e.target.closest('.unplaced-part-item');
        if (unplacedItem) {
            e.stopPropagation();
            if (selectedBar.groupKey === groupKey && selectedBar.barIndex !== null) {
                const partLength = parseInt(unplacedItem.dataset.length, 10);
                CuttingEditor.movePartToBar(groupKey, selectedBar.barIndex, partLength, activeCutPlans, (key) => CuttingRenderer.render(key, activeCutPlans, selectedBar, resultsContainer));
            } else {
                alert('Сначала выберите хлыст, на который хотите добавить деталь.');
            }
            return;
        }

        // Клик по контейнеру хлыста (для выбора) - это самый общий случай, он должен быть последним
        const barContainer = e.target.closest('.bar-container');
        if (barContainer) {
            // Этот обработчик должен быть последним, и он останавливает событие,
            // чтобы избежать любых других действий.
            e.stopPropagation();

            if (barContainer.dataset.isGroup === 'true') {
                // Клик по сгруппированному хлысту для выбора
                const signature = barContainer.dataset.signature;
                CuttingEditor.breakGroupAndSelect(groupKey, signature, activeCutPlans, (newBarId) => {
                    selectedBar = { groupKey, barIndex: newBarId };
                    CuttingRenderer.render(groupKey, activeCutPlans, selectedBar, resultsContainer);
                });
            } else {
                const barId = barContainer.dataset.barId;
                if (selectedBar.barIndex === barId && selectedBar.groupKey === groupKey) {
                    selectedBar = { groupKey: null, barIndex: null };
                } else {
                    selectedBar = { groupKey, barIndex: barId };
                }
                CuttingRenderer.render(groupKey, activeCutPlans, selectedBar, resultsContainer);
            }
            return;
        }
    }

    function groupData(materials, parts) {
        const grouped = {};
        const addToGroup = (item, type) => {
            const key = `${item.category}|${item.type}`;
            if (!grouped[key]) {
                grouped[key] = { stock: [], parts: [] };
            }
            for (let i = 0; i < item.quantity; i++) {
                const newItem = { length: item.length, id: item.id || `part_${i}` };
                if (type === 'stock') {
                    newItem.isRemnant = !!item.isRemnant;
                }
                grouped[key][type].push(newItem);
            }
        };
        materials.forEach(m => addToGroup(m, 'stock'));
        parts.forEach(p => addToGroup(p, 'parts'));
        return grouped;
    }
});