const CuttingRenderer = (() => {

    function renderBarVisualization(bar, kerf, barId = null) {
        let vizHTML = '<div class="stock-bar-visualization">';
        // Сортируем детали для корректной группировки
        const cuts = [...bar.cuts].sort((a, b) => b.length - a.length);

        // Группируем последовательные одинаковые детали
        const groupedCuts = [];
        if (cuts.length > 0) {
            let currentGroup = { length: cuts[0].length, count: 1 };
            for (let i = 1; i < cuts.length; i++) {
                if (cuts[i].length === currentGroup.length) {
                    currentGroup.count++;
                } else {
                    groupedCuts.push(currentGroup);
                    currentGroup = { length: cuts[i].length, count: 1 };
                }
            }
            groupedCuts.push(currentGroup);
        }

        groupedCuts.forEach((group, groupIndex) => {
            if (groupIndex > 0) {
                vizHTML += `<div class="kerf-piece" style="width: ${(kerf / bar.originalLength) * 100}%" title="Рез: ${kerf} мм"></div>`;
            }

            const groupTotalLength = group.length * group.count;
            const kerfsInGroup = (group.count - 1) * kerf;
            const totalBlockLength = groupTotalLength + kerfsInGroup;
            const groupWidth = (totalBlockLength / bar.originalLength) * 100;

            const label = group.count > 1 ? `${group.length}x${group.count}` : `${group.length}`;
            const title = group.count > 1
                ? `Группа: ${group.count} шт. по ${group.length} мм (Нажмите для удаления)`
                : `Деталь: ${group.length} мм (Нажмите для удаления)`;
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

    function renderGroupedBar(group, groupKey, isEditable, activeCutPlans) {
        const { bar, count } = { bar: group.bars[0], count: group.count };
        const { kerf } = activeCutPlans[groupKey];
        let html = '';

        const barIdForViz = isEditable ? `group_${group.signature}` : null;
        const containerDataAttrs = isEditable ? `data-is-group="true" data-signature="${group.signature}"` : '';

        const ungroupBtnHTML = isEditable && count > 1
            ? `<button class="btn-icon-action btn-manual-ungroup" data-signature="${group.signature}" title="Разгруппировать"><i class="fa-solid fa-object-ungroup"></i></button>`
            : '';

        const headerText = count > 1
            ? `Типовой раскрой (x${count} шт.) - Хлыст ${bar.originalLength} мм`
            : `Раскрой хлыста - Длина ${bar.originalLength} мм`;

        html += `<div class="bar-header"><h5>${headerText}</h5> ${ungroupBtnHTML}</div>`;
        html += renderBarVisualization(bar, kerf, barIdForViz);
        const usedLength = bar.originalLength - bar.remnant;
        html += `<p class="bar-summary">Использовано: ${usedLength} мм, Остаток: ${bar.remnant} мм</p>`;
        return `<div class="bar-container" ${containerDataAttrs}>${html}</div>`;
    }

    function renderEditableBar(bar, groupKey, selectedBar, activeCutPlans) {
        const isSelected = selectedBar.groupKey === groupKey && selectedBar.barIndex === bar.barId;
        const selectedClass = isSelected ? 'selected-for-add' : '';
        let html = `<div class="bar-container ${selectedClass}" data-bar-id="${bar.barId}" title="Нажмите, чтобы выбрать этот хлыст">`;

        const deleteBtnHTML = `<button class="btn-icon-action danger btn-delete-bar" data-bar-id="${bar.barId}" title="Удалить хлыст"><i class="fa-solid fa-trash-can"></i></button>`;
        const barLabel = bar.barId.startsWith('bar_new_') ? 'Новый' : `#${bar.barId.replace('bar_', '')}`;

        html += `<div class="bar-header"><h5>Хлыст ${barLabel} (Длина: ${bar.originalLength} мм)</h5> ${deleteBtnHTML}</div>`;
        html += renderBarVisualization(bar, activeCutPlans[groupKey].kerf, bar.barId);
        const usedLength = bar.originalLength - bar.remnant;
        html += `<p class="bar-summary">Использовано: ${usedLength} мм, Остаток: ${bar.remnant} мм</p>`;
        html += `</div>`;
        return html;
    }

    function render(groupKey, activeCutPlans, selectedBar, resultsContainer) {
        const planState = activeCutPlans[groupKey];
        if (!planState) return;

        const { isEditable, cutPlan, unplacedParts, ungroupedSignatures } = planState;
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
            : `<button class="btn-icon-action success btn-group-layouts" title="Завершить и сгруппировать"><i class="fa-solid fa-check"></i></button>`;

        const actionsHTML = isEditable
            ? `
                 <button class="btn-icon-action primary btn-add-bar" title="Добавить хлыст"><i class="fa-solid fa-plus"></i></button>
                 <button class="btn-icon-action danger btn-clear-plan" title="Очистить план"><i class="fa-solid fa-trash"></i></button>
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
            const signature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
            if (!groupedPlans[signature]) {
                groupedPlans[signature] = { bars: [], count: 0, signature: signature };
            }
            groupedPlans[signature].bars.push(bar);
            groupedPlans[signature].count++;
        });

        Object.values(groupedPlans).forEach(group => {
            if (isEditable && (group.count === 1 || ungroupedSignatures.includes(group.signature))) {
                group.bars.forEach(bar => cardHTML += renderEditableBar(bar, groupKey, selectedBar, activeCutPlans));
            } else {
                cardHTML += renderGroupedBar(group, groupKey, isEditable, activeCutPlans);
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

        card.innerHTML = cardHTML;
    }

    return {
        render
    };

})();