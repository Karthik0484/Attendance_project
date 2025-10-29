/**
 * Holiday Management Service
 * Handles holiday-related business logic and analytics integration
 */

import Holiday from '../models/Holiday.js';
import ClassAttendance from '../models/ClassAttendance.js';

/**
 * Get holidays for a specific class and date range
 */
export async function getHolidaysForClass(options) {
  const { 
    batchYear, 
    section, 
    semester, 
    department, 
    startDate, 
    endDate 
  } = options;

  try {
    const start = new Date(startDate).toISOString().split('T')[0];
    const end = new Date(endDate).toISOString().split('T')[0];

    const query = {
      department,
      isActive: true,
      isDeleted: false,
      date: { $gte: start, $lte: end },
      $or: [
        { scope: 'global' },
        {
          scope: 'class',
          batchYear,
          section,
          semester
        }
      ]
    };

    const holidays = await Holiday.find(query)
      .select('date reason scope batchYear section semester')
      .sort({ date: 1 });

    console.log('📅 Holidays for class:', {
      batchYear,
      section,
      semester,
      department,
      dateRange: { start, end },
      foundHolidays: holidays.length
    });

    return {
      success: true,
      data: holidays
    };

  } catch (error) {
    console.error('Error fetching holidays for class:', error);
    return {
      success: false,
      error: {
        message: 'Failed to fetch holidays',
        code: 'HOLIDAY_FETCH_ERROR'
      }
    };
  }
}

/**
 * Check if a specific date is a holiday for a class
 */
export async function isHoliday(options) {
  const { 
    date, 
    batchYear, 
    section, 
    semester, 
    department 
  } = options;

  try {
    const checkDate = new Date(date).toISOString().split('T')[0];

    const query = {
      date: checkDate,
      department,
      isActive: true,
      isDeleted: false,
      $or: [
        { scope: 'global' },
        {
          scope: 'class',
          batchYear,
          section,
          semester
        }
      ]
    };

    const holiday = await Holiday.findOne(query)
      .populate('declaredBy', 'name');

    return {
      success: true,
      data: {
        isHoliday: !!holiday,
        holiday: holiday ? {
          holidayId: holiday.holidayId,
          date: holiday.date,
          reason: holiday.reason,
          scope: holiday.scope,
          declaredBy: holiday.declaredBy.name
        } : null
      }
    };

  } catch (error) {
    console.error('Error checking holiday status:', error);
    return {
      success: false,
      error: {
        message: 'Failed to check holiday status',
        code: 'HOLIDAY_CHECK_ERROR'
      }
    };
  }
}

/**
 * Validate holiday declaration before saving
 */
export async function validateHolidayDeclaration(options) {
  const { 
    date, 
    batchYear, 
    section, 
    semester, 
    department, 
    scope = 'class' 
  } = options;

  try {
    const holidayDate = new Date(date).toISOString().split('T')[0];

    // Check if attendance already exists for this date and class
    if (scope === 'class') {
      const classId = `${batchYear}_${department}_${semester}_${section}`;
      const existingAttendance = await ClassAttendance.findOne({
        classId,
        date: holidayDate,
        isDeleted: false
      });

      if (existingAttendance) {
        return {
          success: false,
          error: {
            message: 'Attendance already marked for this date. Cannot declare holiday.',
            code: 'ATTENDANCE_EXISTS'
          }
        };
      }
    }

    // Check if holiday already exists
    const existingHolidayQuery = {
      date: holidayDate,
      department,
      isActive: true,
      isDeleted: false
    };

    if (scope === 'class') {
      existingHolidayQuery.batchYear = batchYear;
      existingHolidayQuery.section = section;
      existingHolidayQuery.semester = semester;
    } else {
      existingHolidayQuery.scope = 'global';
    }

    const existingHoliday = await Holiday.findOne(existingHolidayQuery);

    if (existingHoliday) {
      return {
        success: false,
        error: {
          message: 'Holiday already declared for this date',
          code: 'HOLIDAY_EXISTS'
        }
      };
    }

    return {
      success: true,
      data: { valid: true }
    };

  } catch (error) {
    console.error('Error validating holiday declaration:', error);
    return {
      success: false,
      error: {
        message: 'Failed to validate holiday declaration',
        code: 'HOLIDAY_VALIDATION_ERROR'
      }
    };
  }
}

/**
 * Calculate working days excluding holidays
 */
export function calculateWorkingDays(startDate, endDate, holidays = []) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const holidayDates = new Set(holidays.map(h => h.date));

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dateString = current.toISOString().split('T')[0];
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Skip holidays
      if (!holidayDates.has(dateString)) {
        workingDays++;
      }
    }
    
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

/**
 * Get holiday count for analytics
 */
export async function getHolidayCountForAnalytics(options) {
  const { 
    batchYear, 
    section, 
    semester, 
    department, 
    startDate, 
    endDate 
  } = options;

  try {
    const result = await getHolidaysForClass({
      batchYear,
      section,
      semester,
      department,
      startDate,
      endDate
    });

    if (!result.success) {
      return result;
    }

    const holidays = result.data;
    const workingDays = calculateWorkingDays(startDate, endDate, holidays);

    return {
      success: true,
      data: {
        holidayCount: holidays.length,
        workingDays,
        totalDays: Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1,
        holidays: holidays.map(h => ({
          date: h.date,
          reason: h.reason,
          scope: h.scope
        }))
      }
    };

  } catch (error) {
    console.error('Error getting holiday count for analytics:', error);
    return {
      success: false,
      error: {
        message: 'Failed to get holiday count for analytics',
        code: 'HOLIDAY_ANALYTICS_ERROR'
      }
    };
  }
}

/**
 * Get holidays for student calendar view
 */
export async function getHolidaysForCalendar(options) {
  const { 
    batchYear, 
    section, 
    semester, 
    department, 
    month, 
    year 
  } = options;

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const result = await getHolidaysForClass({
      batchYear,
      section,
      semester,
      department,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

    if (!result.success) {
      return result;
    }

    // Format holidays for calendar display
    const calendarHolidays = result.data.map(holiday => ({
      date: holiday.date,
      reason: holiday.reason,
      scope: holiday.scope,
      isGlobal: holiday.scope === 'global'
    }));

    return {
      success: true,
      data: calendarHolidays
    };

  } catch (error) {
    console.error('Error getting holidays for calendar:', error);
    return {
      success: false,
      error: {
        message: 'Failed to get holidays for calendar',
        code: 'HOLIDAY_CALENDAR_ERROR'
      }
    };
  }
}
