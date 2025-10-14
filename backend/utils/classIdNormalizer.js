/**
 * Class ID Normalization Utility
 * Ensures consistent classId format across all systems
 */

/**
 * Normalizes classId components to ensure consistent format
 * @param {Object} classData - Class data object
 * @param {string} classData.batch - Batch (e.g., "2022-2026")
 * @param {string} classData.year - Year (e.g., "1st Year", "1st", "1")
 * @param {string|number} classData.semester - Semester (e.g., "Sem 1", "1", 1)
 * @param {string} classData.section - Section (e.g., "A", "B", "C")
 * @returns {string} Normalized classId
 */
export function normalizeClassId(classData) {
  const { batch, year, semester, section } = classData;
  
  // Normalize batch - ensure YYYY-YYYY format
  const normalizedBatch = normalizeBatch(batch);
  
  // Normalize year - ensure "Xst Year" format
  const normalizedYear = normalizeYear(year);
  
  // Normalize semester - ensure "Sem X" format
  const normalizedSemester = normalizeSemester(semester);
  
  // Normalize section - ensure single letter uppercase
  const normalizedSection = normalizeSection(section);
  
  // Generate classId: batch_year_semester_section
  return `${normalizedBatch}_${normalizedYear}_${normalizedSemester}_${normalizedSection}`;
}

/**
 * Normalizes batch to YYYY-YYYY format
 */
function normalizeBatch(batch) {
  if (!batch) return '';
  
  const batchStr = String(batch).trim();
  
  // If already in YYYY-YYYY format, return as is
  if (/^\d{4}-\d{4}$/.test(batchStr)) {
    return batchStr;
  }
  
  // If in YYYY_YYYY format, convert to YYYY-YYYY
  if (/^\d{4}_\d{4}$/.test(batchStr)) {
    return batchStr.replace('_', '-');
  }
  
  // If single year, assume 4-year span
  if (/^\d{4}$/.test(batchStr)) {
    const startYear = parseInt(batchStr);
    return `${startYear}-${startYear + 4}`;
  }
  
  return batchStr;
}

/**
 * Normalizes year to "Xst Year" format
 */
function normalizeYear(year) {
  if (!year) return '1st Year';
  
  const yearStr = String(year).trim();
  
  // If already in "Xst Year" format, return as is
  if (/^\d+(st|nd|rd|th)\s+Year$/i.test(yearStr)) {
    return yearStr.replace(/\s+/g, ' ');
  }
  
  // If in "Xst" format, add "Year"
  if (/^\d+(st|nd|rd|th)$/i.test(yearStr)) {
    return `${yearStr} Year`;
  }
  
  // If just number, convert to ordinal
  if (/^\d+$/.test(yearStr)) {
    const num = parseInt(yearStr);
    const ordinal = getOrdinal(num);
    return `${ordinal} Year`;
  }
  
  return yearStr;
}

/**
 * Normalizes semester to "Sem X" format
 */
function normalizeSemester(semester) {
  if (!semester && semester !== 0) return 'Sem 1';
  
  const semesterStr = String(semester).trim();
  
  // If already in "Sem X" format, return as is
  if (/^Sem\s*\d+$/i.test(semesterStr)) {
    const num = semesterStr.match(/\d+/)?.[0];
    return `Sem ${num}`;
  }
  
  // If just number, add "Sem"
  if (/^\d+$/.test(semesterStr)) {
    return `Sem ${semesterStr}`;
  }
  
  return semesterStr;
}

/**
 * Normalizes section to single uppercase letter
 */
function normalizeSection(section) {
  if (!section) return 'A';
  
  const sectionStr = String(section).trim().toUpperCase();
  
  // If single letter, return uppercase
  if (/^[A-Z]$/.test(sectionStr)) {
    return sectionStr;
  }
  
  // If multiple characters, take first letter
  if (sectionStr.length > 0) {
    return sectionStr[0];
  }
  
  return 'A';
}

/**
 * Gets ordinal number (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinal(num) {
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) {
    return num + "st";
  }
  if (j === 2 && k !== 12) {
    return num + "nd";
  }
  if (j === 3 && k !== 13) {
    return num + "rd";
  }
  return num + "th";
}

/**
 * Parses a classId back to its components
 * @param {string} classId - Normalized classId
 * @returns {Object} Parsed components
 */
export function parseClassId(classId) {
  if (!classId) {
    return {
      batch: '',
      year: '',
      semester: '',
      section: '',
      isValid: false
    };
  }
  
  const parts = classId.split('_');
  
  if (parts.length !== 4) {
    return {
      batch: '',
      year: '',
      semester: '',
      section: '',
      isValid: false
    };
  }
  
  const [batch, year, semester, section] = parts;
  
  return {
    batch,
    year,
    semester,
    section,
    isValid: true
  };
}

/**
 * Validates if a classId follows the correct format
 * @param {string} classId - ClassId to validate
 * @returns {boolean} True if valid format
 */
export function isValidClassId(classId) {
  if (!classId || typeof classId !== 'string') {
    return false;
  }
  
  const parsed = parseClassId(classId);
  return parsed.isValid;
}
