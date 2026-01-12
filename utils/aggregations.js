/**
 * Dashboard Aggregations
 */

const { calculateOrderMetrics } = require('./calculations');
const { getFYDateRange } = require('./fy');

/**
 * Aggregate sales metrics for a given FY month
 * @param {Array} orders - Array of order objects
 * @param {Object} settings - Settings object
 * @param {String} fyLabel - Financial year label
 * @param {String} fyMonth - Month name (Jul-Jun)
 * @returns {Object} Aggregated metrics
 */
function aggregateSalesMetrics(orders, settings, fyLabel, fyMonth) {
    const baselineFloorPerBox = parseFloat(settings.baseline_floor_per_box) || 700;
    const monthlyBoxTarget = getMonthlyBoxTarget(settings, fyMonth);
    const baselineTarget = monthlyBoxTarget * baselineFloorPerBox;
    
    // Filter orders for the specific FY month
    const dateRange = getFYDateRange(fyLabel, fyMonth);
    const monthOrders = orders.filter(order => {
        const orderDate = new Date(order.order_date);
        return orderDate >= dateRange.start && orderDate <= dateRange.end;
    });
    
    // Calculate per-order metrics
    const orderMetrics = monthOrders.map(order => 
        calculateOrderMetrics(order, baselineFloorPerBox)
    );
    
    // Aggregate totals
    const boxesSold = monthOrders.reduce((sum, order) => 
        sum + (parseInt(order.boxes_qty) || 0), 0
    );
    
    const baselineActual = orderMetrics.reduce((sum, m) => 
        sum + m.actualBaseline, 0
    );
    
    const discountImpactTotal = orderMetrics.reduce((sum, m) => 
        sum + m.discountImpact, 0
    );
    
    const discountBoxesLostTotal = baselineFloorPerBox > 0
        ? discountImpactTotal / baselineFloorPerBox
        : 0;
    
    // Calculate total RRP for discount percentage
    const totalRrp = monthOrders.reduce((sum, order) => 
        sum + (parseFloat(order.box_rrp_total) || 0), 0
    );
    
    // Average discount percentage
    const averageDiscountPct = totalRrp > 0 
        ? (discountImpactTotal / totalRrp) * 100 
        : 0;
    
    // Observed sales mix
    const totalSalesValue = monthOrders.reduce((sum, order) => {
        const net = parseFloat(order.box_net_total) || 0;
        const install = parseFloat(order.install_revenue) || 0;
        const extras = parseFloat(order.extras_revenue) || 0;
        return sum + net + install + extras;
    }, 0);
    
    const boxRevenue = monthOrders.reduce((sum, order) => 
        sum + (parseFloat(order.box_net_total) || 0), 0
    );
    
    const installRevenue = monthOrders.reduce((sum, order) => 
        sum + (parseFloat(order.install_revenue) || 0), 0
    );
    
    const extrasRevenue = monthOrders.reduce((sum, order) => 
        sum + (parseFloat(order.extras_revenue) || 0), 0
    );
    
    const boxMixPct = totalSalesValue > 0 ? (boxRevenue / totalSalesValue) * 100 : 0;
    const installMixPct = totalSalesValue > 0 ? (installRevenue / totalSalesValue) * 100 : 0;
    const extrasMixPct = totalSalesValue > 0 ? (extrasRevenue / totalSalesValue) * 100 : 0;
    
    // Shape & Momentum
    const ordersCount = monthOrders.length;
    const avgBoxesPerOrder = ordersCount > 0 ? boxesSold / ordersCount : 0;
    const avgBaselinePerBox = boxesSold > 0 ? baselineActual / boxesSold : 0;
    
    // Rolling 4-week boxes/week (calculate from last 28 days of month)
    const rolling4WeekBoxes = calculateRolling4WeekBoxes(orders, dateRange.end);
    const rolling4WeekBoxesPerWeek = rolling4WeekBoxes / 4;
    
    return {
        boxesSold,
        baselineActual,
        baselineTarget,
        averageDiscountPct,
        discountImpactTotal,
        discountBoxesLostTotal,
        observedMix: {
            totalSalesValue,
            boxRevenue,
            installRevenue,
            extrasRevenue,
            boxMixPct,
            installMixPct,
            extrasMixPct
        },
        shapeMetrics: {
            ordersCount,
            avgBoxesPerOrder,
            avgBaselinePerBox,
            rolling4WeekBoxesPerWeek
        }
    };
}

/**
 * Aggregate production metrics for a given FY month
 * @param {Array} productionData - Array of production_boxes objects
 * @param {Array} orders - Array of order objects (for backlog calculation)
 * @param {Object} settings - Settings object
 * @param {String} fyLabel - Financial year label
 * @param {String} fyMonth - Month name (Jul-Jun)
 * @returns {Object} Aggregated metrics
 */
