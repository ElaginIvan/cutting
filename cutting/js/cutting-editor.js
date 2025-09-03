const CuttingEditor = (() => {

    function recalculateBarRemnant(bar, kerf) {
        let usedLength = 0;
        if (bar.cuts.length > 0) {
            // Каждая деталь "забирает" один рез
            usedLength = bar.cuts.reduce((sum, cut) => sum + cut.length, 0) + (bar.cuts.length * kerf);
        }
        bar.remnant = bar.originalLength - usedLength;
    }

    function addBar(groupKey, activeCutPlans, renderFn) {
        const plan = activeCutPlans[groupKey];

        // Считаем, сколько стандартных хлыстов уже используется в плане
        const usedStandardBars = plan.cutPlan.filter(bar => {
            // Новые добавленные вручную хлысты считаем стандартными
            if (bar.barId.startsWith('bar_new_')) {
                return true;
            }
            // Хлысты изначального раскроя проверяем по флагу
            return !bar.isRemnantSource;
        }).length;

        if (usedStandardBars >= plan.initialStandardStockCount) {
            alert(`Нельзя добавить больше стандартных хлыстов. На складе всего ${plan.initialStandardStockCount} шт.`);
            return;
        }

        if (plan.standardStockLength <= 0) {
            alert('Невозможно определить длину стандартного хлыста для добавления. На складе нет стандартных хлыстов этого типа.');
            return;
        }

        const newBar = {
            barId: `bar_new_${Date.now()}`,
            originalLength: plan.standardStockLength,
            cuts: [],
            remnant: plan.standardStockLength,
            // Помечаем, что это не остаток, для консистентности
            isRemnantSource: false
        };
        plan.cutPlan.push(newBar);
        renderFn(groupKey);
    }

    function deleteBar(groupKey, barId, activeCutPlans, renderFn) {
        const plan = activeCutPlans[groupKey];
        const barIndex = plan.cutPlan.findIndex(b => b.barId === barId);
        if (barIndex > -1) {
            const bar = plan.cutPlan[barIndex];
            plan.unplacedParts.push(...bar.cuts);
            plan.cutPlan.splice(barIndex, 1);
            renderFn(groupKey);
        }
    }

    function clearPlan(groupKey, activeCutPlans, renderFn) {
        const plan = activeCutPlans[groupKey];
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

    function manualUngroup(groupKey, signature, activeCutPlans, renderFn) {
        const plan = activeCutPlans[groupKey];
        if (!plan.ungroupedSignatures.includes(signature)) {
            plan.ungroupedSignatures.push(signature);
        }
        renderFn(groupKey);
    }

    function movePartToUnplaced(groupKey, barId, partLength, activeCutPlans, renderFn) {
        const plan = activeCutPlans[groupKey];
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

    function movePartToBar(groupKey, barId, partLength, activeCutPlans, renderFn) {
        const plan = activeCutPlans[groupKey];
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
            renderFn(groupKey);
        } else {
            alert('Деталь не помещается в остаток этого хлыста.');
        }
    }

    function breakGroupAndRemovePart(groupKey, signature, partLength, activeCutPlans, renderFn) {
        const plan = activeCutPlans[groupKey];
        if (!plan) return;

        // Находим индекс первого хлыста, который соответствует подписи группы
        const barIndexToBreak = plan.cutPlan.findIndex(bar => {
            const barSignature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
            return barSignature === signature;
        });

        if (barIndexToBreak === -1) return;

        // "Отсоединяем" этот хлыст от остальных
        const brokenBar = plan.cutPlan.splice(barIndexToBreak, 1)[0];

        // Удаляем деталь из этого хлыста
        const indexToRemove = brokenBar.cuts.findIndex(p => p.length === partLength);
        if (indexToRemove > -1) {
            const part = brokenBar.cuts.splice(indexToRemove, 1)[0];
            plan.unplacedParts.push(part);
        }

        recalculateBarRemnant(brokenBar, plan.kerf);
        plan.cutPlan.push(brokenBar); // Возвращаем измененный хлыст в план как индивидуальный
        renderFn(groupKey);
    }

    function breakGroupAndSelect(groupKey, signature, activeCutPlans, callback) {
        const plan = activeCutPlans[groupKey];
        if (!plan) return;

        const barIndexToBreak = plan.cutPlan.findIndex(bar => {
            const barSignature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
            return barSignature === signature;
        });

        if (barIndexToBreak === -1) return;

        const brokenBar = plan.cutPlan.splice(barIndexToBreak, 1)[0];
        brokenBar.barId = `bar_broken_${Date.now()}`; // Даем новый уникальный ID
        plan.cutPlan.push(brokenBar);

        if (typeof callback === 'function') {
            callback(brokenBar.barId); // Возвращаем ID нового хлыста для выделения
        }
    }

    return {
        addBar,
        deleteBar,
        clearPlan,
        manualUngroup,
        movePartToUnplaced,
        movePartToBar,
        breakGroupAndRemovePart,
        breakGroupAndSelect
    };

})();