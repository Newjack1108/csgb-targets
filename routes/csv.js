/**
 * CSV Import/Export Routes (Director Only)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { stringify } = require('csv-stringify/sync');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
    parseOrdersCSV,
    parseProductionCSV,
    validateOrderRow,
    validateProductionRow,
    formatOrdersForExport,
    formatProductionForExport
} = require('../utils/csv');

// All routes require authentication and director role
router.use(requireAuth);
router.use(requireRole('director'));

/**
 * GET /csv - CSV Management page
 */
router.get('/', (req, res) => {
    res.render('csv/index', {
        error: null,
        success: null,
        importResult: null
    });
});

/**
 * POST /csv/import/orders - Import orders from CSV
 */
router.post('/import/orders', async (req, res) => {
    try {
        if (!req.file) {
            return res.render('csv/index', {
                error: 'No file uploaded',
                success: null,
                importResult: null
            });
        }

        const filePath = req.file.path;
        let importResult = {
            total: 0,
            success: 0,
            failed: 0,
            errors: []
        };

        try {
            // Parse CSV
            const rows = await parseOrdersCSV(filePath);
            importResult.total = rows.length;

            // Start transaction
            await db.query('BEGIN');

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNumber = i + 2; // +2 because CSV has header row and 0-indexed
                
                // Validate row
                const validation = validateOrderRow(row, rowNumber);
                if (!validation.valid) {
                    importResult.failed++;
                    importResult.errors.push(...validation.errors);
                    continue;
                }

                // Look up sales rep by email
                let salesRepId = null;
                if (row.sales_rep_email) {
                    const userResult = await db.query(
                        'SELECT id FROM users WHERE email = $1',
                        [row.sales_rep_email]
                    );
                    if (userResult.rows.length > 0) {
                        salesRepId = userResult.rows[0].id;
                    } else {
                        importResult.failed++;
                        importResult.errors.push(`Row ${rowNumber}: Sales rep email not found: ${row.sales_rep_email}`);
                        continue;
                    }
                }

                // Insert order
                try {
                    await db.query(
                        `INSERT INTO orders (
                            order_date, order_ref, sales_rep_id, boxes_qty,
                            box_rrp_total, box_net_total, box_build_cost_total,
                            install_revenue, extras_revenue, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            row.order_date,
                            row.order_ref || null,
                            salesRepId,
                            parseInt(row.boxes_qty),
                            parseFloat(row.box_rrp_total),
                            parseFloat(row.box_net_total),
                            parseFloat(row.box_build_cost_total),
                            parseFloat(row.install_revenue || '0'),
                            parseFloat(row.extras_revenue || '0'),
                            row.notes || null
                        ]
                    );
                    importResult.success++;
                } catch (dbError) {
                    importResult.failed++;
                    importResult.errors.push(`Row ${rowNumber}: Database error - ${dbError.message}`);
                }
            }

            await db.query('COMMIT');
        } catch (parseError) {
            await db.query('ROLLBACK');
            throw parseError;
        } finally {
            // Clean up uploaded file
            try {
                await fs.unlink(filePath);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }

        res.render('csv/index', {
            error: null,
            success: `Import completed: ${importResult.success} successful, ${importResult.failed} failed`,
            importResult
        });
    } catch (error) {
        console.error('CSV import error:', error);
        res.render('csv/index', {
            error: `Import error: ${error.message}`,
            success: null,
            importResult: null
        });
    }
});

/**
 * POST /csv/import/production - Import production entries from CSV
 */
router.post('/import/production', async (req, res) => {
    try {
        if (!req.file) {
            return res.render('csv/index', {
                error: 'No file uploaded',
                success: null,
                importResult: null
            });
        }

        const filePath = req.file.path;
        let importResult = {
            total: 0,
            success: 0,
            failed: 0,
            errors: []
        };

        try {
            // Parse CSV
            const rows = await parseProductionCSV(filePath);
            importResult.total = rows.length;

            // Start transaction
            await db.query('BEGIN');

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNumber = i + 2; // +2 because CSV has header row and 0-indexed
                
                // Validate row
                const validation = validateProductionRow(row, rowNumber);
                if (!validation.valid) {
                    importResult.failed++;
                    importResult.errors.push(...validation.errors);
                    continue;
                }

                // Parse JSON for over_cost_reasons_json
                let reasonsJson = null;
                if (row.over_cost_reasons_json) {
                    try {
                        reasonsJson = typeof row.over_cost_reasons_json === 'string'
                            ? JSON.parse(row.over_cost_reasons_json)
                            : row.over_cost_reasons_json;
                    } catch (e) {
                        importResult.failed++;
                        importResult.errors.push(`Row ${rowNumber}: Invalid JSON in over_cost_reasons_json`);
                        continue;
                    }
                }

                // Insert production entry
                try {
                    await db.query(
                        `INSERT INTO production_boxes (
                            production_date, boxes_built, boxes_over_cost,
                            over_cost_reasons_json, rework_boxes, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            row.production_date,
                            parseInt(row.boxes_built),
                            parseInt(row.boxes_over_cost || '0'),
                            reasonsJson ? JSON.stringify(reasonsJson) : null,
                            parseInt(row.rework_boxes || '0'),
                            row.notes || null
                        ]
                    );
                    importResult.success++;
                } catch (dbError) {
                    importResult.failed++;
                    importResult.errors.push(`Row ${rowNumber}: Database error - ${dbError.message}`);
                }
            }

            await db.query('COMMIT');
        } catch (parseError) {
            await db.query('ROLLBACK');
            throw parseError;
        } finally {
            // Clean up uploaded file
            try {
                await fs.unlink(filePath);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }

        res.render('csv/index', {
            error: null,
            success: `Import completed: ${importResult.success} successful, ${importResult.failed} failed`,
            importResult
        });
    } catch (error) {
        console.error('CSV import error:', error);
        res.render('csv/index', {
            error: `Import error: ${error.message}`,
            success: null,
            importResult: null
        });
    }
});

