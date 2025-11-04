import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addLogoAndTitleBlock(worksheet, logoPath = null) {
  // Baseline columns
  for (let i = 1; i <= 12; i++) worksheet.getColumn(i).width = 15;

  // Row heights 1..3
  worksheet.getRow(1).height = 25;
  worksheet.getRow(2).height = 25;
  worksheet.getRow(3).height = 20;

  // Merge cells for previous header (logo A1:B3, title C1:I3)
  worksheet.mergeCells('A1:B3');
  worksheet.mergeCells('C1:I3');

  // Resolve logo buffer
  const candidates = [
    logoPath,
    path.join(__dirname, '../public/PMC.png'),
    path.join(__dirname, '../public/pmc_logo.png'),
    path.join(__dirname, '../public/pmc-logo.png'),
    path.join(process.cwd(), 'frontend/src/assets/PMC.png'),
    path.join(process.cwd(), 'frontend/src/assets/pmc_logo.png'),
    path.join(process.cwd(), 'frontend/public/PMC.png'),
    path.join(process.cwd(), 'frontend/public/pmc-logo.png'),
    path.join(process.cwd(), 'frontend/public/pmc_logo.png'),
  ].filter(Boolean);

  let buffer = null;
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) { buffer = fs.readFileSync(p); break; } } catch {}
  }

  if (buffer) {
    const imageId = worksheet.workbook.addImage({ buffer, extension: 'png' });
    const desiredHeightPx = Math.round((2.0 / 2.54) * 96);
    const aspectRatio = 3.2; // width/height
    const logoHeightPx = desiredHeightPx;
    const logoWidthPx = Math.round(logoHeightPx * aspectRatio);

    const colPx = 64;
    const row1Px = worksheet.getRow(1).height * 1.333;
    const row2Px = worksheet.getRow(2).height * 1.333;
    const row3Px = worksheet.getRow(3).height * 1.333;
    const totalHeaderPx = row1Px + row2Px + row3Px;

    const verticalOffsetRows = Math.max(0, (totalHeaderPx - logoHeightPx) / ((row1Px + row2Px + row3Px) / 3)) / 3;
    const horizontalStartCol = Math.max(0, (2 - (logoWidthPx / colPx)) / 2);

    worksheet.addImage(imageId, {
      tl: { col: horizontalStartCol, row: verticalOffsetRows },
      ext: { width: logoWidthPx, height: logoHeightPx },
    });
  }

  // Title rich text in C1 (merged C1:I3)
  const titleCell = worksheet.getCell('C1');
  titleCell.value = {
    richText: [
      { text: 'ER. PERUMAL MANIMEKALAI COLLEGE OF ENGINEERING', font: { name: 'Calibri', size: 14, bold: true } },
      { text: '\n(An Autonomous Institution)', font: { name: 'Calibri', size: 11, italic: true } },
      { text: '\nApproved by AICTE, New Delhi, Affiliated to Anna University', font: { name: 'Calibri', size: 10 } },
    ],
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

async function createWorksheetWithLogo(workbook, sheetName, options = {}) {
  const worksheet = workbook.addWorksheet(sheetName);
  await addLogoAndTitleBlock(worksheet, options.logoPath || null);

  // Table starts on row 4
  let currentRow = 4;

  if (options.headers && Array.isArray(options.headers)) {
    const headerRow = worksheet.getRow(currentRow);
    options.headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } };
    });
    headerRow.height = 22;
    worksheet.views = [{ state: 'frozen', ySplit: currentRow, activeCell: `A${currentRow + 1}`, showGridLines: true }];
    currentRow++;
  }

  if (options.data && Array.isArray(options.data)) {
    options.data.forEach((row) => {
      const dataRow = worksheet.getRow(currentRow);
      row.forEach((value, index) => {
        const cell = dataRow.getCell(index + 1);
        cell.value = value ?? '';
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };

        if (typeof value === 'number') {
          cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }
      });
      dataRow.height = 18;
      currentRow++;
    });
  }

  worksheet.columns.forEach((column) => {
    if (column.eachCell) {
      let maxLength = 0;
      column.eachCell({ includeEmpty: false }, (cell) => {
        let len = 10;
        if (cell.value !== null && cell.value !== undefined) {
          len = cell.value.toString().length;
        }
        if (len > maxLength) maxLength = len;
      });
      column.width = Math.min(Math.max(maxLength + 3, 12), 50);
    }
  });

  return worksheet;
}

export { addLogoAndTitleBlock as addLogoToWorksheet, createWorksheetWithLogo };
