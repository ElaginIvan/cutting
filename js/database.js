const DB = (() => {
    const KEYS = {
        materials: 'cuttingApp_materials',
        parts: 'cuttingApp_parts',
        assortment: 'cuttingApp_assortment',
        settings: 'cuttingApp_settings',
        lastCuttingResult: 'cuttingApp_lastResult',
        proposedCuttingResult: 'cuttingApp_proposedResult'
    };

    // --- Управление материалами (Materials) ---
    const getMaterials = () => {
        const materials = localStorage.getItem(KEYS.materials);
        return materials ? JSON.parse(materials) : [];
    };

    const saveMaterials = (materials) => {
        localStorage.setItem(KEYS.materials, JSON.stringify(materials));
    };

    const addMaterial = (material) => {
        const materials = getMaterials();
        const materialId = `${material.category}|${material.type}|${material.length}`;

        if (material.isRemnant) {
            // --- Логика для добавления остатка ---
            const existingRemnant = materials.find(m => m.id === materialId && m.isRemnant);
            if (existingRemnant) {
                existingRemnant.quantity += material.quantity;
            } else {
                materials.push({
                    id: materialId,
                    ...material
                });
            }
        } else {
            // --- Логика для добавления стандартного материала ---
            const existingMaterial = materials.find(m => m.id === materialId && !m.isRemnant);
            if (existingMaterial) {
                existingMaterial.quantity += material.quantity;
            } else {
                materials.push({
                    id: materialId,
                    ...material
                });
            }
        }
        saveMaterials(materials);
    };

    const updateMaterial = (id, newMaterialData) => {
        let materials = getMaterials();
        const materialIndex = materials.findIndex(m => m.id === id);
        if (materialIndex === -1) return;

        // Удаляем старую запись
        materials.splice(materialIndex, 1);

        // Повторяем логику addMaterial, но с уже измененным массивом `materials`
        const newMaterialId = `${newMaterialData.category}|${newMaterialData.type}|${newMaterialData.length}`;
        let existingTarget;

        if (newMaterialData.isRemnant) {
            existingTarget = materials.find(m => m.id === newMaterialId && m.isRemnant);
        } else {
            existingTarget = materials.find(m => m.id === newMaterialId && !m.isRemnant);
        }

        if (existingTarget) {
            // Если нашли куда объединить, увеличиваем количество
            existingTarget.quantity += newMaterialData.quantity;
        } else {
            // Если не нашли, добавляем как новую запись
            materials.push({
                id: newMaterialId,
                ...newMaterialData
            });
        }
        saveMaterials(materials);
    };

    const deleteMaterial = (id) => {
        let materials = getMaterials();
        materials = materials.filter(m => m.id !== id);
        saveMaterials(materials);
    };

    // --- Управление заготовками (Parts) ---
    const getParts = () => {
        const parts = localStorage.getItem(KEYS.parts);
        return parts ? JSON.parse(parts) : [];
    };

    const saveParts = (parts) => {
        localStorage.setItem(KEYS.parts, JSON.stringify(parts));
    };

    const addPart = (part) => {
        const parts = getParts();
        part.id = `part_${new Date().getTime()}`; // Уникальный ID
        parts.push(part);
        saveParts(parts);
    };

    const deletePart = (id) => {
        let parts = getParts();
        parts = parts.filter(p => p.id !== id);
        saveParts(parts);
    };

    const updatePart = (id, updates) => {
        const parts = getParts();
        const partIndex = parts.findIndex(p => p.id === id);
        if (partIndex > -1) {
            // Обновляем поля, сохраняя остальные
            parts[partIndex] = { ...parts[partIndex], ...updates };
            saveParts(parts);
        }
    };

    const clearPartsByMode = (mode) => {
        let parts = getParts();
        if (mode === 'simple') {
            // Оставляем только заготовки НЕ для простого режима
            parts = parts.filter(p => p.category !== 'Основной');
        } else { // warehouse mode
            // Оставляем только заготовки для простого режима
            parts = parts.filter(p => p.category === 'Основной');
        }
        saveParts(parts);
    };

    // --- Управление сортаментом (Assortment) ---

    const getAssortment = () => {
        const assortment = localStorage.getItem(KEYS.assortment);
        return assortment ? JSON.parse(assortment) : [];
    };

    const saveAssortment = (assortment) => {
        localStorage.setItem(KEYS.assortment, JSON.stringify(assortment));
    };

    const addAssortment = (item) => {
        const assortment = getAssortment();
        // Проверяем, есть ли уже такой тип
        const existingIndex = assortment.findIndex(a => a.name === item.name);
        if (existingIndex > -1) {
            // Если есть, просто заменяем его (для простоты)
            assortment[existingIndex] = item;
        } else {
            assortment.push(item);
        }
        saveAssortment(assortment);
    };

    const deleteAssortment = (name) => {
        let assortment = getAssortment();
        assortment = assortment.filter(a => a.name !== name);
        saveAssortment(assortment);
    };

    const updateAssortment = (originalName, updatedItem) => {
        let assortment = getAssortment();
        // Удаляем старый элемент по оригинальному имени и добавляем обновленный.
        // Это корректно обрабатывает смену имени.
        assortment = assortment.filter(a => a.name !== originalName);
        assortment.push(updatedItem);
        saveAssortment(assortment);
    };

    // --- Управление настройками (Settings) ---
    const getSettings = () => {
        const defaults = {
            kerf: 2,
            workMode: 'simple', // 'simple' или 'warehouse'
            minRemnantSize: 200,
            deficitCalcLength: '6000',
            theme: 'dark', // 'dark' или 'light'
            magnifierEnabled: false, // Отключаем лупу по умолчанию
            cuttingStrategy: 'minimal-waste', // Стратегия по умолчанию
            // Настройки печати
            pdfFilename: 'Раскрой_{material}_{date}',
            pdfShowUnplaced: true,
            pdfGroupBars: true,
            pdfOrientation: 'p', // 'p' - portrait, 'l' - landscape
            pdfImageQuality: 0.85
        };
        const savedSettings = localStorage.getItem(KEYS.settings);
        // Смешиваем сохраненные настройки с настройками по умолчанию,
        // чтобы новые настройки применялись, даже если у пользователя старая версия в localStorage
        return savedSettings ? { ...defaults, ...JSON.parse(savedSettings) } : defaults;
    };

    const saveSettings = (settings) => {
        localStorage.setItem(KEYS.settings, JSON.stringify(settings));
    };

    const updateSetting = (key, value) => {
        const settings = getSettings();
        settings[key] = value;
        saveSettings(settings);
    };

    // --- Управление результатом раскроя для статистики ---
    const getLastCuttingResult = () => {
        const result = localStorage.getItem(KEYS.lastCuttingResult);
        // Возвращаем пустой объект, если ничего нет, для унификации
        return result ? JSON.parse(result) : {};
    };

    const saveLastCuttingResult = (result) => {
        localStorage.setItem(KEYS.lastCuttingResult, JSON.stringify(result));
    };

    const getProposedCuttingResult = () => {
        const result = localStorage.getItem(KEYS.proposedCuttingResult);
        return result ? JSON.parse(result) : null;
    };

    const saveProposedCuttingResult = (result) => {
        localStorage.setItem(KEYS.proposedCuttingResult, JSON.stringify(result));
    };

    const clearProposedCuttingResult = () => {
        localStorage.removeItem(KEYS.proposedCuttingResult);
    };


    const applyCuttingPlan = (planData) => {
        let materials = getMaterials();
        let parts = getParts();
        const settings = getSettings();
        const minRemnantSize = settings.minRemnantSize || 0;

        const partDeductions = {};

        for (const groupKey in planData) {
            const plan = planData[groupKey];
            if (!plan.cutPlan || plan.cutPlan.length === 0) continue;

            // 1. Собираем информацию о том, сколько каких хлыстов было использовано
            const stockDeductions = {};
            plan.cutPlan.forEach(bar => {
                if (bar.sourceId) {
                    stockDeductions[bar.sourceId] = (stockDeductions[bar.sourceId] || 0) + 1;
                }
            });

            // 2. Списываем использованные хлысты (и основные, и остатки)
            for (const materialId in stockDeductions) {
                const materialIndex = materials.findIndex(m => m.id === materialId);
                if (materialIndex > -1) {
                    materials[materialIndex].quantity -= stockDeductions[materialId];
                }
            }

            // 3. Добавляем полезные остатки и считаем детали для списания
            const [category, type] = groupKey.split('|');
            plan.cutPlan.forEach(bar => {
                if (bar.remnant >= minRemnantSize) {
                    const remnant = { category, type, length: bar.remnant };
                    const remnantId = `${remnant.category}|${remnant.type}|${remnant.length}`;
                    const existingRemnant = materials.find(m => m.id === remnantId && m.isRemnant);

                    if (existingRemnant) {
                        existingRemnant.quantity += 1;
                    } else {
                        materials.push({ ...remnant, id: remnantId, quantity: 1, isRemnant: true });
                    }
                }
                // Считаем использованные заготовки для списания
                bar.cuts.forEach(cut => {
                    if (cut.id) {
                        partDeductions[cut.id] = (partDeductions[cut.id] || 0) + 1;
                    }
                });
            });
        }
        // 4. Убираем материалы с нулевым или отрицательным количеством
        materials = materials.filter(m => m.quantity > 0);
        saveMaterials(materials);

        // 5. Списываем использованные заготовки
        if (Object.keys(partDeductions).length > 0) {
            parts.forEach(part => {
                if (partDeductions[part.id]) {
                    part.quantity -= partDeductions[part.id];
                }
            });
            parts = parts.filter(p => p.quantity > 0);
            saveParts(parts);
        }

        // Сохраняем данные о раскрое для страницы статистики
        saveLastCuttingResult(planData);

        // Очищаем предложенный план, так как он был применен
        clearProposedCuttingResult();
    };

    // --- Публичный интерфейс модуля ---
    return {
        getMaterials,
        addMaterial,
        deleteMaterial,
        updateMaterial,
        getParts, // Добавляем для будущего использования
        addPart,
        deletePart,
        updatePart,
        clearPartsByMode,
        getAssortment,
        addAssortment,
        deleteAssortment,
        updateAssortment,
        getSettings,
        getLastCuttingResult,
        getProposedCuttingResult,
        saveProposedCuttingResult,
        clearProposedCuttingResult,
        updateSetting,
        applyCuttingPlan
    };

})();