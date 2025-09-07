const CuttingMagnifier = (() => { // eslint-disable-line

    let longPressTimer = null;
    let isEnabled = true;
    const LONG_PRESS_DURATION = 500; // 500 мс для долгого нажатия
    let isPanning = false;
    let startX = 0;
    let scrollLeft = 0;

    const magnifier = document.getElementById('magnifier');

    let config = {
        container: null,
        getPlans: () => ({}),
        renderMagnifiedBar: () => ''
    };

    function initialize(initialConfig) {
        config = initialConfig;
        isEnabled = DB.getSettings().magnifierEnabled; // eslint-disable-line
        toggleEventListeners(isEnabled);

        // Слушаем событие из настроек, чтобы включать/выключать "на лету"
        window.addEventListener('magnifierSettingChanged', (e) => {
            isEnabled = e.detail.enabled;
            toggleEventListeners(isEnabled);
        });
    }

    function toggleEventListeners(shouldBeEnabled) {
        // Удаляем все слушатели, чтобы избежать дублирования
        config.container.removeEventListener('mousedown', handleInteractionStart);
        config.container.removeEventListener('touchstart', handleInteractionStart);

        if (shouldBeEnabled) {
            config.container.addEventListener('mousedown', handleInteractionStart);
            config.container.addEventListener('touchstart', handleInteractionStart, { passive: true });
        }
    }

    function handleInteractionStart(e) {
        config.container.addEventListener('mousedown', handleInteractionStart);
        document.addEventListener('mousemove', handleInteractionMove);
        document.addEventListener('touchmove', handleInteractionMove);
        document.addEventListener('mouseup', handleInteractionEnd);
        document.addEventListener('touchend', handleInteractionEnd);
        const vizElement = e.target.closest('.stock-bar-visualization');
        if (!vizElement) return;

        longPressTimer = setTimeout(() => {
            e.preventDefault();
            showMagnifier(vizElement, e);
            startPanning(e);
        }, LONG_PRESS_DURATION);
    }

    function handleInteractionMove(e) {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.touches ? e.touches[0].pageX : e.pageX;
        const walk = (x - startX);

        const MOVE_THRESHOLD = 80;
        const maxScroll = magnifier.scrollWidth - magnifier.clientWidth;
        const scrollAmount = (walk / MOVE_THRESHOLD) * (maxScroll / 2);

        magnifier.scrollLeft = Math.max(0, Math.min(scrollLeft + scrollAmount, maxScroll));
    }

    function handleInteractionEnd() {
        clearTimeout(longPressTimer);
        hideMagnifier();
        stopPanning();
    }

    function startPanning(e) {
        isPanning = true;
        magnifier.querySelector('.magnifier-content').classList.add('grabbing');
        startX = e.touches ? e.touches[0].pageX : e.pageX;
        scrollLeft = magnifier.scrollLeft;
        magnifier.style.pointerEvents = 'auto';
    }

    function stopPanning() {
        isPanning = false;
        if (magnifier.querySelector('.magnifier-content')) {
            magnifier.querySelector('.magnifier-content').classList.remove('grabbing');
        }
        magnifier.style.pointerEvents = 'none';
    }

    function showMagnifier(vizElement, e) {
        const barContainer = vizElement.closest('.bar-container');
        if (!barContainer) return;

        const groupKey = barContainer.closest('.cutting-plan-card').dataset.groupKey;
        const plans = config.getPlans();
        const plan = plans[groupKey];
        if (!plan) return;

        const barId = barContainer.dataset.barId;
        const signature = barContainer.dataset.signature;
        const barData = plan.cutPlan.find(b => barId ? b.barId === barId : `${b.originalLength}|${b.cuts.map(c=>c.length).sort((a,b)=>b-a).join(',')}` === signature);

        if (!barData) return;

        magnifier.innerHTML = config.renderMagnifiedBar(barData, plan.kerf);
        const clickY = e.clientY || e.touches[0].clientY;
        magnifier.className = 'magnifier-container ' + (clickY > window.innerHeight / 2 ? 'top' : 'bottom');
        document.body.classList.add('magnifier-active');
        magnifier.style.display = 'block';

        const rect = vizElement.getBoundingClientRect();
        const clickX = (e.clientX || e.touches[0].clientX) - rect.left;
        const clickPercent = clickX / rect.width;

        const content = magnifier.querySelector('.magnifier-content');
        const scrollableWidth = content.scrollWidth;
        const magnifierWidth = magnifier.clientWidth;

        const targetScrollLeft = (scrollableWidth * clickPercent) - (magnifierWidth / 2);
        magnifier.scrollLeft = Math.max(0, Math.min(targetScrollLeft, scrollableWidth - magnifierWidth));
    }

    function hideMagnifier() {
        magnifier.style.display = 'none';
        document.body.classList.remove('magnifier-active');
    }

    return {
        initialize
    };
})();