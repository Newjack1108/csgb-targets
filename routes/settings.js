/**
 * Settings Routes (Director Only)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getAllFYMonths } = require('../utils/fy');

// All routes require authentication and director role
router.use(requireAuth);
router.use(requireRole('director'));

/**
 * GET /settings - Settings form
 */
router.get('/', async (req, res) => {
    try {
        const settingsResult = await db.query('SELECT * FROM settings LIMIT 1');
        let settings = settingsResult.rows[0];
        
        // If no settings exist, create default
        if (!settings) {
            const defaultMonthlyTargets = {
                "Jul": 60, "Aug": 70, "Sep": 80, "Oct": 90, "Nov": 85, "Dec": 75,
                "Jan": 70, "Feb": 75, "Mar": 85, "Apr": 90, "May": 80, "Jun": 60
            };
            
            await db.query(
                `INSERT INTO settings (
                    baseline_floor_per_box, yearly_box_target, rag_amber_floor_pct,
                    monthly_box_targets_json, install_capacity_high_season_per_week, fy_start_month
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [700, 900, 0.90, JSON.stringify(defaultMonthlyTargets), 15, 7]
            );
            
            settingsResult = await db.query('SELECT * FROM settings LIMIT 1');
            settings = settingsResult.rows[0];
        }
        
        // Parse monthly targets JSON
        let monthlyTargets = {};
        if (settings.monthly_box_targets_json) {
            monthlyTargets = typeof settings.monthly_box_targets_json === 'string'
                ? JSON.parse(settings.monthly_box_targets_json)
                : settings.monthly_box_targets_json;
        }
        
        const allMonths = getAllFYMonths();
        
        res.render('settings/index', {
            settings,
            monthlyTargets,
            allMonths,
            error: null
        });
    } catch (error) {
        console.error('Settings form error:', error);
        res.status(500).send('Error loading settings');
    }
});

/**
 * POST /settings - Update settings
 */
router.post('/', async (req, res) => {
    try {
        const {
            baseline_floor_per_box,
            yearly_box_target,
            rag_amber_floor_pct,
            install_capacity_high_season_per_week,
            fy_start_month
        } = req.body;
        
        // Build monthly targets object from form data
        const allMonths = getAllFYMonths();
        const monthlyTargets = {};
        let totalMonthlyTargets = 0;
        
        allMonths.forEach(month => {
            const value = parseInt(req.body[`month_${month}`]) || 0;
            monthlyTargets[month] = value;
            totalMonthlyTargets += value;
        });
        
        // Validate monthly targets sum to yearly target
        const yearlyTarget = parseInt(yearly_box_target);
        if (totalMonthlyTargets !== yearlyTarget) {
            const settingsResult = await db.query('SELECT * FROM settings LIMIT 1');
            let settings = settingsResult.rows[0] || {};
            let existingMonthlyTargets = {};
            if (settings.monthly_box_targets_json) {
                existingMonthlyTargets = typeof settings.monthly_box_targets_json === 'string'
                    ? JSON.parse(settings.monthly_box_targets_json)
                    : settings.monthly_box_targets_json;
            }
            
            return res.render('settings/index', {
                settings: {
                    ...settings,
                    baseline_floor_per_box: parseFloat(baseline_floor_per_box),
                    yearly_box_target: yearlyTarget,
                    rag_amber_floor_pct: parseFloat(rag_amber_floor_pct),
                    install_capacity_high_season_per_week: parseInt(install_capacity_high_season_per_week),
                    fy_start_month: parseInt(fy_start_month)
                },
                monthlyTargets,
                allMonths,
                error: `Monthly targets (${totalMonthlyTargets}) must sum to yearly target (${yearlyTarget})`
            });
        }
        
        // Update settings
        await db.query(
            `UPDATE settings SET
                baseline_floor_per_box = $1,
                yearly_box_target = $2,
                rag_amber_floor_pct = $3,
                monthly_box_targets_json = $4,
                install_capacity_high_season_per_week = $5,
                fy_start_month = $6,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = (SELECT id FROM settings LIMIT 1)`,
            [
                parseFloat(baseline_floor_per_box),
                yearlyTarget,
                parseFloat(rag_amber_floor_pct),
                JSON.stringify(monthlyTargets),
                parseInt(install_capacity_high_season_per_week),
                parseInt(fy_start_month)
            ]
        );
        
        res.redirect('/settings?success=1');
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).send('Error updating settings');
    }
});

module.exports = router;
