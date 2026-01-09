/**
 * Per-Order Calculations
 */

/**
 * Calculate metrics for a single order
 * @param {Object} order - Order object from database
 * @param {Number} baselineFloorPerBox - Baseline floor per box from settings
 * @returns {Object} Calculated metrics
 */
function calculateOrderMetrics(order, baselineFloorPerBox) {
    const boxRrpTotal = parseFloat(order.box_rrp_total) || 0;
    const boxNetTotal = parseFloat(order.box_net_total) || 0;
    const boxBuildCostTotal = parseFloat(order.box_build_cost_total) || 0;
    const boxesQty = parseInt(order.boxes_qty) || 1;
    
    // Expected baseline (if no discount)
    const expectedBaseline = boxRrpTotal - boxBuildCostTotal;
    
    // Actual baseline (after discount)
    const actualBaseline = boxNetTotal - boxBuildCostTotal;
    
    // Contribution per box
    const contributionPerBox = boxesQty > 0 ? actualBaseline / boxesQty : 0;
    
    // Discount impact
    const discountImpact = expectedBaseline - actualBaseline;
    
    // Equivalent boxes lost due to discount
    const discountBoxesLost = baselineFloorPerBox > 0 
        ? discountImpact / baselineFloorPerBox 
        : 0;
    
    return {
        expectedBaseline,
        actualBaseline,
        contributionPerBox,
        discountImpact,
        discountBoxesLost
    };
}

module.exports = {
    calculateOrderMetrics
};
