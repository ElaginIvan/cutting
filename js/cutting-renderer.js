const CuttingRenderer = (() => {

    function renderBarVisualization(bar, kerf, barId = null) {
        let vizHTML = '<div class="stock-bar-visualization">';
        // Используем оригинальный порядок деталей, так как он уже отсортирован алгоритмом
        const cuts = [...bar.cuts];

        // Группируем последовательные одинаковые детали
        const groupedCuts = [];
        if (cuts.length > 0) {
            // Начинаем первую группу
            let currentGroup = { length: cuts[0].length, count: 1 };
            for (let i = 1; i < cuts.length; i++) {
                if (cuts[i].length === currentGroup.length) {
                    currentGroup.count++; // Если деталь такая же, увеличиваем счетчик в группе
                } else {
                    groupedCuts.push(currentGroup); // Завершаем текущую группу
                    currentGroup = { length: cuts[i].length, count: 1 }; // Начинаем новую
                }
            }
            groupedCuts.push(currentGroup); // Добавляем последнюю группу
        }

        groupedCuts.forEach((group, groupIndex) => {
            const groupTotalLength = group.length * group.count;
            const kerfsInGroup = (group.count - 1) * kerf;
            const totalBlockLength = groupTotalLength + kerfsInGroup;
            const groupWidth = (totalBlockLength / bar.originalLength) * 100;

            const label = group.count > 1 ? `${group.length}x${group.count}` : `${group.length}`;
            const title = group.count > 1
                ? `Группа: ${group.count} шт. по ${group.length} мм (блок ${totalBlockLength}мм). Нажмите для удаления.`
                : `Деталь: ${group.length} мм. Нажмите для удаления.`;
            const groupClass = group.count > 1 ? 'grouped' : '';

            // В режиме редактирования добавляем data-атрибуты для идентификации группы
            const dataAttrs = barId
                ? `data-bar-id="${barId}" data-part-length="${group.length}" data-part-count="${group.count}"`
                : '';

            vizHTML += `<div class="cut-piece ${groupClass}" style="width: ${groupWidth}%" title="${title}" ${dataAttrs}>${label}</div>`;
        });

        if (bar.remnant > 0) {
            vizHTML += `<div class="remnant-piece" style="width: ${(bar.remnant / bar.originalLength) * 100}%" title="Остаток: ${bar.remnant} мм">${bar.remnant > 200 ? bar.remnant : ''}</div>`;
        }
        vizHTML += '</div>';
        return vizHTML;
    }

    function renderGroupedBar(group, groupKey, planState, selectedItem) {
        const { bar, count } = { bar: group.bars[0], count: group.count };
        const { kerf, isEditable, visibleDetails } = planState;
        let html = '';

        const isDetailsVisible = visibleDetails.has(group.signature);
        const isSelected = selectedItem.groupKey === groupKey && selectedItem.signature === group.signature;
        const selectedClass = isSelected ? 'selected-for-add' : '';
        const barIdForViz = `group_${group.signature}`;
        const containerDataAttrs = `data-is-group="true" data-signature="${group.signature}"`;

        let groupActionsHTML = '';
        if (isEditable && count > 1) {
            groupActionsHTML += `<button class="btn-icon-action btn-manual-ungroup" data-signature="${group.signature}" title="Разгруппировать"><i class="fa-solid fa-object-ungroup"></i></button>`;
        }
        if (isEditable) {
            groupActionsHTML += `<button class="btn-icon-action danger btn-delete-group" data-signature="${group.signature}" title="Удалить группу"><i class="fa-solid fa-trash-can"></i></button>`;
        }
        // Кнопка спецификации видна всегда, если есть что показывать
        if (bar.cuts.length > 0) {
            groupActionsHTML += `<button class="btn-icon-action btn-toggle-details" data-signature="${group.signature}" title="Спецификация"><i class="fa-solid fa-list-ul"></i></button>`;
        }

        const headerText = count > 1
            ? `Типовой раскрой (x${count} шт.) - Хлыст ${bar.originalLength} мм`
            : `Раскрой хлыста - Длина ${bar.originalLength} мм`;

        html += `<div class="bar-header"><h5>${headerText}</h5><div class="header-actions">${groupActionsHTML}</div></div>`;
        html += renderBarVisualization(bar, kerf, barIdForViz);
        const usedLength = bar.originalLength - bar.remnant;
        html += `<p class="bar-summary">Использовано: ${usedLength} мм, Остаток: ${bar.remnant} мм</p>`;
        html += renderDetailsList(bar, isDetailsVisible);
        return `<div class="bar-container ${selectedClass}" ${containerDataAttrs} title="Нажмите, чтобы выбрать эту группу">${html}</div>`;
    }

    function renderEditableBar(bar, groupKey, planState, selectedBar) {
        const { visibleDetails } = planState;
        const isDetailsVisible = visibleDetails.has(bar.barId);
        const isSelected = selectedBar.groupKey === groupKey && selectedBar.barId === bar.barId;
        const selectedClass = isSelected ? 'selected-for-add' : '';
        let html = `<div class="bar-container ${selectedClass}" data-bar-id="${bar.barId}" title="Нажмите, чтобы выбрать этот хлыст">`;

        const actionsHTML = `
            <button class="btn-icon-action danger btn-delete-bar" data-bar-id="${bar.barId}" title="Удалить хлыст"><i class="fa-solid fa-trash-can"></i></button>
            <button class="btn-icon-action btn-toggle-details" data-bar-id="${bar.barId}" title="Спецификация"><i class="fa-solid fa-list-ul"></i></button>
        `;

        const barLabel = bar.barId.split('_').pop(); // Извлекаем номер из ID, например, "1" из "bar_1"

        html += `<div class="bar-header"><h5>Хлыст ${barLabel} (Длина: ${bar.originalLength} мм)</h5><div class="header-actions">${actionsHTML}</div></div>`;
        html += renderBarVisualization(bar, planState.kerf, bar.barId);
        const usedLength = bar.originalLength - bar.remnant;
        html += `<p class="bar-summary">Использовано: ${usedLength} мм, Остаток: ${bar.remnant} мм</p>`;
        html += renderDetailsList(bar, isDetailsVisible);
        html += `</div>`;
        return html;
    }

    function render(groupKey, activeCutPlans, selectedBar, resultsContainer) {
        const planState = activeCutPlans[groupKey];
        if (!planState) return;

        const { cutPlan, unplacedParts, ungroupedSignatures, isEditable } = planState;
        const [category, type] = groupKey.split('|');

        let card = resultsContainer.querySelector(`[data-group-key="${groupKey}"]`);
        if (!card) {
            card = document.createElement('div');
            card.className = 'cutting-plan-card';
            card.dataset.groupKey = groupKey;
            resultsContainer.appendChild(card);
        }

        const editOrFinishButtonHTML = !isEditable
            ? `<button class="btn-icon-action btn-ungroup" title="Редактировать"><i class="fa-solid fa-pen"></i></button>`
            : `<button class="btn-icon-action success btn-finish-edit" title="Завершить"><i class="fa-solid fa-check"></i></button>`;

        const actionsHTML = isEditable
            ? `
                 <button class="btn-icon-action primary btn-add-bar" title="Добавить хлыст"><i class="fa-solid fa-plus"></i></button>
                 <button class="btn-icon-action danger btn-clear-plan" title="Очистить план"><i class="fa-solid fa-trash"></i></button>
                 <button class="btn-icon-action btn-regroup" title="Сгруппировать одинаковые"><i class="fa-solid fa-object-group"></i></button>
               `
            : '';

        let cardHTML = `
            <div class="cutting-plan-header">
                <span class="material-type">${category} ${type}</span>
                <div class="header-actions">
                    ${actionsHTML}
                    ${editOrFinishButtonHTML}
                </div>
            </div>`;

        if (cutPlan.length === 0 && unplacedParts.length > 0) {
            cardHTML += '<p>Ни одну заготовку не удалось разместить на имеющихся материалах.</p>';
        }

        const groupedPlans = {};
        cutPlan.forEach(bar => {
            const cutSignature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
            const signature = `${bar.originalLength}|${cutSignature}`; // Добавляем длину хлыста в подпись
            if (!groupedPlans[signature]) {
                groupedPlans[signature] = { bars: [], count: 0, signature: signature };
            }
            groupedPlans[signature].bars.push(bar);
            groupedPlans[signature].count++;
        });

        Object.values(groupedPlans).sort((a, b) => b.count - a.count).forEach(group => {
            if (isEditable && (group.count === 1 || ungroupedSignatures.includes(group.signature))) {
                group.bars.sort((a, b) => a.barId.localeCompare(b.barId)).forEach(bar => cardHTML += renderEditableBar(bar, groupKey, planState, selectedBar));
            } else {
                cardHTML += renderGroupedBar(group, groupKey, planState, selectedBar);
            }
        });

        if (unplacedParts.length > 0) {
            cardHTML += `<h5>Неразмещенные заготовки:</h5><ul class="unplaced-parts-list">`;
            const unplacedSummary = unplacedParts.reduce((acc, part) => {
                acc[part.length] = (acc[part.length] || 0) + 1;
                return acc;
            }, {});
            for (const length in unplacedSummary) {
                cardHTML += `<li class="unplaced-part-item" data-length="${length}" title="Нажмите, чтобы добавить на выбранный хлыст">${length} мм x ${unplacedSummary[length]} шт.</li>`;
            }
            cardHTML += `</ul>`;
        }

        // Добавляем информацию о дефиците прямо в карточку раскроя
        if (unplacedParts.length > 0) {
            const settings = DB.getSettings();
            const deficitLengths = String(settings.deficitCalcLength).split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);
            const { kerf } = planState;

            if (deficitLengths.length > 0) {
                const deficitResult = calculateDeficit(unplacedParts, deficitLengths, kerf);

                if (Object.keys(deficitResult).length > 0) {
                    cardHTML += `
                        <div class="deficit-info-block">
                            <p>Для размещения оставшихся заготовок требуется:</p>
                            <ul>${Object.entries(deficitResult).map(([len, count]) => `<li><strong>${count} шт.</strong> по ${len} мм</li>`).join('')}</ul>
                        </div>`;
                }
            }
        }

        card.innerHTML = cardHTML;
    }

    function renderDetailsList(bar, isVisible) {
        if (bar.cuts.length === 0) return '';

        const detailsSummary = bar.cuts.reduce((acc, part) => {
            acc[part.length] = (acc[part.length] || 0) + 1;
            return acc;
        }, {});

        // Сортируем по убыванию длины
        const sortedLengths = Object.keys(detailsSummary).sort((a, b) => b - a);

        const listItems = sortedLengths.map(length => {
            const count = detailsSummary[length];
            return `<li class="detail-item" data-length="${length}" title="Подсветить на схеме">${length} мм x ${count} шт.</li>`;
        }).join('');

        const visibleClass = isVisible ? 'visible' : '';
        return `
            <div class="bar-details-list ${visibleClass}">
                <ul>${listItems}</ul>
            </div>`;
    }

    /**
     * Рассчитывает оптимальное количество хлыстов для покрытия дефицита.
     * @param {Array} unplacedParts - Массив неразмещенных деталей.
     * @param {Array<number>} availableLengths - Массив доступных длин хлыстов (из настроек).
     * @param {number} kerf - Ширина реза.
     * @returns {Object} - Объект, где ключ - длина хлыста, значение - количество. e.g. {6000: 2, 12000: 1}
     */
    function calculateDeficit(unplacedParts, availableLengths, kerf) {
        // Создаем "виртуальный склад" из доступных длин, по много штук каждой
        const virtualStock = [];
        availableLengths.forEach(length => {
            for (let i = 0; i < unplacedParts.length; i++) { // Добавляем с избытком
                virtualStock.push({ length, id: `virtual_${length}_${i}` });
            }
        });

        // Используем стандартный алгоритм раскроя
        const deficitPlan = CuttingTools.calculate(virtualStock, [...unplacedParts], kerf, 'minimal-waste');

        // Считаем, сколько хлыстов каждой длины было использовано
        const barsNeeded = {};
        deficitPlan.cutPlan.forEach(bar => {
            barsNeeded[bar.originalLength] = (barsNeeded[bar.originalLength] || 0) + 1;
        });

        return barsNeeded;
    }

    return {
        render,
        calculateDeficit // Экспортируем для использования в статистике
    };

})();