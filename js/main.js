document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const contentWrapper = document.querySelector('.content-wrapper');
    const contentSections = document.querySelectorAll('.content-section');
    const breakpoint = 760; // Ширина, на которой меняется поведение
    const materialTab = document.querySelector('.nav-item[data-tab="material"]');
    let activeIndex = 0; // Индекс активной вкладки
    let resizeTimer; // Таймер для оптимизации события resize

    /**
     * Применяет выбранную тему (светлую или темную) к документу.
     * @param {string} theme - 'light' или 'dark'
     */
    function applyTheme(theme) {
        document.body.dataset.theme = theme;
    }

    /**
     * Основная функция для обновления отображения.
     * В зависимости от ширины экрана, она либо переключает классы (ПК),
     * либо сдвигает контейнер (мобильные).
     */
    function updateView() {
        // Обновляем активный класс на кнопках навигации
        navItems.forEach((item, i) => {
            item.classList.toggle('active', i === activeIndex);
        });

        if (window.innerWidth < breakpoint) {
            // --- МОБИЛЬНЫЙ РЕЖИМ (свайп) ---
            // Убираем класс .active у секций, так как они все должны быть в DOM для свайпа
            contentSections.forEach(section => section.classList.remove('active'));

            // Сдвигаем контейнер на нужную позицию
            const offset = -activeIndex * 100;
            contentWrapper.style.transform = `translateX(${offset}%)`;
        } else {
            // --- РЕЖИМ ПК (вкладки) ---
            // Сбрасываем сдвиг, который мог остаться от мобильного режима
            contentWrapper.style.transform = '';

            // Переключаем видимость секций с помощью класса .active
            contentSections.forEach((section, i) => {
                section.classList.toggle('active', i === activeIndex);
            });
        }
    }

    // Обработчики кликов по навигации
    navItems.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Предотвращаем переход по ссылке #
            activeIndex = index;
            updateView();
        });
    });

    // --- Логика свайпа для мобильных устройств ---
    let touchstartX = 0;
    let touchendX = 0;

    contentWrapper.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, { passive: true }); // passive: true для лучшей производительности скролла

    contentWrapper.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        if (window.innerWidth >= breakpoint) return; // Свайп работает только на мобильных
        // Блокируем свайп, если активна лупа
        if (document.body.classList.contains('magnifier-active')) return;

        const swipeThreshold = 50; // Минимальная дистанция для свайпа
        if (touchendX < touchstartX - swipeThreshold && activeIndex < navItems.length - 1) {
            activeIndex++; // Свайп влево
        } else if (touchendX > touchstartX + swipeThreshold && activeIndex > 0) {
            activeIndex--; // Свайп вправо
        }
        // Если свайп был достаточно сильным, activeIndex изменился, и мы обновляем вид
        updateView();
    }

    function handleModeChange(mode) {
        materialTab.style.display = mode === 'simple' ? 'none' : 'flex';

        // Если мы в простом режиме и активна вкладка "Материал" (которая теперь скрыта),
        // переключаемся на следующую вкладку "Заготовки".
        if (mode === 'simple' && activeIndex === 0) {
            activeIndex = 1;
            // Без вызова updateView, т.к. он будет вызван при инициализации или свайпе
        }
        updateView();
    }

    // --- Обработчик изменения размера окна ---
    window.addEventListener('resize', () => {
        contentWrapper.classList.add('no-transition');
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            updateView();
            contentWrapper.classList.remove('no-transition');
        }, 100);
    });

    // Слушаем событие смены режима работы
    window.addEventListener('workModeChanged', e => handleModeChange(e.detail.mode));
    // Слушаем событие смены темы
    window.addEventListener('themeChanged', e => applyTheme(e.detail.theme));

    // Устанавливаем начальное состояние при загрузке страницы
    const initialSettings = DB.getSettings();
    applyTheme(initialSettings.theme);
    handleModeChange(initialSettings.workMode);
});
