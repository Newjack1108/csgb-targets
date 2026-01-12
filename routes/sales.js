/**
 * Sales Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getCurrentFY, getFYMonth, getFYDateRange, getAllFYs, getAllFYMonths } = require('../utils/fy');
const { aggregateSalesMetrics, getMonthlyBoxTarget } = require('../utils/aggregations');
const { getRAGStatus, getDiscountRAG, getRAGClass, formatStatusText } = require('../utils/rag');
const { calculateOrderMetrics } = require('../utils/calculations');

// All routes require authentication
router.use(requireAuth);

// Sales and directors can access
router.use(requireRole(['sales', 'director']));

/**
 * GET /sales/dashboard - Sales Dashboard
 */
router.get('/dashboard', async (req, res) => {
    try {
        const fy = req.query.fy || getCurrentFY().label;
        const month = req.query.month || getFYMonth(new Date());
        const isDirector = req.session.userRole === 'director';
        const userId = req.session.userId;
        
        // Get settings
        const settingsResult = await db.query('SELECT * FROM settings LIMIT 1');
        const settings = settingsResult.rows[0] || {
            baseline_floor_per_box: 700,
            yearly_box_target: 900,
            rag_amber_floor_pct: 0.90,
            monthly_box_targets_json: {},
            install_capacity_high_season_per_week: 15
        };
        
        // Get date range for selected FY month
        const dateRange = getFYDateRange(fy, month);
        
        // Get orders - filtered by user if sales, all if director
        let ordersResult;
        if (isDirector) {
            ordersResult = await db.query(
                `SELECT o.*, u.name as sales_rep_name 
                 FROM orders o 
                 LEFT JOIN users u ON o.sales_rep_id = u.id 
                 WHERE o.order_date >= $1 AND o.order_date <= $2 
                 ORDER BY o.order_date DESC`,
                [dateRange.start, dateRange.end]
            );
        } else {
            ordersResult = await db.query(
                `SELECT o.*, u.name as sales_rep_name 
                 FROM orders o 
                 LEFT JOIN users u ON o.sales_rep_id = u.id 
                 WHERE o.order_date >= $1 AND o.order_date <= $2 
                 AND o.sales_rep_id = $3
                 ORDER BY o.order_date DESC`,
                [dateRange.start, dateRange.end, userId]
            );
        }
        const orders = ordersResult.rows;
        
        // Get team totals for sales users
        let teamTotals = null;
        if (!isDirector) {
            const teamResult = await db.query(
                `SELECT SUM(boxes_qty) as total_boxes, 
                        COUNT(*) as total_orders
                 FROM orders 
                 WHERE order_date >= $1 AND order_date <= $2`,
                [dateRange.start, dateRange.end]
            );
            teamTotals = teamResult.rows[0];
        }
        
        // Aggregate metrics
        const metrics = aggregateSalesMetrics(orders, settings, fy, month);
        const monthlyBoxTarget = getMonthlyBoxTarget(settings, month);
        
        // Calculate RAG statuses
        const boxesRAG = getRAGStatus(metrics.boxesSold, monthlyBoxTarget, settings.rag_amber_floor_pct);
        const baselineRAG = getRAGStatus(metrics.baselineActual, metrics.baselineTarget, settings.rag_amber_floor_pct);
        const discountRAG = getDiscountRAG(metrics.discountBoxesLostTotal);
        
        // Get dashboard note
        const noteResult = await db.query(
            `SELECT note FROM dashboard_notes 
             WHERE fy_label = $1 AND fy_month = $2 AND role = 'sales' 
             LIMIT 1`,
            [fy, month]
        );
        const dashboardNote = noteResult.rows[0]?.note || '';
        
        // Get all FYs and months for dropdowns
        const allFYs = getAllFYs();
        const allMonths = getAllFYMonths();
        
        res.render('sales/dashboard', {
            fy,
            month,
            metrics,
            monthlyBoxTarget,
            boxesRAG,
            baselineRAG,
            discountRAG,
            dashboardNote,
            orders,
            teamTotals,
            isDirector,
            allFYs,
            allMonths,
            settings
        });
    } catch (error) {
        console.error('Sales dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

/**
 * POST /sales/dashboard/note - Save dashboard note
 */
router.post('/dashboard/note', async (req, res) => {
    try {
        const { fy, month, note } = req.body;
        
        await db.query(
            `INSERT INTO dashboard_notes (fy_label, fy_month, role, note)
             VALUES ($1, $2, 'sales', $3)
             ON CONFLICT (fy_label, fy_month, role) 
             DO UPDATE SET note = $3, updated_at = CURRENT_TIMESTAMP`,
            [fy, month, note]
        );
        
        res.redirect(`/sales/dashboard?fy=${fy}&month=${month}`);
    } catch (error) {
        console.error('Save note error:', error);
        res.status(500).send('Error saving note');
    }
});

/**
 * GET /sales/orders/new - New order form
 */
router.get('/orders/new', async (req, res) => {
    try {
        const settingsResult = await db.query('SELECT * FROM settings LIMIT 1');
        const settings = settingsResult.rows[0] || { baseline_floor_per_box: 700 };
        
        res.render('sales/order-form', {
            order: null,
            settings,
            isEdit: false
        });
    } catch (error) {
        console.error('New order form error:', error);
        res.status(500).send('Error loading form');
    }
});

/**
 * POST /sales/orders/new - Create new order
 */
router.post('/orders/new', async (req, res) => {
    try {
        const {
            order_date,
            order_ref,
            boxes_qty,
            box_rrp_total,
            box_net_total,
            box_build_cost_total,
            install_revenue,
            extras_revenue,
            notes
        } = req.body;
        
        const userId = req.session.userId;
        
        await db.query(
            `INSERT INTO orders (
                order_date, order_ref, sales_rep_id, boxes_qty,
                box_rrp_total, box_net_total, box_build_cost_total,
                install_revenue, extras_revenue, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                order_date,
                order_ref || null,
                userId,
                parseInt(boxes_qty),
                parseFloat(box_rrp_total),
                parseFloat(box_net_total),
                parseFloat(box_build_cost_total),
                parseFloat(install_revenue) || 0,
                parseFloat(extras_revenue) || 0,
                notes || null
            ]
        );
        
        res.redirect('/sales/dashboard');
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).send('Error creating order');
    }
});

/**
 * GET /sales/orders/:id/edit - Edit order form
 */
router.get('/orders/:id/edit', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session.userId;
        const isDirector = req.session.userRole === 'director';
        
        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).send('Order not found');
        }
        
        const order = orderResult.rows[0];
        
        // Check permission - sales can only edit their own orders
        if (!isDirector && order.sales_rep_id !== userId) {
            return res.status(403).send('Access denied');
        }
        
        const settingsResult = await db.query('SELECT * FROM settings LIMIT 1');
        const settings = settingsResult.rows[0] || { baseline_floor_per_box: 700 };
        
        res.render('sales/order-form', {
            order,
            settings,
            isEdit: true
        });
    } catch (error) {
        console.error('Edit order form error:', error);
        res.status(500).send('Error loading form');
    }
});

/**
 * POST /sales/orders/:id/edit - Update order
 */
router.post('/orders/:id/edit', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session.userId;
        const isDirector = req.session.userRole === 'director';
        
        // Check permission
        const orderCheck = await db.query(
            'SELECT sales_rep_id FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (orderCheck.rows.length === 0) {
            return res.status(404).send('Order not found');
        }
        
        if (!isDirector && orderCheck.rows[0].sales_rep_id !== userId) {
            return res.status(403).send('Access denied');
        }
        
        const {
            order_date,
            order_ref,
            boxes_qty,
            box_rrp_total,
            box_net_total,
            box_build_cost_total,
            install_revenue,
            extras_revenue,
            notes
        } = req.body;
        
        await db.query(
            `UPDATE orders SET
                order_date = $1,
                order_ref = $2,
                boxes_qty = $3,
                box_rrp_total = $4,
                box_net_total = $5,
                box_build_cost_total = $6,
                install_revenue = $7,
                extras_revenue = $8,
                notes = $9,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $10`,
            [
                order_date,
                order_ref || null,
                parseInt(boxes_qty),
                parseFloat(box_rrp_total),
                parseFloat(box_net_total),
                parseFloat(box_build_cost_total),
                parseFloat(install_revenue) || 0,
                parseFloat(extras_revenue) || 0,
                notes || null,
                orderId
            ]
        );
        
        res.redirect('/sales/dashboard');
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).send('Error updating order');
    }
});

/**
 * POST /sales/orders/:id/delete - Delete order (director only)
 */
router.post('/orders/:id/delete', requireRole('director'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        
        // Check if order exists
        const orderCheck = await db.query(
            'SELECT id FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (orderCheck.rows.length === 0) {
            return res.redirect('/sales/dashboard?error=Order not found');
        }
        
        // Delete order
        await db.query('DELETE FROM orders WHERE id = $1', [orderId]);
        
        res.redirect('/sales/dashboard?success=Order deleted successfully');
    } catch (error) {
        console.error('Delete order error:', error);
        res.redirect('/sales/dashboard?error=Error deleting order');
    }
});

/**
 * POST /sales/orders/:id/duplicate - Duplicate order
 */
router.post('/orders/:id/duplicate', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session.userId;
        
        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).send('Order not found');
        }
        
        const order = orderResult.rows[0];
        
        // Create duplicate with new date (today)
        await db.query(
            `INSERT INTO orders (
                order_date, order_ref, sales_rep_id, boxes_qty,
                box_rrp_total, box_net_total, box_build_cost_total,
                install_revenue, extras_revenue, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                new Date().toISOString().split('T')[0],
                order.order_ref ? order.order_ref + ' (copy)' : null,
                userId,
                order.boxes_qty,
                order.box_rrp_total,
                order.box_net_total,
                order.box_build_cost_total,
                order.install_revenue,
                order.extras_revenue,
                order.notes ? order.notes + ' (duplicated)' : null
            ]
        );
        
        res.redirect('/sales/dashboard');
    } catch (error) {
        console.error('Duplicate order error:', error);
        res.status(500).send('Error duplicating order');
    }
});

module.exports = router;
