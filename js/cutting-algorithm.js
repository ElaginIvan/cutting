const CuttingTools = (() => {

    /**
     * Улучшенный алгоритм раскроя "Best Fit Decreasing" (Наилучший подходящий по убыванию).
     * Он стремится минимизировать количество используемых хлыстов, размещая каждую деталь
     * в тот хлыст, где она оставляет наименьший остаток.
     * @param {Array<Object>} stock - Массив доступных хлыстов, например [{ length: 6000, id: 'mat1' }]
     * @param {Array<Object>} parts - Массив заготовок для раскроя, например [{ length: 1500, id: 'part1' }]
     * @param {number} kerf - Ширина реза в мм.
     * @returns {Object} - Объект с результатом: { cutPlan: Array, unplacedParts: Array }
     */
    function calculateCut(stock, parts, kerf, strategy = 'minimal-waste') {
        // 1. Сортируем заготовки по убыванию длины. Это часть "Decreasing".
        parts.sort((a, b) => b.length - a.length);

        const cutPlan = [];
        const unplacedParts = [];
        const stockPool = [...stock]; // Копия доступных хлыстов, которую можно изменять.

        // 2. Проходим по каждой заготовке.
        for (const part of parts) {
            const requiredLength = part.length + kerf;
            let bestFitIndex = -1;
            let minRemnantLeft = Infinity;

            // 3. Ищем "наилучший" хлыст среди уже начатых (в cutPlan).
            // "Наилучший" — тот, в котором после реза останется самый маленький остаток.
            for (let i = 0; i < cutPlan.length; i++) {
                const bar = cutPlan[i];
                if (bar.remnant >= requiredLength) {
                    const remnantLeft = bar.remnant - requiredLength;
                    if (remnantLeft < minRemnantLeft) {
                        minRemnantLeft = remnantLeft;
                        bestFitIndex = i;
                    }
                }
            }

            // 4. Если подходящий хлыст среди начатых найден, размещаем деталь там.
            if (bestFitIndex > -1) {
                const targetBar = cutPlan[bestFitIndex];
                targetBar.cuts.push(part);
                targetBar.remnant -= requiredLength;
            }
            // 5. Если среди начатых хлыстов места нет, берем новый со склада.
            else {
                if (stockPool.length > 0) {
                    let bestStockIndex = -1;

                    if (strategy === 'remnants-first') {
                        // Стратегия "Сначала остатки": ищем самый короткий подходящий хлыст.
                        let minStockLength = Infinity;
                        for (let i = 0; i < stockPool.length; i++) {
                            const stockBar = stockPool[i];
                            if (stockBar.length >= requiredLength && stockBar.length < minStockLength) {
                                minStockLength = stockBar.length;
                                bestStockIndex = i;
                            }
                        }
                    } else {
                        // Стратегия "Минимальный отход" (по умолчанию): ищем хлыст, который оставит наименьший отход.
                        let minWaste = Infinity;
                        for (let i = 0; i < stockPool.length; i++) {
                            const stockBar = stockPool[i];
                            if (stockBar.length >= requiredLength) {
                                const waste = stockBar.length - requiredLength;
                                if (waste < minWaste) {
                                    minWaste = waste;
                                    bestStockIndex = i;
                                }
                            }
                        }
                    }

                    if (bestStockIndex > -1) {
                        // Забираем подходящий хлыст со склада
                        const newStockBar = stockPool.splice(bestStockIndex, 1)[0];

                        // Создаем для него новый план раскроя
                        const newBarPlan = {
                            barId: `bar_${cutPlan.length}`, // Уникальный ID в рамках этого раскроя
                            sourceId: newStockBar.id,
                            isRemnantSource: !!newStockBar.isRemnant,
                            originalLength: newStockBar.length,
                            cuts: [part],
                            remnant: newStockBar.length - requiredLength
                        };
                        cutPlan.push(newBarPlan);
                    } else {
                        // Деталь слишком большая для любого из оставшихся на складе хлыстов
                        unplacedParts.push(part);
                    }
                } else {
                    // На складе больше нет хлыстов
                    unplacedParts.push(part);
                }
            }
        }

        return { cutPlan, unplacedParts };
    }

    /**
     * Рассчитывает статистику для заданного плана раскроя.
     * @param {Array<Object>} cutPlan - План раскроя, результат функции calculate.
     * @param {number} kerf - Ширина реза.
     * @param {number} minRemnantSize - Минимальный размер полезного остатка.
     * @returns {Object} - Объект со статистикой.
     */
    function calculateStats(cutPlan, kerf, minRemnantSize) {
        const stats = {
            totalMaterialLength: 0,
            totalPartsLength: 0,
            totalUsefulRemnantsLength: 0,
            totalKerfLength: 0,
            totalWasteLength: 0,
            kpi: 0,
            partsPercent: 0,
            remnantsPercent: 0,
            wastePercent: 0,
            barsUsed: cutPlan.length
        };

        if (!cutPlan || cutPlan.length === 0) {
            return stats;
        }

        cutPlan.forEach(bar => {
            const partsLengthInBar = bar.cuts.reduce((sum, cut) => sum + cut.length, 0);
            const kerfLengthInBar = bar.cuts.length * kerf;
            let usefulRemnant = 0;
            let wasteRemnant = 0;

            if (bar.remnant >= minRemnantSize) {
                usefulRemnant = bar.remnant;
            } else if (bar.remnant > 0) {
                wasteRemnant = bar.remnant;
            }

            stats.totalMaterialLength += bar.originalLength;
            stats.totalPartsLength += partsLengthInBar;
            stats.totalKerfLength += kerfLengthInBar;
            stats.totalUsefulRemnantsLength += usefulRemnant;
            stats.totalWasteLength += wasteRemnant;
        });

        stats.totalWasteLength += stats.totalKerfLength;

        if (stats.totalMaterialLength > 0) {
            stats.partsPercent = (stats.totalPartsLength / stats.totalMaterialLength) * 100;
            stats.remnantsPercent = (stats.totalUsefulRemnantsLength / stats.totalMaterialLength) * 100;
            stats.wastePercent = (stats.totalWasteLength / stats.totalMaterialLength) * 100;
            stats.kpi = stats.partsPercent;
        }

        return stats;
    }

    function analyzeAndFindBestStock(parts, stockLengths, kerf, minRemnantSize) {
        let bestResult = { kpi: -1, waste: Infinity, barsUsed: Infinity, plan: null, stockLength: 0, stats: null };

        stockLengths.forEach(length => {
            // Создаем "виртуальный" склад для этой длины
            const virtualStock = [];
            // Создаем заведомо большое количество хлыстов
            for (let i = 0; i < parts.length; i++) {
                virtualStock.push({ length: length, id: `virtual_${length}_${i}` });
            }

            const result = calculateCut(virtualStock, [...parts], kerf);

            // Если не все детали поместились, этот вариант не подходит
            if (result.unplacedParts.length > 0) return;

            const stats = calculateStats(result.cutPlan, kerf, minRemnantSize);

            // Критерии выбора лучшего варианта (в порядке приоритета):
            // 1. Наибольший КИМ.
            // 2. При равном КИМ - наименьшие отходы.
            // 3. При равных КИМ и отходах - наименьшее количество использованных хлыстов.
            const isBetterKpi = stats.kpi > bestResult.kpi;
            const isEqualKpiAndBetterWaste = stats.kpi === bestResult.kpi && stats.totalWasteLength < bestResult.waste;
            const isEqualKpiAndWasteAndBetterBarCount = stats.kpi.toFixed(4) === bestResult.kpi.toFixed(4) && stats.totalWasteLength === bestResult.waste && stats.barsUsed < bestResult.barsUsed;

            if (isBetterKpi || isEqualKpiAndBetterWaste || isEqualKpiAndWasteAndBetterBarCount) {
                bestResult = { kpi: stats.kpi, waste: stats.totalWasteLength, barsUsed: stats.barsUsed, plan: result, stockLength: length, stats: stats };
            }
        });

        return bestResult.plan;
    }

    return {
        calculate: calculateCut,
        calculateStats: calculateStats,
        analyzeAndFindBestStock: analyzeAndFindBestStock
    };

})();