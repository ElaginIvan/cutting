const CuttingEditor = (() => { // eslint-disable-line no-unused-vars

    function recalculateBarRemnant(bar, kerf) {
        let usedLength = 0;
        if (bar.cuts.length > 0) {
            // Каждая деталь "забирает" один рез
            usedLength = bar.cuts.reduce((sum, cut) => sum + cut.length, 0) + (bar.cuts.length * kerf);
        }
        bar.remnant = bar.originalLength - usedLength;
    }

    function _addNewBarToPlan(plan, length, renderFn, groupKey) {
        CuttingHistory.save(plan); // eslint-disable-line

        // Находим максимальный числовой индекс, чтобы дать новому хлысту следующий номер
        const maxIdNum = plan.cutPlan.reduce((max, bar) => {
            const num = parseInt(bar.barId.split('_').pop(), 10);
            return !isNaN(num) && num > max ? num : max;
        }, 0);

        const newBar = {
            barId: `bar_${maxIdNum + 1}`,
            originalLength: length,
            cuts: [],
            remnant: length,
            isRemnantSource: false
        };
        plan.cutPlan.push(newBar);
        renderFn(groupKey);
    }

    function addBar(groupKey, renderFn) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        const settings = DB.getSettings();
        let availableStockInfo = [];
        let modalMessage = '';

        if (settings.workMode === 'simple') {
            const availableLengths = String(settings.deficitCalcLength).split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);
            availableStockInfo = availableLengths.map(len => ({ length: len }));
            modalMessage = 'Выберите стандартную длину для нового хлыста:';
            if (availableLengths.length === 0) {
                ConfirmationModal.show({
                    title: 'Ошибка',
                    message: 'Необходимо указать "Длины для расчета дефицита" в настройках, чтобы добавлять хлысты.',
                    hideConfirmButton: true,
                    cancelText: 'Закрыть'
                });
                return;
            }
        } else { // Warehouse mode
            const [category, type] = groupKey.split('|');

            // 1. Получаем общее количество стандартных хлыстов на складе по каждой длине
            const initialStock = DB.getMaterials().filter(m =>
                m.category === category &&
                m.type === type &&
                !m.isRemnant &&
                m.quantity > 0
            );

            const stockByLength = initialStock.reduce((acc, m) => {
                acc[m.length] = (acc[m.length] || 0) + m.quantity;
                return acc;
            }, {});

            // 2. Считаем, сколько стандартных хлыстов уже используется в текущем плане раскроя
            const usedBarsCount = plan.cutPlan.reduce((acc, bar) => {
                if (!bar.isRemnantSource) { // Считаем все, что не является остатком
                    acc[bar.originalLength] = (acc[bar.originalLength] || 0) + 1;
                }
                return acc;
            }, {});

            // 3. Рассчитываем доступное количество для каждой длины
            for (const length in stockByLength) {
                const initialQty = stockByLength[length];
                const usedQty = usedBarsCount[length] || 0;
                const availableQty = initialQty - usedQty;

                if (availableQty > 0) {
                    availableStockInfo.push({ length: parseInt(length, 10), available: availableQty });
                }
            }
            availableStockInfo.sort((a, b) => a.length - b.length);

            modalMessage = 'Выберите стандартную длину для нового хлыста из имеющихся на складе:';
            if (availableStockInfo.length === 0) {
                ConfirmationModal.show({
                    title: 'Нет материала',
                    message: 'На складе нет стандартных хлыстов этого типа для добавления.',
                    hideConfirmButton: true,
                    cancelText: 'Закрыть'
                });
                return;
            }
        }

        // Если доступна только одна длина, добавляем ее без диалогового окна
        if (availableStockInfo.length === 1) {
            _addNewBarToPlan(plan, availableStockInfo[0].length, renderFn, groupKey);
            return;
        }

        const buttonsHtml = availableStockInfo.map(stock => {
            const qtyText = stock.available !== undefined ? ` (Осталось: ${stock.available} шт.)` : '';
            return `<button class="btn-primary modal-action-btn" data-length="${stock.length}">Добавить хлыст ${stock.length} мм <br>${qtyText}</button>`;
        }).join('');

        ConfirmationModal.show({
            title: 'Выберите длину хлыста',
            html: `<p>${modalMessage}</p><div class="modal-options">${buttonsHtml}</div>`,
            hideConfirmButton: true,
            cancelText: 'Закрыть'
        });

        document.getElementById('confirmation-modal').onclick = (e) => {
            if (e.target.matches('.modal-action-btn')) {
                const length = parseInt(e.target.dataset.length, 10);
                if (length > 0) {
                    _addNewBarToPlan(plan, length, renderFn, groupKey);
                }
            }
        };
    }

    function deleteBar(groupKey, barId, renderFn) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        CuttingHistory.save(plan); // eslint-disable-line
        const barIndex = plan.cutPlan.findIndex(b => b.barId === barId);
        if (barIndex > -1) {
            const bar = plan.cutPlan[barIndex];
            plan.unplacedParts.push(...bar.cuts);
            plan.cutPlan.splice(barIndex, 1);
            renderFn(groupKey);
        }
    }

    function deleteGroup(groupKey, signature, renderFn) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        CuttingHistory.save(plan); // eslint-disable-line
        const barsInGroup = plan.cutPlan.filter(bar => {
            const cutSignature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
            return `${bar.originalLength}|${cutSignature}` === signature;
        });

        barsInGroup.forEach(bar => {
            plan.unplacedParts.push(...bar.cuts);
        });

        plan.cutPlan = plan.cutPlan.filter(bar => !barsInGroup.includes(bar));
        renderFn(groupKey);
    }

    function clearPlan(groupKey, renderFn) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        CuttingHistory.save(plan); // eslint-disable-line
        if (!plan) return; // Защита на случай, если плана нет

        // Перемещаем все детали из плана в неразмещенные
        if (plan.cutPlan && plan.cutPlan.length > 0) {
            plan.cutPlan.forEach(bar => {
                if (bar.cuts && bar.cuts.length > 0) {
                    plan.unplacedParts.push(...bar.cuts);
                }
            });
        }

        // Очищаем сам план
        plan.cutPlan = [];
        plan.ungroupedSignatures = [];
        renderFn(groupKey);
    }

    function manualUngroup(groupKey, signature, renderFn) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        CuttingHistory.save(plan); // eslint-disable-line
        if (!plan.ungroupedSignatures.includes(signature)) {
            plan.ungroupedSignatures.push(signature);
        }
        renderFn(groupKey);
    }

    function movePartToUnplaced(groupKey, barId, partLength, renderFn) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        CuttingHistory.save(plan); // eslint-disable-line
        const bar = plan.cutPlan.find(b => b.barId === barId);
        if (!bar) return;

        const indexToRemove = bar.cuts.findIndex(p => p.length === partLength);
        if (indexToRemove > -1) {
            const part = bar.cuts.splice(indexToRemove, 1)[0];
            plan.unplacedParts.push(part);
        }

        recalculateBarRemnant(bar, plan.kerf);
        renderFn(groupKey);
    }

    function movePartToBar(groupKey, barId, partLength) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        CuttingHistory.save(plan); // eslint-disable-line
        const bar = plan.cutPlan.find(b => b.barId === barId);
        if (!bar) return;
        const partIndexInUnplaced = plan.unplacedParts.findIndex(p => p.length === partLength);

        if (partIndexInUnplaced === -1) return;

        const kerf = plan.kerf; // Получаем ширину реза из состояния плана
        // Каждая деталь требует своей длины плюс ширину реза
        const requiredLength = partLength + kerf;
        if (bar.remnant >= requiredLength) {
            const part = plan.unplacedParts.splice(partIndexInUnplaced, 1)[0];
            bar.cuts.push(part);
            bar.cuts.sort((a, b) => b.length - a.length);
            recalculateBarRemnant(bar, plan.kerf);
        } else {
            ConfirmationModal.show({
                title: 'Ошибка размещения',
                message: 'Деталь не помещается в остаток этого хлыста.',
                hideConfirmButton: true,
                cancelText: 'Закрыть'
            });
        }
    }

    function addPartToGroup(groupKey, signature, partLength) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        CuttingHistory.save(plan); // eslint-disable-line
        const barsInGroup = plan.cutPlan.filter(bar => {
            const cutSignature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
            return `${bar.originalLength}|${cutSignature}` === signature;
        });

        if (barsInGroup.length === 0) return;

        const groupSize = barsInGroup.length;
        const availableParts = plan.unplacedParts.filter(p => p.length === partLength).length;

        if (availableParts < groupSize) {
            ConfirmationModal.show({
                title: 'Недостаточно заготовок',
                message: `Требуется ${groupSize} шт., доступно ${availableParts} шт.`,
                hideConfirmButton: true,
                cancelText: 'Закрыть'
            });
            return;
        }

        const requiredLength = partLength + plan.kerf;
        const allFit = barsInGroup.every(bar => bar.remnant >= requiredLength);

        if (!allFit) {
            ConfirmationModal.show({
                title: 'Ошибка размещения',
                message: 'Деталь не помещается в один или несколько хлыстов этой группы.',
                hideConfirmButton: true,
                cancelText: 'Закрыть'
            });
            return;
        }

        // Все проверки пройдены, добавляем детали
        for (const bar of barsInGroup) {
            const partIndex = plan.unplacedParts.findIndex(p => p.length === partLength);
            const part = plan.unplacedParts.splice(partIndex, 1)[0];
            bar.cuts.push(part);
            bar.cuts.sort((a, b) => b.length - a.length);
            recalculateBarRemnant(bar, plan.kerf);
        }

        // После добавления детали подпись группы изменилась.
        // Возвращаем новую подпись, чтобы сохранить выделение.
        const newCutSignature = barsInGroup[0].cuts.map(c => c.length).sort((a, b) => b - a).join(',');
        const newFullSignature = `${barsInGroup[0].originalLength}|${newCutSignature}`;
        if (newFullSignature !== signature) {
            return { groupKey, newSignature: newFullSignature };
        }
    }

    function removePartFromGroup(groupKey, signature, partLength, renderFn) {
        const plan = CuttingState.getPlan(groupKey); // eslint-disable-line
        CuttingHistory.save(plan); // eslint-disable-line
        const barsInGroup = plan.cutPlan.filter(bar => {
            const cutSignature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
            return `${bar.originalLength}|${cutSignature}` === signature;
        });

        barsInGroup.forEach(bar => {
            const partIndex = bar.cuts.findIndex(p => p.length === partLength);
            if (partIndex > -1) {
                const part = bar.cuts.splice(partIndex, 1)[0];
                plan.unplacedParts.push(part);
                recalculateBarRemnant(bar, plan.kerf);
            }
        });

        renderFn(groupKey);
    }

    return {
        addBar,
        deleteBar,
        deleteGroup,
        clearPlan,
        manualUngroup,
        movePartToUnplaced,
        movePartToBar,
        addPartToGroup,
        removePartFromGroup,
    };

})();