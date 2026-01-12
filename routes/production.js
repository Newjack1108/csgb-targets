/**
 * Production Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getCurrentFY, getFYMonth, getFYDateRange, getAllFYs, getAllFYMonths } = require('../utils/fy');
const { aggregateProductionMetrics, getMonthlyBoxTarget } = require('../utils/aggregations');
const { getRAGStatus, getCostComplianceRAG, getQualityRAG, getRAGClass } = require('../utils/rag');

// All routes require authentication
router.use(requireAuth);

// Production and directors can access
router.use(requireRole(['production', 'director']));

/**
 * GET /production/dashboard - Production Dashboard
 */
router.get('/dashboard', async (req, res) => {
    try {
        const fy = req.query.fy || getCurrentFY().label;
        const month = req.query.month || getFYMonth(new Date());
        
        // Get settings
        const settingsResult = await db.query('SELECT * FROM settings LIMIT 1');
        const settings = settingsResult.rows[0] || {
            baseline_floor_per_box: 700,
            yearly_box_target: 900,
            monthly_box_targets_json: {},
            install_capacity_high_season_per_week: 15
        };
        
        // Get date range for selected FY month
        const dateRange = getFYDateRange(fy, month);
        
        // Get production data
        const productionResult = await db.query(
            `SELECT * FROM production_boxes 
             WHERE production_date >= $1 AND production_date <= $2 
             ORDER BY production_date DESC`,
            [dateRange.start, dateRange.end]
        );
        const productionData = productionResult.rows;
        
        // Get all orders for backlog calculation
        const ordersResult = await db.query(
            `SELECT * FROM orders 
             WHERE order_date <= $1 
             ORDER BY order_date DESC`,
            [dateRange.end]
        );
        const orders = ordersResult.rows;
        
        // Aggregate metrics
        const metrics = aggregateProductionMetrics(productionData, orders, settings, fy, month);
        const monthlyBoxTarget = getMonthlyBoxTarget(settings, month);
        
        // Calculate RAG statuses
        const boxesRAG = getRAGStatus(metrics.boxesBuilt, monthlyBoxTarget, settings.rag_amber_floor_pct);
        const costComplianceRAG = getCostComplianceRAG(metrics.costCompliancePct);
        const qualityRAG = getQualityRAG(metrics.qualityMetrics.reworkRate);
        
        // Get dashboard note
        const noteResult = await db.query(
            `SELECT note FROM dashboard_notes 
             WHERE fy_label = $1 AND fy_month = $2 AND role = 'production' 
             LIMIT 1`,
            [fy, month]
        );
        const dashboardNote = noteResult.rows[0]?.note || '';
        
        // Get all FYs and months for dropdowns
        const allFYs = getAllFYs();
        const allMonths = getAllFYMonths();
        
        res.render('production/dashboard', {
            fy,
            month,
            metrics,
            monthlyBoxTarget,
            boxesRAG,
            costComplianceRAG,
            qualityRAG,
            dashboardNote,
            productionData,
            allFYs,
            allMonths,
            settings
        });
    } catch (error) {
        console.error('Production dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

/**
 * POST /production/dashboard/note - Save dashboard note
 */
router.post('/dashboard/note', async (req, res) => {
    try {
        const { fy, month, note } = req.body;
        
        await db.query(
            `INSERT INTO dashboard_notes (fy_label, fy_month, role, note)
             VALUES ($1, $2, 'production', $3)
             ON CONFLICT DO NOTHING`,
            [fy, month, note]
        );
        
        // Update if exists
        await db.query(
            `UPDATE dashboard_notes 
             SET note = $3, updated_at = CURRENT_TIMESTAMP
             WHERE fy_label = $1 AND fy_month = $2 AND role = 'production'`,
            [fy, month, note]
        );
        
        res.redirect(`/production/dashboard?fy=${fy}&month=${month}`);
    } catch (error) {
        console.error('Save note error:', error);
        res.status(500).send('Error saving note');
    }
});

/**
 * GET /production/entries/new - New production entry form
 */
router.get('/entries/new', (req, res) => {
    res.render('production/production-form', {
        entry: null,
        isEdit: false
    });
});

/**
 * POST /production/entries/new - Create new production entry
 */
router.post('/entries/new', async (req, res) => {
    try {
        const {
            production_date,
            boxes_built,
            boxes_over_cost,
            over_cost_reasons_json,
            rework_boxes,
            notes
        } = req.body;
        
        // Parse JSON if provided as string
        let reasonsJson = null;
        if (over_cost_reasons_json) {
            try {
                reasonsJson = typeof over_cost_reasons_json === 'string'
                    ? JSON.parse(over_cost_reasons_json)
                    : over_cost_reasons_json;
            } catch (e) {
                reasonsJson = [];
            }
        }
        
        await db.query(
            `INSERT INTO production_boxes (
                production_date, boxes_built, boxes_over_cost,
                over_cost_reasons_json, rework_boxes, notes
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                production_date,
                parseInt(boxes_built),
                parseInt(boxes_over_cost) || 0,
                reasonsJson ? JSON.stringify(reasonsJson) : null,
                parseInt(rework_boxes) || 0,
                notes || null
            ]
        );
        
        res.redirect('/production/dashboard');
    } catch (error) {
        console.error('Create production entry error:', error);
        res.status(500).send('Error creating production entry');
    }
});

/**
 * GET /production/entries/:id/edit - Edit production entry form
 */
router.get('/entries/:id/edit', async (req, res) => {
    try {
        const entryId = parseInt(req.params.id);
        
        const entryResult = await db.query(
            'SELECT * FROM production_boxes WHERE id = $1',
            [entryId]
        );
        
        if (entryResult.rows.length === 0) {
            return res.status(404).send('Production entry not found');
        }
        
        const entry = entryResult.rows[0];
        
        res.render('production/production-form', {
            entry,
            isEdit: true
        });
    } catch (error) {
        console.error('Edit production entry form error:', error);
        res.status(500).send('Error loading form');
    }
});

/**
 * POST /production/entries/:id/delete - Delete production entry (director only)
 */
router.post('/entries/:id/delete', requireRole('director'), async (req, res) => {
    try {
        const entryId = parseInt(req.params.id);
        
        // Check if entry exists
        const entryCheck = await db.query(
            'SELECT id FROM production_boxes WHERE id = $1',
            [entryId]
        );
        
        if (entryCheck.rows.length === 0) {
            return res.redirect('/production/dashboard?error=Production entry not found');
        }
        
        // Delete production entry
        await db.query('DELETE FROM production_boxes WHERE id = $1', [entryId]);
        
        res.redirect('/production/dashboard?success=Production entry deleted successfully');
    } catch (error) {
        console.error('Delete production entry error:', error);
        res.redirect('/production/dashboard?error=Error deleting production entry');
    }
});

/**
 * POST /production/entries/:id/edit - Update production entry
 */
router.post('/entries/:id/edit', async (req, res) => {
    try {
        const entryId = parseInt(req.params.id);
        const {
            production_date,
            boxes_built,
            boxes_over_cost,
            over_cost_reasons_json,
            rework_boxes,
            notes
        } = req.body;
        
        // Parse JSON if provided as string
        let reasonsJson = null;
        if (over_cost_reasons_json) {
            try {
                reasonsJson = typeof over_cost_reasons_json === 'string'
                    ? JSON.parse(over_cost_reasons_json)
                    : over_cost_reasons_json;
            } catch (e) {
                reasonsJson = [];
            }
        }
        
        await db.query(
            `UPDATE production_boxes SET
                production_date = $1,
                boxes_built = $2,
                boxes_over_cost = $3,
                over_cost_reasons_json = $4,
                rework_boxes = $5,
                notes = $6
             WHERE id = $7`,
            [
                production_date,
                parseInt(boxes_built),
                parseInt(boxes_over_cost) || 0,
                reasonsJson ? JSON.stringify(reasonsJson) : null,
                parseInt(rework_boxes) || 0,
                notes || null,
                entryId
            ]
        );
        
        res.redirect('/production/dashboard');
    } catch (error) {
        console.error('Update production entry error:', error);
        res.status(500).send('Error updating production entry');
    }
});

module.exports = router;
