// src/controllers/productExportController.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateProductsPDF } = require('../services/productExportService');

/**
 * Экспорт продуктов в PDF
 */
const exportProductsToPDF = async (req, res, next) => {
  try {
    const products = await generateProductsPDF(req.query);
    
    // Создаем PDF документ
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      layout: 'landscape'
    });
    
    // Регистрируем шрифты для кириллицы
    const fontPath = path.join(__dirname, '../../fonts');
    
    // Если шрифты есть - используем их, иначе Times-Roman
    let fontRegular = 'Times-Roman';
    let fontBold = 'Times-Bold';
    
    try {
      if (fs.existsSync(path.join(fontPath, 'NotoSans-Regular.ttf'))) {
        fontRegular = path.join(fontPath, 'NotoSans-Regular.ttf');
        fontBold = path.join(fontPath, 'NotoSans-Bold.ttf');
        doc.registerFont('NotoSans', fontRegular);
        doc.registerFont('NotoSans-Bold', fontBold);
        fontRegular = 'NotoSans';
        fontBold = 'NotoSans-Bold';
      }
    } catch (error) {
      console.log('Шрифты Noto не найдены, используем Times-Roman');
    }
    
    // Устанавливаем заголовки
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.pdf"`);
    
    doc.pipe(res);
    
    // Заголовок документа
    doc.font(fontBold)
       .fontSize(20)
       .text('ЭКСПОРТ ПРОДУКТОВ', { align: 'center' })
       .moveDown();
    
    doc.font(fontRegular)
       .fontSize(10)
       .text(`Дата экспорта: ${new Date().toLocaleDateString('ru-RU')}`, { align: 'center' })
       .text(`Всего продуктов: ${products.length}`, { align: 'center' })
       .moveDown(2);
    
    // Создаем таблицу
    const tableTop = 150;
    const tableLeft = 30;
    const rowHeight = 30;
    const colWidths = [30, 80, 100, 100, 80, 80, 120, 50];
    
    // Заголовки таблицы
    const headers = ['№', 'Фото', 'Название', 'Бренд', 'Категория', 'Цена', 'Статус', 'Кол-во'];
    
    // Рисуем заголовки
    doc.font(fontBold).fontSize(10);
    let x = tableLeft;
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, {
        width: colWidths[i],
        align: i === 0 ? 'center' : 'left'
      });
      x += colWidths[i];
    });
    
    // Горизонтальная линия под заголовками
    doc.moveTo(tableLeft, tableTop + 20)
       .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 20)
       .stroke();
    
    // Данные таблицы
    doc.font(fontRegular).fontSize(9);
    let y = tableTop + 30;
    
    products.forEach((product, index) => {
      const rowData = [
        (index + 1).toString(),
        '', // Фото - пропускаем в PDF
        product.name,
        product.brand,
        product.category,
        product.priceDisplay,
        product.status,
        product.stock.toString()
      ];
      
      let x = tableLeft;
      rowData.forEach((cell, i) => {
        doc.text(cell || '', x, y, {
          width: colWidths[i],
          align: i === 0 ? 'center' : 'left'
        });
        x += colWidths[i];
      });
      
      // Горизонтальная линия между строками
      doc.moveTo(tableLeft, y + rowHeight - 10)
         .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), y + rowHeight - 10)
         .strokeColor('#cccccc')
         .stroke();
      
      y += rowHeight;
      
      // Если страница заполнена, создаем новую
      if (y > 700) {
        doc.addPage();
        y = 50;
        
        // Повторяем заголовки на новой странице
        doc.font(fontBold).fontSize(10);
        x = tableLeft;
        headers.forEach((header, i) => {
          doc.text(header, x, y, {
            width: colWidths[i],
            align: i === 0 ? 'center' : 'left'
          });
          x += colWidths[i];
        });
        y += 30;
        doc.font(fontRegular).fontSize(9);
      }
    });
    
    doc.end();
    
  } catch (error) {
    next(error);
  }
};


/**
 * Экспорт продуктов в CSV (альтернатива)
 */
const exportProductsToCSV = async (req, res, next) => {
  try {
    const products = await generateProductsPDF(req.query);
    
    const headers = ['ID', 'Название', 'Бренд', 'Категория', 'Цена', 'Цена со скидкой', 'Статус', 'Количество'];
    
    let csvContent = '\uFEFF'; // BOM для Excel
    csvContent += headers.join(';') + '\n';
    
    products.forEach(product => {
      const row = [
        product.id,
        `"${product.name}"`,
        `"${product.brand}"`,
        `"${product.category}"`,
        product.price,
        product.discountPrice || '',
        `"${product.status}"`,
        product.stock
      ];
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