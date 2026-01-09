/**
 * CSV Parsing and Validation Utilities
 */

const csv = require('csv-parser');
const fs = require('fs').promises;
const { createReadStream } = require('fs');

/**
 * Parse orders CSV file
 * @param {String} filePath - Path to CSV file
 * @returns {Promise<Array>} Array of parsed order objects
 */
async function parseOrdersCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        const requiredColumns = ['order_date', 'order_ref', 'sales_rep_email', 'boxes_qty', 
                                'box_rrp_total', 'box_net_total', 'box_build_cost_total'];
        
        createReadStream(filePath)
            .pipe(csv())
            .on('headers', (headers) => {
                // Validate required columns
                const missing = requiredColumns.filter(col => !headers.includes(col));
                if (missing.length > 0) {
                    reject(new Error(`Missing required columns: ${missing.join(', ')}`));
                }
            })
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

/**
 * Parse production CSV file
 * @param {String} filePath - Path to CSV file
 * @returns {Promise<Array>} Array of parsed production objects
 */
async function parseProductionCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        const requiredColumns = ['production_date', 'boxes_built'];
        
        createReadStream(filePath)
            .pipe(csv())
            .on('headers', (headers) => {
                // Validate required columns
                const missing = requiredColumns.filter(col => !headers.includes(col));
                if (missing.length > 0) {
                    reject(new Error(`Missing required columns: ${missing.join(', ')}`));
                }
            })
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

/**
 * Validate order row data
 * @param {Object} row - Order row data
 * @param {Number} rowNumber - Row number for error reporting
 * @returns {Object} { valid: Boolean, errors: Array }
 */
function validateOrderRow(row, rowNumber) {
    const errors = [];
    
    // Required fields
    if (!row.order_date) errors.push('order_date is required');
    if (!row.boxes_qty) errors.push('boxes_qty is required');
    if (!row.box_rrp_total) errors.push('box_rrp_total is required');
    if (!row.box_net_total) errors.push('box_net_total is required');
    if (!row.box_build_cost_total) errors.push('box_build_cost_total is required');
    
    // Data type validation
    const boxesQty = parseInt(row.boxes_qty);
    if (isNaN(boxesQty) || boxesQty < 1) {
        errors.push('boxes_qty must be a positive integer');
    }
    
    const boxRrpTotal = parseFloat(row.box_rrp_total);
    if (isNaN(boxRrpTotal)) {
        errors.push('box_rrp_total must be a number');
    }
    
    const boxNetTotal = parseFloat(row.box_net_total);
    if (isNaN(boxNetTotal)) {
        errors.push('box_net_total must be a number');
    }
    
    const boxBuildCostTotal = parseFloat(row.box_build_cost_total);
    if (isNaN(boxBuildCostTotal)) {
        errors.push('box_build_cost_total must be a number');
    }
    
    const installRevenue = parseFloat(row.install_revenue || '0');
    if (isNaN(installRevenue)) {
        errors.push('install_revenue must be a number');
    }
    
    const extrasRevenue = parseFloat(row.extras_revenue || '0');
    if (isNaN(extrasRevenue)) {
        errors.push('extras_revenue must be a number');
    }
    
    // Date validation
    if (row.order_date) {
        const date = new Date(row.order_date);
        if (isNaN(date.getTime())) {
            errors.push('order_date must be a valid date (YYYY-MM-DD)');
        }
    }
    
    // Email validation
    if (row.sales_rep_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.sales_rep_email)) {
        errors.push('sales_rep_email must be a valid email address');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors.map(err => `Row ${rowNumber}: ${err}`)
    };
}

/**
 * Validate production row data
 * @param {Object} row - Production row data
 * @param {Number} rowNumber - Row number for error reporting
 * @returns {Object} { valid: Boolean, errors: Array }
 */
function validateProductionRow(row, rowNumber) {
    const errors = [];
    
    // Required fields
    if (!row.production_date) errors.push('production_date is required');
    if (!row.boxes_built) errors.push('boxes_built is required');
    
    // Data type validation
    const boxesBuilt = parseInt(row.boxes_built);
    if (isNaN(boxesBuilt) || boxesBuilt < 0) {
        errors.push('boxes_built must be a non-negative integer');
    }
    
    const boxesOverCost = parseInt(row.boxes_over_cost || '0');
    if (isNaN(boxesOverCost) || boxesOverCost < 0) {
        errors.push('boxes_over_cost must be a non-negative integer');
    }
    
    const reworkBoxes = parseInt(row.rework_boxes || '0');
    if (isNaN(reworkBoxes) || reworkBoxes < 0) {
        errors.push('rework_boxes must be a non-negative integer');
    }
    
    // Date validation
    if (row.production_date) {
        const date = new Date(row.production_date);
        if (isNaN(date.getTime())) {
            errors.push('production_date must be a valid date (YYYY-MM-DD)');
        }
    }
    
    // JSON validation for over_cost_reasons_json
    if (row.over_cost_reasons_json) {
        try {
            const parsed = typeof row.over_cost_reasons_json === 'string' 
                ? JSON.parse(row.over_cost_reasons_json) 
                : row.over_cost_reasons_json;
            if (!Array.isArray(parsed)) {
                errors.push('over_cost_reasons_json must be a valid JSON array');
            }
        } catch (e) {
            errors.push('over_cost_reasons_json must be valid JSON');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors: errors.map(err => `Row ${rowNumber}: ${err}`)
    };
}

/**
 * Format orders for CSV export
 * @param {Array} orders - Array of order objects from database
 * @returns {Array} Array of formatted order objects
 */
function formatOrdersForExport(orders) {
    return orders.map(order => ({
        id: order.id,
        order_date: order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : '',
        order_ref: order.order_ref || '',
        sales_rep_email: order.sales_rep_email || '',
        sales_rep_name: order.sales_rep_name || '',
        boxes_qty: order.boxes_qty,
        box_rrp_total: order.box_rrp_total,
        box_net_total: order.box_net_total,
        box_build_cost_total: order.box_build_cost_total,
        install_revenue: order.install_revenue || 0,
        extras_revenue: order.extras_revenue || 0,
        notes: order.notes || ''
    }));
}

/**
 * Format production entries for CSV export
 * @param {Array} production - Array of production objects from database
 * @returns {Array} Array of formatted production objects
 */
function formatProductionForExport(production) {
    return production.map(prod => ({
        id: prod.id,
        production_date: prod.production_date ? new Date(prod.production_date).toISOString().split('T')[0] : '',
        boxes_built: prod.boxes_built,
        boxes_over_cost: prod.boxes_over_cost || 0,
        over_cost_reasons_json: prod.over_cost_reasons_json 
            ? (typeof prod.over_cost_reasons_json === 'string' 
                ? prod.over_cost_reasons_json 
                : JSON.stringify(prod.over_cost_reasons_json))
            : '[]',
        rework_boxes: prod.rework_boxes || 0,
        notes: prod.notes || ''
    }));
}

module.exports = {
    parseOrdersCSV,
    parseProductionCSV,
    validateOrderRow,
    validateProductionRow,
    formatOrdersForExport,
    formatProductionForExport
};
