/**
 * CSV Import/Export Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { stringify } = require('csv-stringify');
const fs = require('fs').promises;
const path = require('path');
const { createReadStream } = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');
const db = require('../db');

// All routes require authentication and director role
router.use(requireAuth);
router.use(requireRole('director'));

// Multer configuration for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

/**
 * GET /csv - Main CSV management page
 */
router.get('/', (req, res) => {
    res.render('csv/index', {
        error: req.query.error,
        success: req.query.success,
        importResult: null
    });
});

/**
 * POST /csv/import/orders - Import orders from CSV
 */
router.post('/import/orders', upload.single('csvfile'), async (req, res) => {
    if (!req.file) {
        return res.render('csv/index', {
            error: 'No file uploaded',
            success: null,
            importResult: null
        });
    }

    const filePath = req.file.path;
    const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: []
    };

    try {
        const rows = [];
        
        // Parse CSV
        await new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => rows.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        results.total = rows.length;

        // Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // +2 because CSV has header and 0-indexed

            try {
                // Validate required fields
                if (!row.order_date || !row.boxes_qty || !row.box_rrp_total || 
                    !row.box_net_total || !row.box_build_cost_total) {
                    throw new Error(`Row ${rowNum}: Missing required fields`);
                }

                // Get sales rep ID from email
                let salesRepId = null;
                if (row.sales_rep_email) {
                    const userResult = await db.query(
                        'SELECT id FROM users WHERE email = $1 AND role = $2',
                        [row.sales_rep_email, 'sales']
                    );
                    if (userResult.rows.length > 0) {
                        salesRepId = userResult.rows[0].id;
                    } else {
                        throw new Error(`Row ${rowNum}: Sales rep not found: ${row.sales_rep_email}`);
                    }
                }

                // Insert order
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
                        parseFloat(row.install_revenue) || 0,
                        parseFloat(row.extras_revenue) || 0,
                        row.notes || null
                    ]
                );

                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${rowNum}: ${error.message}`);
            }
        }

        // Clean up uploaded file
        await fs.unlink(filePath);

        res.render('csv/index', {
            error: null,
            success: results.failed === 0 ? `Successfully imported ${results.success} orders` : null,
            importResult: results
        });
    } catch (error) {
        // Clean up uploaded file
        try {
            await fs.unlink(filePath);
        } catch (e) {
            // Ignore cleanup errors
        }

        res.render('csv/index', {
            error: `Import failed: ${error.message}`,
            success: null,
            importResult: results
        });
    }
});

/**
 * POST /csv/import/production - Import production entries from CSV
 */
router.post('/import/production', upload.single('csvfile'), async (req, res) => {
    if (!req.file) {
        return res.render('csv/index', {
            error: 'No file uploaded',
            success: null,
            importResult: null
        });
    }

    const filePath = req.file.path;
    const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: []
    };

    try {
        const rows = [];
        
        // Parse CSV
        await new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => rows.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        results.total = rows.length;

        // Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            try {
                // Validate required fields
                if (!row.production_date || !row.boxes_built) {
                    throw new Error(`Row ${rowNum}: Missing required fields`);
                }

                // Parse over_cost_reasons_json if provided
                let reasonsJson = null;
                if (row.over_cost_reasons_json) {
                    try {
                        reasonsJson = JSON.parse(row.over_cost_reasons_json);
                    } catch (e) {
                        throw new Error(`Row ${rowNum}: Invalid JSON in over_cost_reasons_json`);
                    }
                }

                // Insert production entry
                await db.query(
                    `INSERT INTO production_boxes (
                        production_date, boxes_built, boxes_over_cost,
                        over_cost_reasons_json, rework_boxes, notes
                    ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        row.production_date,
                        parseInt(row.boxes_built),
                        parseInt(row.boxes_over_cost) || 0,
                        reasonsJson ? JSON.stringify(reasonsJson) : null,
                        parseInt(row.rework_boxes) || 0,
                        row.notes || null
                    ]
                );

                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${rowNum}: ${error.message}`);
            }
        }

        // Clean up uploaded file
        await fs.unlink(filePath);

        res.render('csv/index', {
            error: null,
            success: results.failed === 0 ? `Successfully imported ${results.success} production entries` : null,
            importResult: results
        });
    } catch (error) {
        // Clean up uploaded file
        try {
            await fs.unlink(filePath);
        } catch (e) {
            // Ignore cleanup errors
        }

        res.render('csv/index', {
            error: `Import failed: ${error.message}`,
            success: null,
            importResult: results
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
             ORDER BY o.order_date DESC, o.created_at DESC`
        );

        const orders = ordersResult.rows;

        // Convert to CSV
        const csvData = await new Promise((resolve, reject) => {
            stringify(orders, {
                header: true,
                columns: [
                    'id',
                    'order_date',
                    'order_ref',
                    'sales_rep_email',
                    'boxes_qty',
                    'box_rrp_total',
                    'box_net_total',
                    'box_build_cost_total',
                    'install_revenue',
                    'extras_revenue',
                    'notes',
                    'created_at',
                    'updated_at'
                ]
            }, (err, output) => {
                if (err) reject(err);
                else resolve(output);
            });
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=orders-export.csv');
        res.send(csvData);
    } catch (error) {
        console.error('Export orders error:', error);
        res.status(500).send('Error exporting orders');
    }
});

