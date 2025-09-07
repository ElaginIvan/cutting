const CuttingCalculator = (() => { // eslint-disable-line

    /**
     * Группирует материалы и заготовки по ключу "категория|тип".
     * @param {Array} materials - Массив материалов со склада.
     * @param {Array} parts - Массив заготовок.
     * @returns {Object} - Сгруппированные данные.
     */
    function groupData(materials, parts) {
        const grouped = {};
        const addToGroup = (item, type) => {
            const key = `${item.category}|${item.type}`;
            if (!grouped[key]) {
                grouped[key] = { stock: [], parts: [] };
            }
            for (let i = 0; i < item.quantity; i++) {
                const newItem = {
                    length: item.length,
                    id: item.id || `part_${i}`,
                    isRemnant: type === 'stock' ? !!item.isRemnant : false
                };
                grouped[key][type].push(newItem);
            }
        };
        materials.forEach(m => addToGroup(m, 'stock'));
        parts.forEach(p => addToGroup(p, 'parts'));
        return grouped;
    }

    /**
     * Основная функция расчета, которая инкапсулирует всю логику.
     * @param {Object} settings - Настройки приложения.
     * @param {Array} allMaterials - Все материалы из БД.
     * @param {Array} allParts - Все заготовки из БД.
     * @returns {Object} - Готовый объект activeCutPlans.
     */
    function calculate(settings, allMaterials, allParts) {
        const { workMode, kerf, minRemnantSize, cuttingStrategy: strategy } = settings;
        const activeCutPlans = {};

        if (workMode === 'simple') {
            const simpleModeParts = allParts.filter(p => p.category === 'Основной');
            const deficitLengths = String(settings.deficitCalcLength).split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);

            if (deficitLengths.length === 0) {
                throw new Error('В простом режиме необходимо указать "Длины для расчета дефицита" в настройках.');
            }
            if (simpleModeParts.length === 0) {
                return {}; // Нет заготовок для расчета
            }

            const allPartsExpanded = simpleModeParts.flatMap(p => Array(p.quantity).fill({ length: p.length, id: p.id }));
            const bestPlan = CuttingTools.analyzeAndFindBestStock(allPartsExpanded, deficitLengths, kerf, minRemnantSize); // eslint-disable-line

            if (!bestPlan || bestPlan.cutPlan.length === 0) {
                return null; // Не удалось построить план
            }

            const groupKey = 'Основной|Материал';
            activeCutPlans[groupKey] = { ...bestPlan, kerf };

        } else { // workMode === 'warehouse'
            const warehouseParts = allParts.filter(p => p.category !== 'Основной');
            if (allMaterials.length === 0 || warehouseParts.length === 0) {
                return {}; // Недостаточно данных
            }

            const groupedData = groupData(allMaterials, warehouseParts);
            for (const groupKey in groupedData) {
                const group = groupedData[groupKey];
                if (group.stock.length === 0 || group.parts.length === 0) continue;

                let finalCutPlan;

                if (strategy === 'remnants-first') {
                    // СТРАТЕГИЯ "СНАЧАЛА ОСТАТКИ"
                    const remnants = group.stock.filter(s => s.isRemnant);
                    const standardBars = group.stock.filter(s => !s.isRemnant);

                    // 1. Сначала раскраиваем на остатках
                    const remnantsPlan = CuttingTools.calculate(remnants, group.parts, kerf, 'minimal-waste'); // eslint-disable-line

                    // 2. Если остались неразмещенные детали, ищем лучший стандартный хлыст
                    if (remnantsPlan.unplacedParts.length > 0 && standardBars.length > 0) {
                        const uniqueStandardLengths = [...new Set(standardBars.map(s => s.length))];
                        const bestStandardPlan = CuttingTools.analyzeAndFindBestStock( // eslint-disable-line
                            remnantsPlan.unplacedParts,
                            uniqueStandardLengths,
                            kerf,
                            minRemnantSize
                        );

                        // 3. Объединяем результаты
                        finalCutPlan = {
                            cutPlan: [...remnantsPlan.cutPlan, ...(bestStandardPlan ? bestStandardPlan.cutPlan : [])],
                            unplacedParts: bestStandardPlan ? bestStandardPlan.unplacedParts : remnantsPlan.unplacedParts
                        };
                    } else {
                        finalCutPlan = remnantsPlan;
                    }

                } else {
                    // СТРАТЕГИЯ "МИНИМАЛЬНЫЙ ОТХОД" (упрощенная и более надежная версия)
                    const allPartsExpanded = group.parts.flatMap(p =>
                        Array(p.quantity).fill({ length: p.length, id: p.id })
                    );

                    // Просто находим лучший раскрой, используя все доступные хлысты
                    finalCutPlan = CuttingTools.calculate(group.stock, allPartsExpanded, kerf, 'minimal-waste'); // eslint-disable-line
                }

                if (finalCutPlan) {
                    activeCutPlans[groupKey] = { ...finalCutPlan, kerf };
                }
            }
        }

        // Добавляем состояние для UI (редактирование, история и т.д.) к каждому плану
        for (const key in activeCutPlans) {
            const plan = activeCutPlans[key];
            const initialState = {
                cutPlan: JSON.parse(JSON.stringify(plan.cutPlan)),
                unplacedParts: JSON.parse(JSON.stringify(plan.unplacedParts)),
                ungroupedSignatures: []
            };
            activeCutPlans[key] = {
                ...plan,
                isEditable: false,
                ungroupedSignatures: [],
                visibleDetails: new Set(),
                history: [initialState],
                historyIndex: 0
            };
        }

        return activeCutPlans;
    }

    return {
        calculate
    };
})();