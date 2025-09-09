document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('export-pdf-btn');
    const exportContainer = document.getElementById('export-container');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
        const proposedPlan = DB.getProposedCuttingResult();
        if (!proposedPlan || Object.keys(proposedPlan).length === 0) {
            ConfirmationModal.show({
                title: 'Нет данных',
                message: 'Нет данных для экспорта. Сначала рассчитайте раскрой.',
                hideConfirmButton: true,
                cancelText: 'Закрыть'
            });
            return;
        }

        // Показываем, что идет процесс
        exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        exportBtn.disabled = true;

        generatePdf(proposedPlan);
    });

    async function generatePdf(plans) {
        const settings = DB.getSettings();
        const { jsPDF } = window.jspdf;

        // Обертка try...finally гарантирует, что кнопка будет разблокирована,
        // а контейнер очищен, даже если произойдет ошибка.
        try {
            const doc = new jsPDF({
                orientation: settings.pdfOrientation,
                unit: 'mm',
                format: 'a4'
            });

            exportContainer.innerHTML = generateHtmlForExport(plans, settings);

            // Помещаем контейнер за пределы видимой области, чтобы избежать моргания и перерисовки
            exportContainer.style.position = 'absolute';
            exportContainer.style.left = '-9999px';
            exportContainer.style.top = '0';
            exportContainer.style.display = 'block';

            const pages = exportContainer.querySelectorAll('.export-page');
            const imageQuality = settings.pdfImageQuality || 0.85;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Создаем массив промисов для рендеринга всех страниц
            const pagePromises = Array.from(pages).map(page =>
                html2canvas(page, {
                    scale: 1.5,
                    useCORS: true,
                    logging: false
                }).then(canvas => canvas.toDataURL('image/jpeg', imageQuality))
            );

            // Ждем, пока все страницы будут отрендерены параллельно
            const imagesData = await Promise.all(pagePromises);

            // Добавляем отрендеренные изображения в PDF
            imagesData.forEach((imgData, i) => {
                if (i > 0) {
                    doc.addPage();
                }
                // Указываем формат JPEG и используем быструю компрессию.
                doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            });


            const filename = generateFilename(settings.pdfFilename, plans) + '.pdf';
            doc.save(filename);

        } catch (error) {
            console.error('Ошибка при генерации PDF:', error);
            ConfirmationModal.show({
                title: 'Ошибка экспорта',
                message: 'Произошла ошибка при создании PDF. Пожалуйста, проверьте консоль для получения дополнительной информации.',
                hideConfirmButton: true,
                cancelText: 'Закрыть'
            });
        } finally {
            // Очищаем и скрываем контейнер
            exportContainer.innerHTML = '';
            exportContainer.removeAttribute('style'); // Сбрасываем все инлайн-стили
            exportContainer.style.display = 'none';
            // Возвращаем кнопку в исходное состояние
            exportBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i>';
            exportBtn.disabled = false;
        }
    }

    function generateFilename(template, plans) {
        const now = new Date();
        const date = now.toLocaleDateString('ru-RU');
        const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');

        let materialName = 'Раскрой'; // Имя по умолчанию
        const materialKeys = Object.keys(plans);

        if (materialKeys.length === 1) {
            const key = materialKeys[0];
            if (key === 'Основной|Материал') {
                materialName = 'Простой_режим';
            } else {
                // Заменяем недопустимые символы в имени файла
                materialName = key.replace('|', '_').replace(/[/\\?%*:|"<>]/g, '-');
            }
        } else if (materialKeys.length > 1) {
            materialName = 'Несколько_материалов';
        }

        return template
            .replace('{date}', date)
            .replace('{time}', time)
            .replace('{material}', materialName);
    }

    function generateHtmlForExport(plans, settings) {
        // --- Логика пагинации ---
        const ITEMS_PER_PAGE_PORTRAIT = 5;
        const ITEMS_PER_PAGE_LANDSCAPE = 3;
        const itemsPerPage = settings.pdfOrientation === 'l' ? ITEMS_PER_PAGE_LANDSCAPE : ITEMS_PER_PAGE_PORTRAIT;

        const generationDate = new Date().toLocaleString('ru-RU');
        const mainTitle = `<h1>План раскроя <span style="float: right; font-size: 14px; color: #666; font-weight: normal;">${generationDate}</span></h1>`;

        // 1. Собираем все элементы (карты раскроя), которые нужно отобразить
        // Этот шаг остается без изменений
        const allItemsToRender = [];
        for (const groupKey in plans) {
            const plan = plans[groupKey];
            const [category, type] = groupKey.split('|');
            const materialTitle = `<h2>${category} ${type}</h2>`;
            let isFirstItemInGroup = true;

            if (settings.pdfGroupBars) {
                const groupedPlans = {};
                plan.cutPlan.forEach(bar => {
                    const cutSignature = bar.cuts.map(c => c.length).sort((a, b) => b - a).join(',');
                    const signature = `${bar.originalLength}|${cutSignature}`;
                    if (!groupedPlans[signature]) {
                        groupedPlans[signature] = { bar, count: 0 };
                    }
                    groupedPlans[signature].count++;
                });
                Object.values(groupedPlans).forEach(group => {
                    const itemHtml = renderBarForExport(group.bar, group.count);
                    allItemsToRender.push({ html: itemHtml, title: materialTitle, isFirstInGroup: isFirstItemInGroup });
                    isFirstItemInGroup = false;
                });
            } else {
                plan.cutPlan.sort((a, b) => a.barId.localeCompare(b.barId)).forEach(bar => {
                    const itemHtml = renderBarForExport(bar, 1);
                    allItemsToRender.push({ html: itemHtml, title: materialTitle, isFirstInGroup: isFirstItemInGroup });
                    isFirstItemInGroup = false;
                });
            }
        }

        // 2. Формируем массив страниц с контентом
        const pagesContentArray = [];
        if (allItemsToRender.length === 0) {
            const summaryHtml = generateSummaryHtml(plans, settings);
            pagesContentArray.push(`<p>Нет карт раскроя для отображения.</p>${summaryHtml}`);
        } else {
            let currentPageItems = [];
            let itemsOnCurrentPage = 0;
            for (let i = 0; i < allItemsToRender.length; i++) {
                const item = allItemsToRender[i];
                // Если это первый элемент на странице и для него не был добавлен основной заголовок группы,
                // добавляем его как подзаголовок страницы.
                let pageSpecificTitle = '';
                if (itemsOnCurrentPage === 0 && !item.isFirstInGroup) {
                    pageSpecificTitle = `<h2 class="export-page-subtitle">${item.title.replace(/<h2.*?>|<\/h2>/g, '')}</h2>`;
                }
                const itemContent = (item.isFirstInGroup ? item.title : '') + item.html;
                currentPageItems.push(pageSpecificTitle + itemContent);
                itemsOnCurrentPage++;

                // Если страница заполнена или это последний элемент, "закрываем" страницу
                if (itemsOnCurrentPage === itemsPerPage || i === allItemsToRender.length - 1) {
                    let pageContent = currentPageItems.join('');
                    // Если это последняя страница, добавляем итоговый блок
                    if (i === allItemsToRender.length - 1) {
                        pageContent += generateSummaryHtml(plans, settings);
                    }
                    pagesContentArray.push(pageContent);
                    currentPageItems = [];
                    itemsOnCurrentPage = 0;
                }
            }
        }

        // 3. Собираем итоговый HTML, добавляя заголовок и нумерацию на каждую страницу
        const totalPages = pagesContentArray.length;
        const pageClass = settings.pdfOrientation === 'l' ? 'export-page landscape' : 'export-page';
        return pagesContentArray.map((content, index) => {
            // Добавляем класс для черно-белого режима, если опция включена
            const bwClass = settings.pdfIsBlackAndWhite ? 'bw-mode' : '';
            const fullContainerClass = `${pageClass} ${bwClass}`;

            const pageNum = index + 1;
            const pageNumHtml = `<div class="export-page-number">Страница ${pageNum} из ${totalPages}</div>`;
            return `<div class="${fullContainerClass}">${mainTitle}${content}${pageNumHtml}</div>`;
        }).join('');
    }

    function generateSummaryHtml(plans, settings) {
        if (!settings.pdfShowUnplaced) return '';

        let summaryHtml = '';
        const allUnplacedParts = Object.values(plans).flatMap(p => p.unplacedParts || []);

        if (allUnplacedParts.length > 0) {
            summaryHtml += '<h3>Неразмещенные заготовки</h3><ul>';
            const unplacedSummary = allUnplacedParts.reduce((acc, part) => {
                acc[part.length] = (acc[part.length] || 0) + 1;
                return acc;
            }, {});            
            Object.keys(unplacedSummary).sort((a, b) => b - a).forEach(length => {
                const part = allUnplacedParts.find(p => p.length == length);
                const label = part.name ? `${part.name} (${length} мм)` : `${length} мм`;
                summaryHtml += `<li>${label} x ${unplacedSummary[length]} шт.</li>`;
            });
            summaryHtml += '</ul>';
        }

        const deficitSettings = DB.getSettings();
        const deficitLengths = String(deficitSettings.deficitCalcLength).split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);
        if (deficitLengths.length > 0) {
            const deficitByMaterial = {};
            for (const groupKey in plans) {
                const plan = plans[groupKey];
                if (plan.unplacedParts && plan.unplacedParts.length > 0) {
                    const deficitResult = CuttingRenderer.calculateDeficit(plan.unplacedParts, deficitLengths, plan.kerf);
                    if (Object.keys(deficitResult).length > 0) {
                        deficitByMaterial[groupKey] = deficitResult;
                    }
                }
            }

            if (Object.keys(deficitByMaterial).length > 0) {
                summaryHtml += '<h3>Дефицит материала</h3><ul>';
                for (const groupKey in deficitByMaterial) {
                    const [category, type] = groupKey.split('|');
                    const needed = deficitByMaterial[groupKey];
                    summaryHtml += `<li><strong>${category} ${type}:</strong> ${Object.entries(needed).map(([len, count]) => `${count} шт. по ${len} мм`).join(', ')}</li>`;
                }
                summaryHtml += '</ul>';
            }
        }

        if (summaryHtml) {
            return `<div class="export-summary-block">${summaryHtml}</div>`;
        }
        return '';
    }

    function renderBarForExport(bar, count) {
        let html = '';
        const usedLength = bar.originalLength - bar.remnant;
        const title = count > 1 ? `Раскрой хлыста ${bar.originalLength} мм (x${count} шт.)` : `Раскрой хлыста ${bar.originalLength} мм`;

        html += `<h3>${title}</h3>`;
        html += '<div class="export-bar-visualization">';

        // Группируем последовательные одинаковые детали для экспорта
        const groupedCuts = [];
        if (bar.cuts.length > 0) {
            let currentGroup = { length: bar.cuts[0].length, count: 1 };
            for (let i = 1; i < bar.cuts.length; i++) {
                if (bar.cuts[i].length === currentGroup.length) {
                    currentGroup.count++;
                } else {
                    groupedCuts.push(currentGroup);
                    currentGroup = { length: bar.cuts[i].length, count: 1 };
                }
            }
            groupedCuts.push(currentGroup);
        }

        groupedCuts.forEach(group => {
            // Учитываем ширину реза между деталями в группе
            const kerf = DB.getSettings().kerf || 0;
            const totalGroupLength = (group.length * group.count) + (kerf * (group.count - 1));
            const width = (totalGroupLength / bar.originalLength) * 100;
            const fullLabel = group.count > 1 ? `${group.name || group.length}x${group.count}` : `${group.name || group.length}`;
            // Не отображаем текст, если отрезок слишком узкий (ширина < 4% от общей длины)
            const displayLabel = width > 4 ? fullLabel : '';
            html += `<div class="export-cut-piece" style="width: ${width}%">${displayLabel}</div>`;
        });

        if (bar.remnant > 0.01) { // Используем небольшую погрешность для чисел с плавающей точкой
            const width = (bar.remnant / bar.originalLength) * 100;
            // Не отображаем текст, если остаток слишком узкий
            const remnantLabel = width > 4 ? bar.remnant.toFixed(0) : '';
            html += `<div class="export-remnant-piece" style="width: ${width}%">${remnantLabel}</div>`;
        }
        html += '</div>';
        html += `<p class="export-bar-summary">Использовано: ${usedLength} мм, Остаток: ${bar.remnant} мм</p>`;

        const detailsSummary = bar.cuts.reduce((acc, part) => {
            const key = part.name ? `${part.name}|${part.length}` : `_${part.length}`;
            if (!acc[key]) acc[key] = { name: part.name, length: part.length, count: 0 };
            acc[key].count++;
            return acc;
        }, {});

        const sortedDetails = Object.values(detailsSummary).sort((a, b) => b.length - a.length);
        if (sortedDetails.length > 0) {
            html += '<div class="export-details-list"><h4>Спецификация:</h4><ul>';
            sortedDetails.forEach(item => {
                const label = item.name ? `${item.name} (${item.length} мм)` : `${item.length} мм`;
                html += `<li>- ${label} x ${item.count} шт.</li>`; });
            html += '</ul></div>';
        }
        return html;
    }
});