/**
 * GET /csv/export/production - Export all production entries as CSV
 */
router.get('/export/production', async (req, res) => {
    try {
        const productionResult = await db.query(
            'SELECT * FROM production_boxes ORDER BY production_date DESC, created_at DESC'
        );

        const entries = productionResult.rows.map(entry => ({
            ...entry,
            over_cost_reasons_json: entry.over_cost_reasons_json 
                ? JSON.stringify(entry.over_cost_reasons_json) 
                : ''
        }));

        // Convert to CSV
        const csvData = await new Promise((resolve, reject) => {
            stringify(entries, {
                header: true,
                columns: [
                    'id',
                    'production_date',
                    'boxes_built',
                    'boxes_over_cost',
                    'over_cost_reasons_json',
                    'rework_boxes',
                    'notes',
                    'created_at'
                ]
            }, (err, output) => {
                if (err) reject(err);
                else resolve(output);
            });
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=production-export.csv');
        res.send(csvData);
    } catch (error) {
        console.error('Export production error:', error);
        res.status(500).send('Error exporting production entries');
    }
});

/**
 * GET /csv/template/orders - Download orders CSV template
 */
router.get('/template/orders', async (req, res) => {
    const template = await new Promise((resolve, reject) => {
        stringify([
            {
                order_date: '2024-07-15',
                order_ref: 'ORD-001',
                sales_rep_email: 'alice@example.com',
                boxes_qty: '2',
                box_rrp_total: '2800.00',
                box_net_total: '2600.00',
                box_build_cost_total: '1400.00',
                install_revenue: '500.00',
                extras_revenue: '200.00',
                notes: 'Example order'
            }
        ], {
            header: true
        }, (err, output) => {
            if (err) reject(err);
            else resolve(output);
        });
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders-template.csv');
    res.send(template);
});

/**
 * GET /csv/template/production - Download production CSV template
 */
router.get('/template/production', async (req, res) => {
    const template = await new Promise((resolve, reject) => {
        stringify([
            {
                production_date: '2024-07-15',
                boxes_built: '5',
                boxes_over_cost: '1',
                over_cost_reasons_json: '[{"reason": "material", "boxes": 1}]',
                rework_boxes: '0',
                notes: 'Example production entry'
            }
        ], {
            header: true
        }, (err, output) => {
            if (err) reject(err);
            else resolve(output);
        });
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=production-template.csv');
    res.send(template);
});

module.exports = router;
