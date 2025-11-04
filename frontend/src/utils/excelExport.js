import ExcelJS from 'exceljs';
import pmcLogo from '../assets/pmc_logo.png';

/**
 * Helper function to sanitize cell values
 */
function sanitizeValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return '';
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

/**
 * Export data to Excel with neat, compact, and professionally aligned layout
 */
export async function exportToExcelWithLogo(data, filename, sheetName = 'Sheet1', options = {}) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // ========== 1. UNIFORM LAYOUT SETTINGS ==========
    // Set consistent column width and row height for balanced layout
    const uniformColumnWidth = 15;
    const uniformRowHeight = 18;
    
    // Set all columns to uniform width first
    for (let i = 1; i <= 10; i++) {
      worksheet.getColumn(i).width = uniformColumnWidth;
    }
    
    // Adjust column widths based on content (but keep compact)
    const columnWidths = {
      'A': 8,   // S.No
      'B': 12,  // Roll Number
      'C': 20,  // Student Name
      'D': 25,  // Email
      'E': 20,  // Class
      'F': 18,  // Faculty
      'G': 15,  // Total Working Days
      'H': 12,  // Days Present
      'I': 12,  // Days Absent
      'J': 12,  // Attendance %
      'K': 12   // Status
    };
    
    Object.keys(columnWidths).forEach(col => {
      worksheet.getColumn(col).width = columnWidths[col];
    });

    // Set uniform row height for all rows
    for (let i = 1; i <= 200; i++) {
      worksheet.getRow(i).height = uniformRowHeight;
    }

    // ========== 2. COMPACT LOGO AND TITLE AREA (MAX 3 ROWS) ==========
    let currentRow = 1;
    
    // Row 1: Logo and College Name (compact - 3 rows max)
    worksheet.mergeCells('A1:B3');
    
    // Insert logo in A1:B3
    try {
      const logoResponse = await fetch(pmcLogo);
      if (logoResponse && logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        if (logoBlob.size > 0 && logoBlob.size < 100000) {
          const logoArrayBuffer = await logoBlob.arrayBuffer();
          if (logoArrayBuffer && logoArrayBuffer.byteLength > 0) {
            const logoId = workbook.addImage({ 
              buffer: logoArrayBuffer, 
              extension: 'png' 
            });
            
            // Compact logo size: 140px × 60px
            worksheet.addImage(logoId, {
              tl: { col: 0.1, row: 0.1 },
              ext: { width: 140, height: 60 },
            });
          }
        }
      }
    } catch (logoError) {
      console.warn('Could not load logo:', logoError);
    }

    // College name in C1:K3 (compact, centered)
    worksheet.mergeCells('C1:K3');
    const headerCell = worksheet.getCell('C1');
    headerCell.value = 'ER. PERUMAL MANIMEKALAI COLLEGE OF ENGINEERING\n(An Autonomous Institution) - Approved by AICTE, Affiliated to Anna University';
    headerCell.font = { name: 'Calibri', size: 12, bold: true };
    headerCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    
    currentRow = 4;

    // ========== 3. REPORT TITLE AND DEPARTMENT INFO (SINGLE CONCISE ROW) ==========
    // Row 4: Report title and department info in single row
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const titleParts = [];
    if (options.reportTitle) titleParts.push(sanitizeValue(options.reportTitle));
    if (options.department) titleParts.push(`Dept: ${sanitizeValue(options.department)}`);
    if (options.batch) titleParts.push(`Batch: ${sanitizeValue(options.batch)}`);
    if (options.year) titleParts.push(`Year: ${sanitizeValue(options.year)}`);
    if (options.semester) titleParts.push(`Sem: ${sanitizeValue(options.semester)}`);
    if (options.section) titleParts.push(`Sec: ${sanitizeValue(options.section)}`);
    
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = titleParts.join(' | ');
    titleCell.font = { name: 'Calibri', size: 11, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow++;

    // ========== 4. TABLE HEADER (DARK BLUE, WHITE BOLD TEXT) ==========
    const tableStartRow = currentRow;
    const headerRow = worksheet.getRow(tableStartRow);
    
    if (data.length > 0) {
      // Use actual headers from data (preserve order)
      const headers = Object.keys(data[0]);
      
      // Write headers to Excel
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = sanitizeValue(header);
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } }; // Dark blue
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });
      
      headerRow.height = uniformRowHeight;

      // Freeze header row
      worksheet.views = [{ 
        state: 'frozen', 
        ySplit: tableStartRow, 
        activeCell: `A${tableStartRow + 1}`, 
        showGridLines: true 
      }];

      // ========== 5. DATA ROWS (LIGHT ALTERNATE SHADING, THIN BORDERS) ==========
      let dataRowNum = tableStartRow;
      
      data.forEach((row, index) => {
        dataRowNum++;
        const dataRow = worksheet.getRow(dataRowNum);
        dataRow.height = uniformRowHeight;
        
        // Light alternate shading: Even rows → light gray, Odd rows → white
        const isEvenRow = (index + 1) % 2 === 0;
        const rowFillColor = isEvenRow 
          ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }
          : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        
        // Map data to columns - use same order as headers
        headers.forEach((header, colIndex) => {
          const cell = dataRow.getCell(colIndex + 1);
          const value = sanitizeValue(row[header]);
          
          cell.value = value;
          cell.font = { name: 'Calibri', size: 11 };
          cell.fill = rowFillColor;
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          
          // Alignment: Left for names and emails, center for everything else
          const headerLower = String(header).toLowerCase();
          if (headerLower.includes('name') || headerLower.includes('email') || headerLower.includes('contact') || headerLower.includes('reason')) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
          } else {
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
          }
          
          // Format numbers
          if (typeof value === 'number') {
            if (headerLower.includes('percentage') || headerLower.includes('%') || headerLower.includes('attendance %')) {
              cell.numFmt = '0.0';
            } else if (headerLower.includes('days') || headerLower.includes('working') || headerLower.includes('present') || headerLower.includes('absent')) {
              cell.numFmt = '0';
            }
          }
        });
      });
    }

    // ========== 6. SUMMARY ROW (SINGLE LINE, CENTERED) ==========
    if (options.summary && data.length > 0) {
      const headers = Object.keys(data[0]);
      const numColumns = headers.length;
      const lastColumn = String.fromCharCode(64 + numColumns); // Convert to letter (A=65)
      
      // Ensure dataRowNum is defined
      let summaryRowNum = tableStartRow + data.length + 1;
      const summaryRow = worksheet.getRow(summaryRowNum);
      summaryRow.height = uniformRowHeight;
      
      // Merge all cells for summary
      worksheet.mergeCells(`A${summaryRowNum}:${lastColumn}${summaryRowNum}`);
      const summaryCell = worksheet.getCell(`A${summaryRowNum}`);
      
      const summaryParts = [];
      summaryParts.push('Summary');
      if (options.summary.totalStudents !== undefined && options.summary.totalStudents !== null) {
        summaryParts.push(`Total Students: ${sanitizeValue(options.summary.totalStudents)}`);
      }
      if (options.summary.totalPresent !== undefined && options.summary.totalPresent !== null) {
        summaryParts.push(`Total Present: ${sanitizeValue(options.summary.totalPresent)}`);
      }
      if (options.summary.totalAbsent !== undefined && options.summary.totalAbsent !== null) {
        summaryParts.push(`Total Absent: ${sanitizeValue(options.summary.totalAbsent)}`);
      }
      if (options.summary.averageAttendance !== undefined && options.summary.averageAttendance !== null) {
        const avgValue = typeof options.summary.averageAttendance === 'number' 
          ? options.summary.averageAttendance.toFixed(1) 
          : sanitizeValue(options.summary.averageAttendance);
        summaryParts.push(`Avg Attendance: ${avgValue}%`);
      }
      if (options.summary.overallStatus) {
        summaryParts.push(`Status: ${sanitizeValue(options.summary.overallStatus)}`);
      }
      
      summaryCell.value = summaryParts.join(' | ');
      summaryCell.font = { name: 'Calibri', size: 11, bold: true };
      summaryCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      summaryCell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    }

    // ========== 7. FINAL POLISH - ENSURE CONSISTENCY ==========
    // Remove any unnecessary merged cells or empty rows
    // Ensure all cells have consistent borders and alignment
    
    // Generate filename
    let finalFilename = String(filename || 'Report');
    if (options.batch && options.year && options.semester && options.section) {
      const dateStr = new Date().toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }).replace(/\//g, '-');
      finalFilename = `${finalFilename}_${sanitizeValue(options.batch)}_${sanitizeValue(options.year)}_${sanitizeValue(options.semester)}_${sanitizeValue(options.section)}_${dateStr}`;
    } else {
      finalFilename = `${finalFilename}_${new Date().toISOString().split('T')[0]}`;
    }

    // ========== 8. SAVE WITH INTEGRITY ==========
    // Write workbook to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('Generated Excel buffer is empty');
    }

    // Validate buffer size
    if (buffer.byteLength < 1000) {
      throw new Error('Generated Excel file appears to be corrupted (too small)');
    }

    // Create blob and download
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${finalFilename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);

    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
}

export async function exportToExcelFallback(data, filename, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