function aggregateProductionMetrics(productionData, orders, settings, fyLabel, fyMonth) {
    const monthlyBoxTarget = getMonthlyBoxTarget(settings, fyMonth);
    const dateRange = getFYDateRange(fyLabel, fyMonth);
    
    // Filter production data for the specific FY month
    const monthProduction = productionData.filter(prod => {
        const prodDate = new Date(prod.production_date);
        return prodDate >= dateRange.start && prodDate <= dateRange.end;
    });
    
    // Aggregate production totals
    const boxesBuilt = monthProduction.reduce((sum, prod) => 
        sum + (parseInt(prod.boxes_built) || 0), 0
    );
    
    const boxesOverCost = monthProduction.reduce((sum, prod) => 
        sum + (parseInt(prod.boxes_over_cost) || 0), 0
    );
    
    const reworkBoxes = monthProduction.reduce((sum, prod) => 
        sum + (parseInt(prod.rework_boxes) || 0), 0
    );
    
    // Cost compliance percentage
    const costCompliancePct = boxesBuilt > 0
        ? ((boxesBuilt - boxesOverCost) / boxesBuilt) * 100
        : 100;
    
    // Cost leakage reasons
    const costLeakageReasons = aggregateCostLeakageReasons(monthProduction);
    
    // Rolling 4-week average
    const rolling4WeekBoxes = calculateRolling4WeekProduction(productionData, dateRange.end);
    const rolling4WeekAvg = rolling4WeekBoxes / 4;
    
    // Backlog (boxes sold - boxes built)
    const boxesSold = orders.filter(order => {
        const orderDate = new Date(order.order_date);
        return orderDate <= dateRange.end;
    }).reduce((sum, order) => sum + (parseInt(order.boxes_qty) || 0), 0);
    
    const backlog = boxesSold - boxesBuilt;
    
    // Quality metrics
    const reworkRate = boxesBuilt > 0 ? (reworkBoxes / boxesBuilt) * 100 : 0;
    
    // Install load (from orders with install revenue)
    const installedBoxes = orders.filter(order => {
        const orderDate = new Date(order.order_date);
        return orderDate >= dateRange.start && orderDate <= dateRange.end;
    }).filter(order => (parseFloat(order.install_revenue) || 0) > 0)
      .reduce((sum, order) => sum + (parseInt(order.boxes_qty) || 0), 0);
    
    const installsPerWeek = calculateInstallsPerWeek(orders, dateRange);
    const installCapacity = parseInt(settings.install_capacity_high_season_per_week) || 15;
    
    // Observed install shape
    const collectedBoxes = boxesBuilt; // Assuming built boxes are collected
    const installShapePct = collectedBoxes > 0 ? (installedBoxes / collectedBoxes) * 100 : 0;
    
    return {
        boxesBuilt,
        costCompliancePct,
        costLeakage: {
            boxesOverCost,
            reasons: costLeakageReasons
        },
        flowMetrics: {
            boxesBuilt,
            rolling4WeekAvg,
            installLoad: {
                installedBoxes,
                installsPerWeek,
                capacity: installCapacity
            },
            backlog
        },
        qualityMetrics: {
            reworkBoxes,
            reworkRate
        },
        installShape: {
            installedBoxes,
            collectedBoxes,
            installShapePct
        }
    };
}

/**
 * Get monthly box target from settings
 * @param {Object} settings
 * @param {String} fyMonth
 * @returns {Number}
 */
function getMonthlyBoxTarget(settings, fyMonth) {
    if (!settings.monthly_box_targets_json) return 0;
    const targets = typeof settings.monthly_box_targets_json === 'string'
        ? JSON.parse(settings.monthly_box_targets_json)
        : settings.monthly_box_targets_json;
    return parseInt(targets[fyMonth]) || 0;
}

/**
 * Aggregate cost leakage reasons from production data
 * @param {Array} productionData
 * @returns {Array} Sorted array of {reason, count, boxes}
 */
function aggregateCostLeakageReasons(productionData) {
    const reasonMap = {};
    
    productionData.forEach(prod => {
        if (!prod.over_cost_reasons_json) return;
        
        const reasons = typeof prod.over_cost_reasons_json === 'string'
            ? JSON.parse(prod.over_cost_reasons_json)
            : prod.over_cost_reasons_json;
        
        if (Array.isArray(reasons)) {
            reasons.forEach(r => {
                const reason = r.reason || 'unknown';
                if (!reasonMap[reason]) {
                    reasonMap[reason] = { reason, count: 0, boxes: 0 };
                }
                reasonMap[reason].count++;
                reasonMap[reason].boxes += parseInt(r.boxes) || 0;
            });
        }
    });
    
    return Object.values(reasonMap)
        .sort((a, b) => b.boxes - a.boxes)
        .slice(0, 5); // Top 5
}

/**
 * Calculate rolling 4-week boxes sold
 * @param {Array} orders
 * @param {Date} endDate
 * @returns {Number}
 */
function calculateRolling4WeekBoxes(orders, endDate) {
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 28);
    
    return orders.filter(order => {
        const orderDate = new Date(order.order_date);
        return orderDate >= startDate && orderDate <= endDate;
    }).reduce((sum, order) => sum + (parseInt(order.boxes_qty) || 0), 0);
}

/**
 * Calculate rolling 4-week production
 * @param {Array} productionData
 * @param {Date} endDate
 * @returns {Number}
 */
function calculateRolling4WeekProduction(productionData, endDate) {
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 28);
    
    return productionData.filter(prod => {
        const prodDate = new Date(prod.production_date);
        return prodDate >= startDate && prodDate <= endDate;
    }).reduce((sum, prod) => sum + (parseInt(prod.boxes_built) || 0), 0);
}

/**
 * Calculate installs per week (last 4 weeks)
 * @param {Array} orders
 * @param {Object} dateRange
 * @returns {Number}
 */
function calculateInstallsPerWeek(orders, dateRange) {
    const startDate = new Date(dateRange.end);
    startDate.setDate(startDate.getDate() - 28);
    
    const installOrders = orders.filter(order => {
        const orderDate = new Date(order.order_date);
        return orderDate >= startDate && orderDate <= dateRange.end &&
               (parseFloat(order.install_revenue) || 0) > 0;
    });
    
    const totalBoxes = installOrders.reduce((sum, order) => 
        sum + (parseInt(order.boxes_qty) || 0), 0
    );
    
    return totalBoxes / 4; // Average per week
}

module.exports = {
    aggregateSalesMetrics,
    aggregateProductionMetrics,
    getMonthlyBoxTarget
};
