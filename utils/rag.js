/**
 * RAG (Traffic Light) Logic
 * GREEN: >= 100%
 * AMBER: >= rag_amber_floor_pct AND < 100%
 * RED: < rag_amber_floor_pct
 */

/**
 * Get RAG status for a value vs target
 * @param {Number} value - Actual value
 * @param {Number} target - Target value
 * @param {Number} amberFloorPct - Amber floor percentage (e.g. 0.90 for 90%)
 * @returns {String} "green" | "amber" | "red"
 */
function getRAGStatus(value, target, amberFloorPct = 0.90) {
    if (target === 0) return 'green'; // No target means no issue
    
    const percentage = value / target;
    
    if (percentage >= 1.0) {
        return 'green';
    } else if (percentage >= amberFloorPct) {
        return 'amber';
    } else {
        return 'red';
    }
}

/**
 * Get RAG status for discount boxes lost
 * Green: ≤1 box
 * Amber: 1–3 boxes
 * Red: >3 boxes
 * @param {Number} boxesLost - Equivalent boxes lost
 * @returns {String} "green" | "amber" | "red"
 */
function getDiscountRAG(boxesLost) {
    if (boxesLost <= 1) {
        return 'green';
    } else if (boxesLost <= 3) {
        return 'amber';
    } else {
        return 'red';
    }
}

/**
 * Get RAG status for cost compliance
 * Green: ≥95%
 * Amber: 90–94%
 * Red: <90%
 * @param {Number} percentage - Cost compliance percentage
 * @returns {String} "green" | "amber" | "red"
 */
function getCostComplianceRAG(percentage) {
    if (percentage >= 95) {
        return 'green';
    } else if (percentage >= 90) {
        return 'amber';
    } else {
        return 'red';
    }
}

/**
 * Get RAG status for quality (rework rate)
 * Green: ≤3%
 * Amber: 3–5%
 * Red: >5%
 * @param {Number} percentage - Rework rate percentage
 * @returns {String} "green" | "amber" | "red"
 */
function getQualityRAG(percentage) {
    if (percentage <= 3) {
        return 'green';
    } else if (percentage <= 5) {
        return 'amber';
    } else {
        return 'red';
    }
}

/**
 * Get RAG class name for CSS styling
 * @param {String} ragStatus - "green" | "amber" | "red"
 * @returns {String} CSS class name
 */
function getRAGClass(ragStatus) {
    return `rag-${ragStatus}`;
}

/**
 * Format status text using approved language
 * Never use: "Failed", "Missed", "Underperformed"
 * Always use: "Below target", "Watch", "High impact", "Needs explanation"
 * @param {Number} value - Actual value
 * @param {Number} target - Target value
 * @param {String} ragStatus - RAG status
 * @returns {String} Formatted status text
 */
function formatStatusText(value, target, ragStatus) {
    if (ragStatus === 'green') {
        return 'On target';
    } else if (ragStatus === 'amber') {
        return 'Watch';
    } else {
        return 'Below target';
    }
}

module.exports = {
    getRAGStatus,
    getDiscountRAG,
    getCostComplianceRAG,
    getQualityRAG,
    getRAGClass,
    formatStatusText
};
