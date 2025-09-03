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

    return {
        calculate: calculateCut
    };

})();