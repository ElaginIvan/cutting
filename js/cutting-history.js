const CuttingHistory = (() => {

    function save(plan) {
        // Если мы отменяли действия, а теперь делаем новое, "будущее" (redo) стирается
        if (plan.historyIndex < plan.history.length - 1) {
            plan.history = plan.history.slice(0, plan.historyIndex + 1);
        }
        const currentState = {
            cutPlan: JSON.parse(JSON.stringify(plan.cutPlan)),
            unplacedParts: JSON.parse(JSON.stringify(plan.unplacedParts)),
            ungroupedSignatures: [...plan.ungroupedSignatures]
        };
        plan.history.push(currentState);
        plan.historyIndex++;
    }

    function undo(plan) {
        if (plan.historyIndex > 0) {
            plan.historyIndex--;
            _restoreState(plan);
            return true;
        }
        return false;
    }

    function redo(plan) {
        if (plan.historyIndex < plan.history.length - 1) {
            plan.historyIndex++;
            _restoreState(plan);
            return true;
        }
        return false;
    }

    function _restoreState(plan) {
        const stateToRestore = plan.history[plan.historyIndex];
        plan.cutPlan = JSON.parse(JSON.stringify(stateToRestore.cutPlan));
        plan.unplacedParts = JSON.parse(JSON.stringify(stateToRestore.unplacedParts));
        plan.ungroupedSignatures = [...stateToRestore.ungroupedSignatures];
    }

    return { save, undo, redo };

})();