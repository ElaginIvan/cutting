document.addEventListener('DOMContentLoaded', () => { // eslint-disable-line
    const calculateBtn = document.getElementById('calculate-cutting-btn');
    const resultsContainer = document.getElementById('cutting-results-container');
    const applyPlanBtn = document.getElementById('apply-cutting-plan-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', handleCalculation);
    }
    applyPlanBtn.addEventListener('click', handleApplyPlan);

    // eslint-disable-next-line
    CuttingEvents.initialize({ container: resultsContainer });

    CuttingMagnifier.initialize({ // eslint-disable-line
        container: resultsContainer,
        // eslint-disable-next-line
        getPlans: () => CuttingState.getPlans(),
        renderMagnifiedBar: (bar, kerf) => CuttingRenderer.renderMagnifiedBar(bar, kerf) // eslint-disable-line
    });

    function handleCalculation() {
        CuttingState.reset(); // eslint-disable-line
        resultsContainer.innerHTML = '';
        applyPlanBtn.style.display = 'none';
        exportPdfBtn.style.display = 'none';

        try {
            const settings = DB.getSettings(); // eslint-disable-line
            const materials = DB.getMaterials(); // eslint-disable-line
            const parts = DB.getParts(); // eslint-disable-line

            const calculatedPlans = CuttingCalculator.calculate(settings, materials, parts); // eslint-disable-line

            if (calculatedPlans === null) {
                resultsContainer.innerHTML = '<p class="text-muted">Не удалось подобрать план раскроя. Возможно, некоторые детали длиннее стандартных хлыстов.</p>';
            } else if (Object.keys(calculatedPlans).length === 0) {
                resultsContainer.innerHTML = '<p class="text-muted">Нет данных для расчета. Проверьте наличие материалов и заготовок.</p>';
            } else {
                CuttingState.setPlans(calculatedPlans); // eslint-disable-line
                Object.keys(calculatedPlans).forEach(groupKey =>
                    // eslint-disable-next-line
                    CuttingRenderer.render(groupKey, resultsContainer)
                );
                DB.saveProposedCuttingResult(calculatedPlans); // eslint-disable-line
                window.dispatchEvent(new CustomEvent('statsUpdated'));
                if (settings.workMode === 'warehouse') {
                    applyPlanBtn.style.display = 'block';
                }
                exportPdfBtn.style.display = 'block';
            }
        } catch (error) {
            ConfirmationModal.show({ // eslint-disable-line
                title: 'Ошибка',
                message: error.message,
                hideConfirmButton: true,
                cancelText: 'Закрыть'
            });
        }
    }

    function handleApplyPlan() {
        const plans = CuttingState.getPlans(); // eslint-disable-line
        if (Object.keys(plans).length === 0) {
            ConfirmationModal.show({ // eslint-disable-line
                title: 'Внимание',
                message: 'Нет активного плана раскроя для применения.',
                hideConfirmButton: true,
                cancelText: 'Закрыть'
            });
            return;
        }

        ConfirmationModal.show({ // eslint-disable-line
            title: 'Подтверждение списания',
            message: 'Это действие спишет использованный материал со склада и добавит полезные остатки. Продолжить?',
            onConfirm: () => {
                DB.applyCuttingPlan(plans); // eslint-disable-line
                ConfirmationModal.show({ // eslint-disable-line
                    title: 'Успех',
                    message: 'Склад успешно обновлен!',
                    hideConfirmButton: true,
                    cancelText: 'Отлично'
                });
                resetCuttingView();
                window.dispatchEvent(new CustomEvent('dataUpdated'));
            }
        });
    }

    function resetCuttingView() {
        CuttingState.reset(); // eslint-disable-line
        resultsContainer.innerHTML = '<p class="text-muted">Нажмите "Рассчитать раскрой", чтобы сгенерировать план.</p>';
        applyPlanBtn.style.display = 'none';
        exportPdfBtn.style.display = 'none';
    }
});