/**
 * Class Identity Normalization Service
 * Ensures consistent classId generation and validation across all systems
 */

/**
 * Normalizes class components to ensure consistent formatting
 * @param {Object} classData - Class data object
 * @returns {Object} - Normalized class data
 */
export function normalizeClassComponents(classData) {
  const { batch, year, semester, section } = classData;
  
  // Normalize batch format (YYYY-YYYY)
  const normalizedBatch = normalizeBatch(batch);
  
  // Normalize year format (1st Year, 2nd Year, etc.)
  const normalizedYear = normalizeYear(year);
  
  // Normalize semester format (Sem 1, Sem 2, etc.)
  const normalizedSemester = normalizeSemester(semester);
  
  // Normalize section format (A, B, C)
  const normalizedSection = normalizeSection(section);
  
  return {
    batch: normalizedBatch,
    year: normalizedYear,
    semester: normalizedSemester,
    section: normalizedSection
  };
}

/**
 * Generates a standardized classId using the deterministic pattern
 * @param {Object} classData - Class data object
 * @returns {string} - Standardized classId
 */
export function generateClassId(classData) {
  const normalized = normalizeClassComponents(classData);
  return `${normalized.batch}_${normalized.year}_${normalized.semester}_${normalized.section}`;
}

/**
 * Normalizes batch format to YYYY-YYYY
 * @param {string|number} batch - Input batch
 * @returns {string} - Normalized batch
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
  
  // If single year, assume 4-year program
  if (/^\d{4}$/.test(batchStr)) {
    const startYear = parseInt(batchStr);
    return `${startYear}-${startYear + 4}`;
  }
  
  return batchStr;
}

/**
 * Normalizes year format to "Xst Year" format
 * @param {string|number} year - Input year
 * @returns {string} - Normalized year
 */
function normalizeYear(year) {
  if (!year) return '';
  
  const yearStr = String(year).trim();
  
  // If already in correct format, return as is
  if (/^\d+(st|nd|rd|th)\s+Year$/i.test(yearStr)) {
    return yearStr.replace(/\s+/g, ' ');
  }
  
  // If just number, convert to ordinal
  if (/^\d+$/.test(yearStr)) {
    const num = parseInt(yearStr);
    const ordinal = getOrdinal(num);
    return `${ordinal} Year`;
  }
  
  // If in format like "1st", "2nd", etc., add "Year"
  if (/^\d+(st|nd|rd|th)$/i.test(yearStr)) {
    return `${yearStr} Year`;
  }
  
  return yearStr;
}

/**
 * Normalizes semester format to "Sem X" format
 * @param {string|number} semester - Input semester
 * @returns {string} - Normalized semester
 */
function normalizeSemester(semester) {
  if (!semester && semester !== 0) return '';
  
  const semesterStr = String(semester).trim();
  
  // If already in "Sem X" format, return as is
  if (/^Sem\s*\d+$/i.test(semesterStr)) {
    const num = semesterStr.match(/\d+/)?.[0];
    return `Sem ${num}`;
  }
  
  // If just number, add "Sem" prefix
  if (/^\d+$/.test(semesterStr)) {
    return `Sem ${semesterStr}`;
  }
  
  return semesterStr;
}

/**
 * Normalizes section format to single letter
 * @param {string} section - Input section
 * @returns {string} - Normalized section
 */
function normalizeSection(section) {
  if (!section) return 'A';
  
  const sectionStr = String(section).trim().toUpperCase();
  
  // If single letter, return as is
  if (/^[A-Z]$/.test(sectionStr)) {
    return sectionStr;
  }
  
  // If starts with letter, extract first letter
  const match = sectionStr.match(/^([A-Z])/);
  if (match) {
    return match[1];
  }
  
  return 'A'; // Default to A
}

/**
 * Gets ordinal suffix for numbers
 * @param {number} num - Number
 * @returns {string} - Ordinal suffix
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
 * Validates if a classId follows the correct format
 * @param {string} classId - ClassId to validate
 * @returns {boolean} - Whether classId is valid
 */
export function validateClassIdFormat(classId) {
  if (!classId || typeof classId !== 'string') {
    return false;
  }
  
  const parts = classId.split('_');
  if (parts.length !== 4) {
    return false;
  }
  
  const [batch, year, semester, section] = parts;
  
  // Validate batch format (YYYY-YYYY)
  if (!/^\d{4}-\d{4}$/.test(batch)) {
    return false;
  }
  
  // Validate year format (Xst Year)
  if (!/^\d+(st|nd|rd|th)\s+Year$/.test(year)) {
    return false;
  }
  
  // Validate semester format (Sem X)
  if (!/^Sem\s*\d+$/.test(semester)) {
    return false;
  }
  
  // Validate section format (A, B, C)
  if (!/^[A-Z]$/.test(section)) {
    return false;
  }
  
  return true;
}

/**
 * Parses a classId into its components
 * @param {string} classId - ClassId to parse
 * @returns {Object|null} - Parsed components or null if invalid
 */
export function parseClassId(classId) {
  if (!validateClassIdFormat(classId)) {
    return null;
  }
  
  const parts = classId.split('_');
  return {
    batch: parts[0],
    year: parts[1],
    semester: parts[2],
    section: parts[3]
  };
}
