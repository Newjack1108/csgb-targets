/**
 * Records Management Routes (Director Only)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All routes require authentication and director role
router.use(requireAuth);
router.use(requireRole('director'));

/**
 * GET /records - Main records management page
 */
router.get('/', async (req, res) => {
    try {
        // Get all orders (unfiltered by FY/month)
        const ordersResult = await db.query(
            `SELECT o.*, u.name as sales_rep_name, u.email as sales_rep_email
             FROM orders o
             LEFT JOIN users u ON o.sales_rep_id = u.id
             ORDER BY o.order_date DESC, o.created_at DESC
             LIMIT 1000`
        );

        // Get all production entries (unfiltered by FY/month)
        const productionResult = await db.query(
            `SELECT * FROM production_boxes
             ORDER BY production_date DESC, created_at DESC
             LIMIT 1000`
        );

        res.render('records/index', {
            orders: ordersResult.rows,
            productionEntries: productionResult.rows,
            error: req.query.error,
            success: req.query.success
        });
    } catch (error) {
        console.error('Records management error:', error);
        res.status(500).send('Error loading records');
    }
});

/**
 * POST /records/orders/:id/delete - Delete order
 */
router.post('/orders/:id/delete', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        
        // Check if order exists
        const orderCheck = await db.query(
            'SELECT id FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (orderCheck.rows.length === 0) {
            return res.redirect('/records?error=Order not found');
        }
        
        // Delete order
        await db.query('DELETE FROM orders WHERE id = $1', [orderId]);
        
        res.redirect('/records?success=Order deleted successfully');
    } catch (error) {
        console.error('Delete order error:', error);
        res.redirect('/records?error=Error deleting order');
    }
});

/**
 * POST /records/production/:id/delete - Delete production entry
 */
router.post('/production/:id/delete', async (req, res) => {
    try {
        const entryId = parseInt(req.params.id);
        
        // Check if entry exists
        const entryCheck = await db.query(
            'SELECT id FROM production_boxes WHERE id = $1',
            [entryId]
        );
        
        if (entryCheck.rows.length === 0) {
            return res.redirect('/records?error=Production entry not found');
        }
        
        // Delete production entry
        await db.query('DELETE FROM production_boxes WHERE id = $1', [entryId]);
        
        res.redirect('/records?success=Production entry deleted successfully');
    } catch (error) {
        console.error('Delete production entry error:', error);
        res.redirect('/records?error=Error deleting production entry');
    }
});

module.exports = router;
