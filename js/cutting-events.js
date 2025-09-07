const CuttingEvents = (() => {
    let config = {
        container: null
    };

    function initialize(initialConfig) {
        config.container = initialConfig.container;
        // eslint-disable-next-line
        config.container.addEventListener('click', handlePlanInteraction);
    }

    function handlePlanInteraction(e) {
        const groupCard = e.target.closest('.cutting-plan-card');
        if (!groupCard) return;

        const groupKey = groupCard.dataset.groupKey;
        const planState = CuttingState.getPlan(groupKey); // eslint-disable-line
        const renderFn = () => CuttingRenderer.render(groupKey, config.container); // eslint-disable-line

        if (!planState) return;

        // --- Обрабатываем самые конкретные клики первыми ---

        // Клик по кнопке "Редактировать"
        const editBtn = e.target.closest('.btn-edit-plan');
        if (editBtn) {
            e.stopPropagation();
            planState.isEditable = true;
            renderFn();
            return;
        }

        // Клик по кнопке "Завершить и сгруппировать"
        const finishEditBtn = e.target.closest('.btn-finish-edit');
        if (finishEditBtn) {
            e.stopPropagation();
            planState.isEditable = false;
            planState.ungroupedSignatures = []; // Сбрасываем ручную разгруппировку
            CuttingState.setSelectedItem({ groupKey: null, barId: null, signature: null }); // eslint-disable-line
            renderFn();
            return;
        }

        // Клик по кнопке "Сгруппировать" в режиме редактирования
        const regroupBtn = e.target.closest('.btn-regroup');
        if (regroupBtn) {
            e.stopPropagation();
            planState.ungroupedSignatures = []; // Сбрасываем ручную разгруппировку для пересчета
            renderFn();
            return;
        }

        // Клик по кнопке "Разгруппировать" (вручную)
        const manualUngroupBtn = e.target.closest('.btn-manual-ungroup');
        if (manualUngroupBtn) {
            e.stopPropagation();
            const signature = manualUngroupBtn.dataset.signature;
            CuttingEditor.manualUngroup(groupKey, signature, renderFn); // eslint-disable-line
            return;
        }

        // Клик по кнопке "Добавить хлыст"
        const addBarBtn = e.target.closest('.btn-add-bar');
        if (addBarBtn) {
            e.stopPropagation();
            CuttingEditor.addBar(groupKey, renderFn); // eslint-disable-line
            return;
        }

        // Клик по кнопке "Очистить"
        const clearPlanBtn = e.target.closest('.btn-clear-plan');
        if (clearPlanBtn) {
            e.stopPropagation();
            ConfirmationModal.show({ // eslint-disable-line
                title: 'Очистить план?',
                message: 'Вы уверены, что хотите очистить весь план раскроя для этого материала? Все детали вернутся в неразмещенные.',
                onConfirm: () => {
                    CuttingEditor.clearPlan(groupKey, renderFn); // eslint-disable-line
                }
            });
            return;
        }

        // Клик по кнопке "Отменить"
        const undoBtn = e.target.closest('.btn-undo');
        if (undoBtn && !undoBtn.classList.contains('disabled')) {
            e.stopPropagation();
            if (CuttingHistory.undo(planState)) { // eslint-disable-line
                renderFn();
            }
            return;
        }

        // Клик по кнопке "Вернуть"
        const redoBtn = e.target.closest('.btn-redo');
        if (redoBtn && !redoBtn.classList.contains('disabled')) {
            e.stopPropagation();
            if (CuttingHistory.redo(planState)) { // eslint-disable-line
                renderFn();
            }
            return;
        }

        // Клик по кнопке удаления хлыста
        const deleteBtn = e.target.closest('.btn-delete-bar');
        if (deleteBtn) {
            e.stopPropagation();
            ConfirmationModal.show({ // eslint-disable-line
                title: 'Удалить хлыст?',
                message: 'Вы уверены, что хотите удалить этот хлыст? Все детали на нем вернутся в список неразмещенных.',
                onConfirm: () => {
                    const barId = deleteBtn.dataset.barId;
                    CuttingEditor.deleteBar(groupKey, barId, renderFn); // eslint-disable-line
                }
            });
            return;
        }

        // Клик по кнопке удаления группы
        const deleteGroupBtn = e.target.closest('.btn-delete-group');
        if (deleteGroupBtn) {
            e.stopPropagation();
            ConfirmationModal.show({ // eslint-disable-line
                title: 'Удалить группу?',
                message: 'Вы уверены, что хотите удалить эту группу хлыстов? Все детали на них вернутся в список неразмещенных.',
                onConfirm: () => {
                    const signature = deleteGroupBtn.dataset.signature;
                    CuttingEditor.deleteGroup(groupKey, signature, renderFn); // eslint-disable-line
                }
            });
            return;
        }

        // Клик по кнопке "Показать/скрыть спецификацию"
        const toggleDetailsBtn = e.target.closest('.btn-toggle-details');
        if (toggleDetailsBtn) {
            e.stopPropagation();
            const id = toggleDetailsBtn.dataset.barId || toggleDetailsBtn.dataset.signature;
            if (planState.visibleDetails.has(id)) {
                planState.visibleDetails.delete(id);
            } else {
                planState.visibleDetails.add(id);
            }
            renderFn();
            return;
        }

        // Клик по элементу в списке спецификации для подсветки
        const detailItem = e.target.closest('.detail-item');
        if (detailItem) {
            e.stopPropagation();
            const lengthToHighlight = detailItem.dataset.length;
            const barContainer = detailItem.closest('.bar-container');
            if (barContainer && lengthToHighlight) {
                const piecesToHighlight = barContainer.querySelectorAll(`.cut-piece[data-part-length="${lengthToHighlight}"]`);
                piecesToHighlight.forEach(piece => {
                    piece.classList.add('highlight');
                    setTimeout(() => piece.classList.remove('highlight'), 1500);
                });
            }
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
                    const signature = barId.replace('group_', '');
                    CuttingEditor.removePartFromGroup(groupKey, signature, partLength, renderFn); // eslint-disable-line
                } else {
                    CuttingEditor.movePartToUnplaced(groupKey, barId, partLength, renderFn); // eslint-disable-line
                }
            }
            return;
        }

        // Клик по неразмещенной детали (для добавления)
        const unplacedItem = e.target.closest('.unplaced-part-item');
        if (unplacedItem) {
            e.stopPropagation();
            const partLength = parseInt(unplacedItem.dataset.length, 10);
            const requiredLength = partLength + planState.kerf;

            // Подсветка подходящих хлыстов
            groupCard.querySelectorAll('.bar-container').forEach(c => c.classList.remove('highlight-potential-fit'));
            planState.cutPlan.forEach(bar => {
                if (bar.remnant >= requiredLength) {
                    const barElement = groupCard.querySelector(`[data-bar-id="${bar.barId}"]`);
                    if (barElement) {
                        barElement.classList.add('highlight-potential-fit');
                    } else {
                        const cutSignature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
                        const signature = `${bar.originalLength}|${cutSignature}`;
                        const groupElement = groupCard.querySelector(`[data-signature="${signature}"]`);
                        if (groupElement) groupElement.classList.add('highlight-potential-fit');
                    }
                }
            });

            // Логика добавления
            const selectedBar = CuttingState.getSelectedItem(); // eslint-disable-line
            if (selectedBar.groupKey === groupKey && (selectedBar.barId || selectedBar.signature !== null)) {
                if (selectedBar.signature !== null) {
                    const result = CuttingEditor.addPartToGroup(groupKey, selectedBar.signature, partLength); // eslint-disable-line
                    if (result && result.newSignature !== undefined) CuttingState.setSelectedItem({ ...selectedBar, signature: result.newSignature }); // eslint-disable-line
                } else {
                    CuttingEditor.movePartToBar(groupKey, selectedBar.barId, partLength); // eslint-disable-line
                }
                renderFn();
            } else {
                ConfirmationModal.show({ // eslint-disable-line
                    title: 'Выберите хлыст',
                    message: 'Сначала выберите хлыст или группу, на которую хотите добавить деталь.',
                    hideConfirmButton: true,
                    cancelText: 'Понятно'
                });
            }
            return;
        }

        // Клик по контейнеру хлыста (для выбора)
        const barContainer = e.target.closest('.bar-container');
        if (barContainer) {
            e.stopPropagation();
            const isGroup = barContainer.dataset.isGroup === 'true';
            const barId = barContainer.dataset.barId;
            const signature = barContainer.dataset.signature;

            groupCard.querySelectorAll('.bar-container').forEach(c => c.classList.remove('highlight-potential-fit'));
            const selectedItem = CuttingState.getSelectedItem(); // eslint-disable-line

            if ((isGroup && selectedItem.signature === signature) || (!isGroup && selectedItem.barId === barId)) {
                CuttingState.setSelectedItem({ groupKey: null, barId: null, signature: null }); // eslint-disable-line
            } else {
                CuttingState.setSelectedItem({ groupKey, barId: isGroup ? null : barId, signature: isGroup ? signature : null }); // eslint-disable-line
            }
            renderFn();
        }
    }

    return {
        initialize
    };
})();