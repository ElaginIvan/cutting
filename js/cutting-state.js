const CuttingState = (() => {
    let activeCutPlans = {};
    let selectedItem = { groupKey: null, barId: null, signature: null };

    function getPlans() {
        return activeCutPlans;
    }

    function getPlan(groupKey) {
        return activeCutPlans[groupKey];
    }

    function setPlans(plans) {
        activeCutPlans = plans;
    }

    function getSelectedItem() {
        return selectedItem;
    }

    function setSelectedItem(newItem) {
        selectedItem = newItem;
    }

    function reset() {
        activeCutPlans = {};
        selectedItem = { groupKey: null, barId: null, signature: null };
    }

    return {
        getPlans,
        getPlan,
        setPlans,
        getSelectedItem,
        setSelectedItem,
        reset
    };
})();