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
            const totalBlockLength = groupTotalLength + kerfsInGroup; // eslint-disable-line
            const groupWidth = ((group.length + kerf) * group.count - kerf) / bar.originalLength * 100;
 
            const fullLabel = group.count > 1 ? `${group.name || group.length}x${group.count}` : `${group.name || group.length}`;
            const title = group.count > 1
                ? `Группа: ${group.count} шт. по ${group.length} мм (блок ${totalBlockLength}мм). Нажмите для удаления.`
                : `Деталь: ${group.length} мм. Нажмите для удаления.`;
            const groupClass = group.count > 1 ? 'grouped' : '';
 
            // В режиме редактирования добавляем data-атрибуты для идентификации группы
            const dataAttrs = barId
                ? `data-bar-id="${barId}" data-part-length="${group.length}" data-part-count="${group.count}" data-part-name="${group.name || ''}"`
                : '';
 
            // Скрываем текст, если блок слишком узкий, как в PDF
            const displayLabel = groupWidth > 4 ? fullLabel : '';
            const labelHtml = displayLabel ? `<span class="piece-label">${displayLabel}</span>` : '';
            vizHTML += `<div class="cut-piece ${groupClass}" style="width: ${groupWidth}%" title="${title}" ${dataAttrs}>${labelHtml}</div>`;
        });
 
        if (bar.remnant > 0) {
            const remnantWidth = (bar.remnant / bar.originalLength) * 100;
            const remnantLabel = remnantWidth > 4 ? bar.remnant : '';
            const remnantLabelHtml = remnantLabel ? `<span class="piece-label">${remnantLabel}</span>` : '';
            vizHTML += `<div class="remnant-piece" style="width: ${remnantWidth}%" title="Остаток: ${bar.remnant} мм">${remnantLabelHtml}</div>`;
        }
        vizHTML += '</div>';
        return vizHTML;
    }

    function renderMagnifiedBar(bar, kerf) {
        const SCALE_FACTOR = 0.5; // 0.5px на каждый 1мм длины
        const barWidthPx = bar.originalLength * SCALE_FACTOR;
    
        let html = `<div class="magnifier-title">Хлыст ${bar.originalLength} мм (перемещайте для просмотра)</div>`;
        // Внутренний контейнер для прокрутки
        html += '<div class="magnifier-content">';
        // Сама визуализация теперь очень широкая, в пикселях
        html += `<div class="stock-bar-visualization" style="height: 60px; width: ${barWidthPx}px; background-color: var(--bg-color);">`;
    
        bar.cuts.forEach(cut => {
            const pieceWidthPx = cut.length * SCALE_FACTOR;
            const label = cut.name || cut.length;
            const labelHtml = `<span class="piece-label" style="font-size: 14px;">${label}</span>`;
            html += `<div class="cut-piece" style="width: ${pieceWidthPx}px;">${labelHtml}</div>`;
    
            // Визуализируем рез
            if (kerf > 0) {
                const kerfWidthPx = kerf * SCALE_FACTOR;
                if (kerfWidthPx > 0) {
                    html += `<div style="width: ${kerfWidthPx}px; background-color: #333;" title="Рез: ${kerf} мм"></div>`;
                }
            }
        });
    
        if (bar.remnant > 0) {
            const remnantWidthPx = bar.remnant * SCALE_FACTOR;
            html += `<div class="remnant-piece" style="width: ${remnantWidthPx}px;"><span class="piece-label" style="font-size: 14px;">${bar.remnant}</span></div>`;
        }
        html += '</div></div>'; // Закрываем .stock-bar-visualization и .magnifier-content
        return html;
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
            groupActionsHTML += `<button class="btn-icon primary btn-manual-ungroup" data-signature="${group.signature}" title="Разгруппировать"><i class="fa-solid fa-object-ungroup"></i></button>`;
        }
        if (isEditable) {
            groupActionsHTML += `<button class="btn-icon danger btn-delete-group" data-signature="${group.signature}" title="Удалить группу"><i class="fa-solid fa-trash-can"></i></button>`;
        }
        // Кнопка спецификации видна всегда, если есть что показывать
        if (bar.cuts.length > 0) {
            groupActionsHTML += `<button class="btn-icon btn-toggle-details" data-signature="${group.signature}" title="Спецификация"><i class="fa-solid fa-list-ul"></i></button>`;
        }

        const headerText = count > 1
            ? `Типовой раскрой (x${count} шт.)<br><small style="color: var(--text-muted-color); font-weight: normal;">Хлыст ${bar.originalLength} мм</small>`
            : `Раскрой хлыста <br><small style="color: var(--text-muted-color); font-weight: normal;">Длина ${bar.originalLength} мм</small>`;

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
            <button class="btn-icon danger btn-delete-bar" data-bar-id="${bar.barId}" title="Удалить хлыст"><i class="fa-solid fa-trash-can"></i></button>
            <button class="btn-icon btn-toggle-details" data-bar-id="${bar.barId}" title="Спецификация"><i class="fa-solid fa-list-ul"></i></button>
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

    function render(groupKey, resultsContainer) {
        const planState = CuttingState.getPlan(groupKey); // eslint-disable-line
        const selectedItem = CuttingState.getSelectedItem(); // eslint-disable-line
        if (!planState) return;

        // eslint-disable-next-line
        const { cutPlan, unplacedParts, ungroupedSignatures, isEditable } = planState;
        const [category, type] = groupKey.split('|');
        
        const settings = DB.getSettings(); // eslint-disable-line
        const stats = CuttingTools.calculateStats(cutPlan, planState.kerf, settings.minRemnantSize); // eslint-disable-line
        const kpiDisplay = stats.kpi > 0 ? `<span class="kpi-display">(КИМ: ${stats.kpi.toFixed(2)}%)</span>` : '';

        let card = resultsContainer.querySelector(`[data-group-key="${groupKey}"]`);
        if (!card) {
            card = document.createElement('div');
            card.className = 'cutting-plan-card';
            card.dataset.groupKey = groupKey;
            resultsContainer.appendChild(card);
        }
        
        // Запоминаем, была ли карточка развернута до перерисовки
        const wasActive = card.querySelector('.cutting-plan-header')?.classList.contains('active');
        const wasDisplayed = card.querySelector('.cutting-plan-content')?.style.display === 'block';
        // Если карточка была развернута пользователем вручную, а не по умолчанию (из-за неразмещенных деталей),
        // то это состояние нужно сохранить.
        const userToggled = wasActive && wasDisplayed;

        const undoDisabled = !isEditable || planState.historyIndex <= 0 ? 'disabled' : '';
        const redoDisabled = !isEditable || planState.historyIndex >= planState.history.length - 1 ? 'disabled' : '';

        const actionsHTML = isEditable
            ? `<div style="display: flex; justify-content: flex-end; gap: 10px; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap;">
                <button class="btn-icon primary btn-undo ${undoDisabled}" title="Отменить"><i class="fa-solid fa-rotate-left"></i></button>
                <button class="btn-icon primary btn-redo ${redoDisabled}" title="Вернуть"><i class="fa-solid fa-rotate-right"></i></button>
                <button class="btn-icon primary btn-add-bar" title="Добавить хлыст"><i class="fa-solid fa-plus"></i></button>
                <button class="btn-icon danger btn-clear-plan" title="Очистить план"><i class="fa-solid fa-trash"></i></button>
                <button class="btn-icon btn-regroup" title="Сгруппировать одинаковые"><i class="fa-solid fa-object-group"></i></button>
                <button class="btn-icon success btn-finish-edit" title="Завершить"><i class="fa-solid fa-check"></i></button>
            </div>`
            : '';

        const hasUnplaced = unplacedParts.length > 0;
        const headerActiveClass = hasUnplaced || userToggled ? 'active' : '';

        let cardHTML = `
            <div class="cutting-plan-header ${headerActiveClass}">
                <div>
                    <span class="material-type">${category} ${type}</span>
                    ${kpiDisplay}
                </div>
            </div>`;

        let contentHTML = '';
        if (isEditable) {
            contentHTML += actionsHTML;
        } else {
            contentHTML += `<div class="cutting-main-card-actions">
                                <button class="btn-icon btn-edit-plan" title="Редактировать"><i class="fa-solid fa-pen"></i></button>
                            </div>`;
        }

        if (cutPlan.length === 0 && unplacedParts.length > 0) {
            contentHTML += '<p>Ни одну заготовку не удалось разместить на имеющихся материалах.</p>';
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
                group.bars.sort((a, b) => a.barId.localeCompare(b.barId)).forEach(bar => contentHTML += renderEditableBar(bar, groupKey, planState, selectedItem));
            } else {
                contentHTML += renderGroupedBar(group, groupKey, planState, selectedItem);
            }
        });

        if (unplacedParts.length > 0) {
            contentHTML += `<h5>Неразмещенные заготовки:</h5><ul class="unplaced-parts-list">`;
            const unplacedSummary = unplacedParts.reduce((acc, part) => {
                acc[part.length] = (acc[part.length] || 0) + 1;
                return acc;
            }, {});
            for (const length in unplacedSummary) {
                const part = unplacedParts.find(p => p.length == length); // Находим первую деталь с такой длиной, чтобы получить имя
                contentHTML += `<li class="unplaced-part-item" data-length="${length}" title="Нажмите, чтобы добавить на выбранный хлыст">${part.name || length + ' мм'} x ${unplacedSummary[length]} шт.</li>`;
            }
            contentHTML += `</ul>`;
        }

        // Добавляем информацию о дефиците прямо в карточку раскроя
        if (unplacedParts.length > 0) {
            // const settings = DB.getSettings(); // eslint-disable-line - уже получены выше
            const deficitLengths = String(settings.deficitCalcLength).split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);
            const { kerf } = planState;

            if (deficitLengths.length > 0) {
                const deficitResult = calculateDeficit(unplacedParts, deficitLengths, kerf); // eslint-disable-line

                if (Object.keys(deficitResult).length > 0) {
                    contentHTML += `
                        <div class="deficit-info-block">
                            <p>Для размещения оставшихся заготовок требуется:</p>
                            <ul>${Object.entries(deficitResult).map(([len, count]) => `<li><strong>${count} шт.</strong> по ${len} мм</li>`).join('')}</ul>
                        </div>`;
                }
            }
        }
        
        const contentDisplayStyle = hasUnplaced || userToggled ? 'display: block;' : 'display: none;';
        // Оборачиваем контент в специальный div для сворачивания
        card.innerHTML = cardHTML + `<div class="cutting-plan-content" style="${contentDisplayStyle}">${contentHTML}</div>`;
    }    

    function renderDetailsList(bar, isVisible) {
        if (bar.cuts.length === 0) return '';

        const detailsSummary = bar.cuts.reduce((acc, part) => {
            const key = part.name ? `${part.name}|${part.length}` : `_${part.length}`;
            if (!acc[key]) acc[key] = { name: part.name, length: part.length, count: 0 };
            acc[key].count++;
            return acc;
        }, {});

        const listItems = Object.values(detailsSummary).sort((a, b) => b.length - a.length).map(item => {
            const label = item.name ? `${item.name} (${item.length} мм)` : `${item.length} мм`;
            return `<li class="detail-item" data-length="${item.length}" title="Подсветить на схеме">${label} x ${item.count} шт.</li>`;
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
        const settings = DB.getSettings(); // eslint-disable-line
        const minRemnantSize = settings.minRemnantSize || 0;

        // Находим лучший вариант хлыста для покрытия дефицита
        const bestPlanForDeficit = CuttingTools.analyzeAndFindBestStock(unplacedParts, availableLengths, kerf, minRemnantSize);

        if (!bestPlanForDeficit || bestPlanForDeficit.cutPlan.length === 0) {
            return {};
        }

        // Считаем, сколько хлыстов лучшей длины было использовано
        const barsNeeded = {};
        bestPlanForDeficit.cutPlan.forEach(bar => {
            barsNeeded[bar.originalLength] = (barsNeeded[bar.originalLength] || 0) + 1;
        });

        return barsNeeded;
    }

    return {
        render,
        calculateDeficit, // Экспортируем для использования в статистике
        renderMagnifiedBar
    };

})();