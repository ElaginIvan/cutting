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
        let allCutPlans = [];

        for (const groupKey in resultToDisplay) {
            const plan = resultToDisplay[groupKey];
            if (!plan.cutPlan) continue;

            // Рассчитываем статистику для каждой группы материалов
            statsByMaterial[groupKey] = CuttingTools.calculateStats(plan.cutPlan, plan.kerf, minRemnantSize);
            // Собираем все планы для расчета общей статистики
            allCutPlans = allCutPlans.concat(plan.cutPlan);
        }
        
        // Рассчитываем общую статистику по всем материалам
        // Для этого нужно знать общий kerf, возьмем из первого плана
        const overallKerf = resultToDisplay[Object.keys(resultToDisplay)[0]]?.kerf || 0;
        const overallStats = CuttingTools.calculateStats(allCutPlans, overallKerf, minRemnantSize);

        if (overallStats.totalMaterialLength === 0) {
            statsContainer.innerHTML = '<p class="text-muted">В последнем раскрое не было использовано материалов.</p>';
            return;
        }

        // Рассчитываем дефицит материала для неразмещенных деталей
        const deficitStats = {};
        for (const groupKey in resultToDisplay) {
            const plan = resultToDisplay[groupKey];
            const deficitLengths = String(settings.deficitCalcLength).split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);

            if (plan.unplacedParts && plan.unplacedParts.length > 0 && deficitLengths.length > 0) {
                // Используем новую общую функцию для расчета
                const deficitResult = CuttingRenderer.calculateDeficit(plan.unplacedParts, deficitLengths, plan.kerf);

                if (Object.keys(deficitResult).length > 0) {
                    const [category, type] = groupKey.split('|');
                    deficitStats[groupKey] = {
                        category,
                        type,
                        needed: deficitResult // e.g. {6000: 2, 12000: 1}
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
                    <div class="efficiency-bar-segment bar-waste" style="width: ${overallData.wastePercent.toFixed(2)}%;" title="Отходы (вкл. рез): ${overallData.wastePercent.toFixed(2)}%"><span>Отходы</span></div>
                </div>
            </div>
            <div class="stat-card">
                <h4>Детализация</h4>
                <div class="stat-details">
                    <p><span class="label">Всего использовано материала:</span> <span class="value">${overallData.totalMaterialLength} мм</span></p>
                    <p><span class="label">Длина заготовок:</span> <span class="value">${overallData.totalPartsLength} мм</span></p>
                    <p><span class="label">Полезные остатки:</span> <span class="value">${overallData.totalUsefulRemnantsLength} мм</span></p>
                    <p><span class="label">Потери на рез:</span> <span class="value">${overallData.totalKerfLength} мм</span></p>
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
                            <div class="efficiency-bar-segment bar-waste" style="width: ${stat.wastePercent.toFixed(2)}%;" title="Отходы (вкл. рез): ${stat.wastePercent.toFixed(2)}%"></div>
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
                        <ul>
                            ${Object.entries(deficit.needed).map(([len, count]) => `<li>Необходимо: <strong>${count} шт.</strong> по ${len} мм</li>`).join('')}
                        </ul>
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