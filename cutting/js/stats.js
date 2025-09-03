document.addEventListener('DOMContentLoaded', () => {
    const statsContainer = document.getElementById('stats-container');
    const statsTab = document.querySelector('.nav-item[data-tab="stats"]');

    function calculateAndRenderStats() {
        const proposedResult = DB.getProposedCuttingResult();
        const lastResult = DB.getLastCuttingResult();
        const settings = DB.getSettings();
        const minRemnantSize = settings.minRemnantSize || 0;

        let resultToDisplay = null;
        let titleSuffix = '';

        if (proposedResult && Object.keys(proposedResult).length > 0) {
            resultToDisplay = proposedResult;
            titleSuffix = ' (предварительный расчет)';
        } else if (lastResult && Object.keys(lastResult).length > 0) {
            resultToDisplay = lastResult;
            titleSuffix = ' (по последнему списанию)';
        }

        if (!resultToDisplay) {
            statsContainer.innerHTML = '<p class="text-muted">Нет данных для статистики. Выполните раскрой.</p>';
            return;
        }

        const statsByMaterial = {};
        let overallStats = {
            totalMaterialLength: 0,
            totalPartsLength: 0,
            totalUsefulRemnantsLength: 0,
            totalKerfLength: 0,
            totalWasteLength: 0,
        };

        for (const groupKey in resultToDisplay) {
            const plan = resultToDisplay[groupKey];
            if (!plan.cutPlan) continue;

            // Initialize stats for this material type if not present
            if (!statsByMaterial[groupKey]) {
                statsByMaterial[groupKey] = {
                    materialLength: 0,
                    partsLength: 0,
                    usefulRemnantsLength: 0,
                    kerfLength: 0,
                    wasteLength: 0,
                };
            }

            plan.cutPlan.forEach(bar => {
                const partsLengthInBar = bar.cuts.reduce((sum, cut) => sum + cut.length, 0);
                const kerfLengthInBar = bar.cuts.length * plan.kerf;
                let usefulRemnant = 0;
                let wasteRemnant = 0;

                 if (bar.remnant >= minRemnantSize) {
                    usefulRemnant = bar.remnant;
                } else if (bar.remnant > 0) {
                    wasteRemnant = bar.remnant;
                }

                // Aggregate for this material type
                const materialStat = statsByMaterial[groupKey];
                materialStat.materialLength += bar.originalLength;
                materialStat.partsLength += partsLengthInBar;
                materialStat.kerfLength += kerfLengthInBar;
                materialStat.usefulRemnantsLength += usefulRemnant;
                materialStat.wasteLength += wasteRemnant;

                // Aggregate for overall stats
                overallStats.totalMaterialLength += bar.originalLength;
                overallStats.totalPartsLength += partsLengthInBar;
                overallStats.totalKerfLength += kerfLengthInBar;
                overallStats.totalUsefulRemnantsLength += usefulRemnant;
                overallStats.totalWasteLength += wasteRemnant;
            });
        }
        
        // Finalize waste calculation (add kerf length)
        overallStats.totalWasteLength += overallStats.totalKerfLength;
        for (const key in statsByMaterial) {
            statsByMaterial[key].wasteLength += statsByMaterial[key].kerfLength;
        }

        if (overallStats.totalMaterialLength === 0) {
            statsContainer.innerHTML = '<p class="text-muted">В последнем раскрое не было использовано материалов.</p>';
            return;
        }

        // Calculate percentages for overall stats
        overallStats.partsPercent = (overallStats.totalPartsLength / overallStats.totalMaterialLength) * 100;
        overallStats.remnantsPercent = (overallStats.totalUsefulRemnantsLength / overallStats.totalMaterialLength) * 100;
        overallStats.wastePercent = (overallStats.totalWasteLength / overallStats.totalMaterialLength) * 100;
        overallStats.kpi = overallStats.partsPercent;

        // Calculate percentages for each material
        for (const key in statsByMaterial) {
            const stat = statsByMaterial[key];
            if (stat.materialLength > 0) {
                stat.partsPercent = (stat.partsLength / stat.materialLength) * 100;
                stat.remnantsPercent = (stat.usefulRemnantsLength / stat.materialLength) * 100;
                stat.wastePercent = (stat.wasteLength / stat.materialLength) * 100;
                stat.kpi = stat.partsPercent;
            } else {
                stat.partsPercent = 0;
                stat.remnantsPercent = 0;
                stat.wastePercent = 0;
                stat.kpi = 0;
            }
        }

        // Рассчитываем дефицит материала для неразмещенных деталей
        const deficitStats = {};
        for (const groupKey in resultToDisplay) {
            const plan = resultToDisplay[groupKey];

            // Определяем длину для расчета: либо из плана, либо из глобальных настроек
            const lengthForDeficit = plan.standardStockLength > 0 ? plan.standardStockLength : settings.deficitCalcLength;

            if (plan.unplacedParts && plan.unplacedParts.length > 0 && lengthForDeficit > 0) {
                // Создаем виртуальный склад стандартных хлыстов
                const virtualStock = Array(plan.unplacedParts.length).fill({
                    length: lengthForDeficit,
                    id: 'virtual_stock',
                    isRemnant: false
                });

                // Рассчитываем, сколько хлыстов нужно для неразмещенных деталей
                const deficitPlan = CuttingTools.calculate(virtualStock, [...plan.unplacedParts], plan.kerf);

                if (deficitPlan.cutPlan.length > 0) {
                    const [category, type] = groupKey.split('|');
                    deficitStats[groupKey] = {
                        category,
                        type,
                        barsNeeded: deficitPlan.cutPlan.length,
                        standardLength: lengthForDeficit,
                    };
                }
            }
        }

        renderPage(overallStats, statsByMaterial, deficitStats, titleSuffix);
    }

    function renderPage(overallData, materialData, deficitData, titleSuffix) {
        let html = `
            <div class="stat-card">
                <h4>Общая эффективность${titleSuffix}</h4>
                <div class="stat-summary">
                    <span class="label">Коэф. исп. материала (КИМ):</span>
                    <span class="value">${overallData.kpi.toFixed(2)}%</span>
                </div>
                <div class="efficiency-bar-container" title="Структура использования материала">
                    <div class="efficiency-bar-segment bar-parts" style="width: ${overallData.partsPercent.toFixed(2)}%;" title="Детали: ${overallData.partsPercent.toFixed(2)}%"><span>Детали</span></div>
                    <div class="efficiency-bar-segment bar-remnants" style="width: ${overallData.remnantsPercent.toFixed(2)}%;" title="Полезный остаток: ${overallData.remnantsPercent.toFixed(2)}%"><span>Остатки</span></div>
                    <div class="efficiency-bar-segment bar-waste" style="width: ${overallData.wastePercent.toFixed(2)}%;" title="Отходы: ${overallData.wastePercent.toFixed(2)}%"><span>Отходы</span></div>
                </div>
            </div>
            <div class="stat-card">
                <h4>Детализация</h4>
                <div class="stat-details">
                    <p><span class="label">Всего использовано материала:</span> <span class="value">${overallData.totalMaterialLength} мм</span></p>
                    <p><span class="label">Длина заготовок:</span> <span class="value">${overallData.totalPartsLength} мм</span></p>
                    <p><span class="label">Полезные остатки:</span> <span class="value">${overallData.totalUsefulRemnantsLength} мм</span></p>
                    <p><span class="label">Потери на рез (стружка):</span> <span class="value">${overallData.totalKerfLength} мм</span></p>
                    <p><span class="label">Общие отходы (включая рез):</span> <span class="value">${overallData.totalWasteLength} мм</span></p>
                </div>
            </div>
        `;

        // Добавляем блок статистики по материалам
        html += `
            <div class="stat-card">
                <h4>Статистика по материалам</h4>
                <div class="material-stats-list">
        `;

        if (Object.keys(materialData).length === 0) {
            html += '<p class="text-muted">Нет данных.</p>';
        } else {
            for (const groupKey in materialData) {
                const stat = materialData[groupKey];
                const [category, type] = groupKey.split('|');
                html += `
                    <div class="material-stat-item">
                        <div class="material-stat-header">
                            <strong>${category} ${type}</strong>
                            <span>КИМ: ${stat.kpi.toFixed(2)}%</span>
                        </div>
                        <div class="efficiency-bar-container small-bar" title="Структура использования для ${category} ${type}">
                            <div class="efficiency-bar-segment bar-parts" style="width: ${stat.partsPercent.toFixed(2)}%;" title="Детали: ${stat.partsPercent.toFixed(2)}%"></div>
                            <div class="efficiency-bar-segment bar-remnants" style="width: ${stat.remnantsPercent.toFixed(2)}%;" title="Полезный остаток: ${stat.remnantsPercent.toFixed(2)}%"></div>
                            <div class="efficiency-bar-segment bar-waste" style="width: ${stat.wastePercent.toFixed(2)}%;" title="Отходы: ${stat.wastePercent.toFixed(2)}%"></div>
                        </div>
                    </div>
                `;
            }
        }

        html += `
                </div>
            </div>
        `;

        // Добавляем блок дефицита, если он есть
        if (Object.keys(deficitData).length > 0) {
            html += `
                <div class="stat-card deficit-card">
                    <h4>Дефицит материала</h4>
                    <div class="deficit-list">
            `;

            for (const groupKey in deficitData) {
                const deficit = deficitData[groupKey];
                html += `
                    <div class="deficit-item">
                        <p><strong>${deficit.category} ${deficit.type}</strong></p>
                        <p>Необходимо: <strong>${deficit.barsNeeded} шт.</strong> по ${deficit.standardLength} мм</p>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        }

        statsContainer.innerHTML = html;
    }

    statsTab.addEventListener('click', calculateAndRenderStats);
    window.addEventListener('statsUpdated', calculateAndRenderStats);
    window.addEventListener('dataUpdated', calculateAndRenderStats);

    if (statsTab.classList.contains('active')) calculateAndRenderStats();
});