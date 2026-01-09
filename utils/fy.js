/**
 * Financial Year Utilities
 * UK Financial Year runs 1 July - 30 June
 */

const MONTH_NAMES = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const MONTH_NUMBERS = { 'Jul': 1, 'Aug': 2, 'Sep': 3, 'Oct': 4, 'Nov': 5, 'Dec': 6, 'Jan': 7, 'Feb': 8, 'Mar': 9, 'Apr': 10, 'May': 11, 'Jun': 12 };

/**
 * Get current Financial Year
 * @returns {Object} { label: "2025/26", start: Date, end: Date }
 */
function getCurrentFY() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    let fyStartYear, fyEndYear;
    
    if (currentMonth >= 7) {
        // July-December: FY starts this year
        fyStartYear = currentYear;
        fyEndYear = currentYear + 1;
    } else {
        // January-June: FY started last year
        fyStartYear = currentYear - 1;
        fyEndYear = currentYear;
    }
    
    const start = new Date(fyStartYear, 6, 1); // July 1
    const end = new Date(fyEndYear, 5, 30); // June 30
    
    const label = `${fyStartYear}/${String(fyEndYear).slice(-2)}`;
    
    return { label, start, end };
}

/**
 * Get Financial Year month name from a date
 * @param {Date} date
 * @returns {String} "Jul" | "Aug" | ... | "Jun"
 */
function getFYMonth(date) {
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();
    
    // Determine which FY this date belongs to
    const fy = getFYForDate(date);
    const fyStartYear = parseInt(fy.label.split('/')[0]);
    
    if (month >= 7) {
        // July-December
        const index = month - 7;
        return MONTH_NAMES[index];
    } else {
        // January-June (part of FY that started previous July)
        const index = month + 5; // Jan = 6th month of FY
        return MONTH_NAMES[index];
    }
}

/**
 * Get Financial Year for a given date
 * @param {Date} date
 * @returns {Object} { label: "2025/26", start: Date, end: Date }
 */
function getFYForDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    let fyStartYear, fyEndYear;
    
    if (month >= 7) {
        fyStartYear = year;
        fyEndYear = year + 1;
    } else {
        fyStartYear = year - 1;
        fyEndYear = year;
    }
    
    const start = new Date(fyStartYear, 6, 1);
    const end = new Date(fyEndYear, 5, 30);
    const label = `${fyStartYear}/${String(fyEndYear).slice(-2)}`;
    
    return { label, start, end };
}

/**
 * Get month number within FY (Jul=1, Jun=12)
 * @param {String} monthName - "Jul" | "Aug" | ... | "Jun"
 * @returns {Number} 1-12
 */
function getFYMonthNumber(monthName) {
    return MONTH_NUMBERS[monthName] || 1;
}

/**
 * Get date range for a specific FY month
 * @param {String} fyLabel - e.g. "2025/26"
 * @param {String} monthName - "Jul" | "Aug" | ... | "Jun"
 * @returns {Object} { start: Date, end: Date }
 */
function getFYDateRange(fyLabel, monthName) {
    const [startYearStr] = fyLabel.split('/');
    const startYear = parseInt(startYearStr);
    
    const monthIndex = MONTH_NAMES.indexOf(monthName);
    if (monthIndex === -1) {
        throw new Error(`Invalid month name: ${monthName}`);
    }
    
    let year, month, day, lastDay;
    
    if (monthIndex < 6) {
        // Jul-Dec (months 0-5)
        year = startYear;
        month = monthIndex + 6; // Jul = 6 (0-indexed), Aug = 7, etc.
    } else {
        // Jan-Jun (months 6-11)
        year = startYear + 1;
        month = monthIndex - 6; // Jan = 0 (0-indexed), Feb = 1, etc.
    }
    
    const start = new Date(year, month, 1);
    
    // Get last day of month
    lastDay = new Date(year, month + 1, 0).getDate();
    const end = new Date(year, month, lastDay);
    
    return { start, end };
}

/**
 * Get all available Financial Years (current and past)
 * @param {Number} yearsBack - How many past years to include
 * @returns {Array} Array of FY label strings
 */
function getAllFYs(yearsBack = 2) {
    const currentFY = getCurrentFY();
    const [startYearStr] = currentFY.label.split('/');
    const startYear = parseInt(startYearStr);
    
    const fys = [];
    for (let i = yearsBack; i >= 0; i--) {
        const year = startYear - i;
        const endYear = year + 1;
        const label = `${year}/${String(endYear).slice(-2)}`;
        fys.push(label);
    }
    
    return fys;
}

/**
 * Get all month names in FY order
 * @returns {Array} ["Jul", "Aug", ..., "Jun"]
 */
function getAllFYMonths() {
    return [...MONTH_NAMES];
}

/**
 * Check if a date is within a specific FY month
 * @param {Date} date
 * @param {String} fyLabel
 * @param {String} monthName
 * @returns {Boolean}
 */
function isDateInFYMonth(date, fyLabel, monthName) {
    const range = getFYDateRange(fyLabel, monthName);
    return date >= range.start && date <= range.end;
}

module.exports = {
    getCurrentFY,
    getFYMonth,
    getFYForDate,
    getFYMonthNumber,
    getFYDateRange,
    getAllFYs,
    getAllFYMonths,
    isDateInFYMonth,
    MONTH_NAMES,
    MONTH_NUMBERS
};