/**
 * GET /csv/export/orders - Export all orders as CSV
 */
router.get('/export/orders', async (req, res) => {
    try {
        const ordersResult = await db.query(
            `SELECT o.*, u.email as sales_rep_email, u.name as sales_rep_name
             FROM orders o
             LEFT JOIN users u ON o.sales_rep_id = u.id
             ORDER BY o.order_date DESC, o.id DESC`
        );

        const orders = formatOrdersForExport(ordersResult.rows);
        
        // Define CSV columns
        const columns = [
            'id',
            'order_date',
            'order_ref',
            'sales_rep_email',
            'sales_rep_name',
            'boxes_qty',
            'box_rrp_total',
            'box_net_total',
            'box_build_cost_total',
            'install_revenue',
            'extras_revenue',
            'notes'
        ];

        const csvContent = stringify(orders, { header: true, columns });

        const filename = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
    } catch (error) {
        console.error('CSV export error:', error);
        res.status(500).send('Error exporting orders');
    }
});

/**
 * GET /csv/export/production - Export all production entries as CSV
 */
router.get('/export/production', async (req, res) => {
    try {
        const productionResult = await db.query(
            'SELECT * FROM production_boxes ORDER BY production_date DESC, id DESC'
        );

        const production = formatProductionForExport(productionResult.rows);
        
        // Define CSV columns
        const columns = [
            'id',
            'production_date',
            'boxes_built',
            'boxes_over_cost',
            'over_cost_reasons_json',
            'rework_boxes',
            'notes'
        ];

        const csvContent = stringify(production, { header: true, columns });

        const filename = `production_export_${new Date().toISOString().split('T')[0]}.csv`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
    } catch (error) {
        console.error('CSV export error:', error);
        res.status(500).send('Error exporting production entries');
    }
});

/**
 * GET /csv/template/orders - Download orders CSV template
 */
router.get('/template/orders', (req, res) => {
    const template = [
        {
            order_date: '2025-01-15',
            order_ref: 'ORD-001',
            sales_rep_email: 'alice@example.com',
            boxes_qty: '2',
            box_rrp_total: '2800',
            box_net_total: '2600',
            box_build_cost_total: '1400',
            install_revenue: '500',
            extras_revenue: '200',
            notes: 'Sample order'
        }
    ];

    const columns = [
        'order_date',
        'order_ref',
        'sales_rep_email',
        'boxes_qty',
        'box_rrp_total',
        'box_net_total',
        'box_build_cost_total',
        'install_revenue',
        'extras_revenue',
        'notes'
    ];

    const csvContent = stringify(template, { header: true, columns });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders_template.csv"');
    res.send(csvContent);
});

/**
 * GET /csv/template/production - Download production CSV template
 */
router.get('/template/production', (req, res) => {
    const template = [
        {
            production_date: '2025-01-15',
            boxes_built: '5',
            boxes_over_cost: '1',
            over_cost_reasons_json: '[{"reason": "material", "boxes": 1}]',
            rework_boxes: '0',
            notes: 'Sample production entry'
        }
    ];

    const columns = [
        'production_date',
        'boxes_built',
        'boxes_over_cost',
        'over_cost_reasons_json',
        'rework_boxes',
        'notes'
    ];

    const csvContent = stringify(template, { header: true, columns });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="production_template.csv"');
    res.send(csvContent);
});

module.exports = router;
