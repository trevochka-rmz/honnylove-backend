// src/controllers/productExportController.js
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { generateExportData } = require('../services/productExportService');

/**
 * Экспорт продуктов в PDF (ручная таблица без pdfkit-table)
 */
const exportProductsToPDF = async (req, res, next) => {
  try {
    const products = await generateExportData(req.query);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 30, // Уменьшили margins для больше места
      layout: 'landscape'
    });

    // Шрифты
    let fontRegular = 'Helvetica';
    let fontBold = 'Helvetica-Bold';
    const regularPath = path.join(__dirname, '../fonts/PTSerif-Regular.ttf');
    const boldPath = path.join(__dirname, '../fonts/PTSerif-Bold.ttf');
    if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
      doc.registerFont('FontRegular', fs.readFileSync(regularPath));
      doc.registerFont('FontBold', fs.readFileSync(boldPath));
      fontRegular = 'FontRegular';
      fontBold = 'FontBold';
    } else {
      console.warn('Шрифты PT Serif не найдены. Используем Helvetica.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    // Заголовок слева сверху (только дата и количество, без "ЭКСПОРТ ПРОДУКТОВ")
    doc.font(fontRegular).fontSize(8) // Маленький шрифт для заголовка
      .text(`Дата экспорта: ${new Date().toLocaleDateString('ru-RU')}`, doc.page.margins.left, doc.page.margins.top)
      .text(`Всего продуктов: ${products.length}`, doc.page.margins.left, doc.page.margins.top + 10);

    // Параметры таблицы (начинаем ниже заголовка)
    let tableTop = doc.page.margins.top + 30; // Ниже заголовка
    const cellPadding = 3; // Меньше padding
    const fontSize = 8; // Меньше шрифт для больше строк
    const baseRowHeight = fontSize * 1.2 + cellPadding * 2; // Оптимизированная высота
    const pageHeight = doc.page.height - doc.page.margins.bottom;
    let columnWidths = [25, 200, 100, 120, 80, 50]; // Увеличили для имени/категории, цена без "розничная"
    let headers = ['№', 'Название', 'Бренд', 'Категория', 'Цена', 'Кол-во'];

    if (products.length > 0 && products[0].showStatus) {
      columnWidths = [25, 180, 90, 110, 80, 100, 50]; // С статусом
      headers = ['№', 'Название', 'Бренд', 'Категория', 'Цена', 'Статус', 'Кол-во'];
    }

    // Общая ширина таблицы (для закрытия)
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);

    // Функция для рисования горизонтальной линии
    const drawHorizontalLine = (y) => {
      doc.moveTo(doc.page.margins.left, y)
         .lineTo(doc.page.margins.left + tableWidth, y) // Только ширина таблицы
         .stroke();
    };

    // Функция для рисования вертикальных линий на текущей странице
    const drawVerticalLines = (yStart, yEnd) => {
      let x = doc.page.margins.left;
      columnWidths.forEach(width => {
        doc.moveTo(x, yStart).lineTo(x, yEnd).stroke();
        x += width;
      });
    };

    // Рисуем заголовок таблицы
    let currentY = tableTop;
    doc.font(fontBold).fontSize(fontSize);
    let xPos = doc.page.margins.left;
    headers.forEach((header, colIndex) => {
      const priceColumnIndex = headers.indexOf('Цена');
      doc.text(header, xPos + cellPadding, currentY + cellPadding, {
        width: columnWidths[colIndex] - cellPadding * 2,
        align: colIndex === 0 || colIndex === headers.length - 1 ? 'center' : colIndex === priceColumnIndex ? 'right' : 'left'
      });
      xPos += columnWidths[colIndex];
    });
    const headerBottom = currentY + baseRowHeight;
    drawHorizontalLine(tableTop);
    drawHorizontalLine(headerBottom);
    drawVerticalLines(tableTop, headerBottom);
    currentY = headerBottom;

    // Рисуем строки данных
    doc.font(fontRegular).fontSize(fontSize);
    products.forEach((product, index) => {
      // Проверяем, нужно ли добавить новую страницу
      let maxRowHeight = baseRowHeight;
      const rowData = [
        (index + 1).toString(),
        product.name,
        product.brand,
        product.category,
        product.priceDisplay,
      ];
      if (product.showStatus) rowData.push(product.status);
      rowData.push(product.stock.toString());

      // Рассчитываем высоту заранее, чтобы проверить overflow
      xPos = doc.page.margins.left;
      rowData.forEach((cell, colIndex) => {
        const textHeight = doc.heightOfString(cell, {
          width: columnWidths[colIndex] - cellPadding * 2
        }) + cellPadding * 2;
        if (textHeight > maxRowHeight) maxRowHeight = textHeight;
      });

      if (currentY + maxRowHeight > pageHeight) {
        drawVerticalLines(tableTop, currentY); // Закрываем вертикали на текущей странице
        doc.addPage();
        currentY = doc.page.margins.top;
        tableTop = currentY; // Новый top для вертикалей
        // Перерисовываем заголовок на новой странице
        xPos = doc.page.margins.left;
        doc.font(fontBold).fontSize(fontSize);
        headers.forEach((header, colIndex) => {
          const priceColumnIndex = headers.indexOf('Цена');
          doc.text(header, xPos + cellPadding, currentY + cellPadding, {
            width: columnWidths[colIndex] - cellPadding * 2,
            align: colIndex === 0 || colIndex === headers.length - 1 ? 'center' : colIndex === priceColumnIndex ? 'right' : 'left'
          });
          xPos += columnWidths[colIndex];
        });
        const newHeaderBottom = currentY + baseRowHeight;
        drawHorizontalLine(currentY);
        drawHorizontalLine(newHeaderBottom);
        drawVerticalLines(currentY, newHeaderBottom);
        currentY = newHeaderBottom;
      }

      // Рисуем текст в ячейках
      xPos = doc.page.margins.left;
      rowData.forEach((cell, colIndex) => {
        const priceColumnIndex = headers.indexOf('Цена');
        doc.text(cell, xPos + cellPadding, currentY + cellPadding, {
          width: columnWidths[colIndex] - cellPadding * 2,
          align: colIndex === 0 || colIndex === rowData.length - 1 ? 'center' : colIndex === priceColumnIndex ? 'right' : 'left'
        });
        xPos += columnWidths[colIndex];
      });

      // Горизонтальная линия под строкой
      drawHorizontalLine(currentY + maxRowHeight);

      currentY += maxRowHeight;
    });

    // Финальные вертикальные линии для всей таблицы (закрываем до последней строки)
    drawVerticalLines(tableTop, currentY);

    doc.end();
  } catch (error) {
    console.error('Ошибка генерации PDF:', error);
    next(error);
  }
};

/**
 * Экспорт продуктов в CSV
 */
const exportProductsToCSV = async (req, res, next) => {
  try {
    const products = await generateExportData(req.query);
    let headers = ['ID', 'Название', 'Бренд', 'Категория', 'Цена', 'Количество'];
    if (products.length > 0 && products[0].showStatus) {
      headers = ['ID', 'Название', 'Бренд', 'Категория', 'Цена', 'Статус', 'Количество'];
    }
    let csvContent = '\uFEFF';
    csvContent += headers.join(';') + '\n';
    products.forEach(product => {
      let row = [
        product.id,
        `"${product.name.replace(/"/g, '""')}"`,
        `"${product.brand.replace(/"/g, '""')}"`,
        `"${product.category.replace(/"/g, '""')}"`,
        `"${product.priceDisplay.replace(/"/g, '""')}"`,
      ];
      if (product.showStatus) row.push(`"${product.status.replace(/"/g, '""')}"`);
      row.push(product.stock);
      csvContent += row.join(';') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportProductsToPDF,
  exportProductsToCSV
};