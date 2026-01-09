/**
 * User Management Routes (Director Only)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All routes require authentication and director role
router.use(requireAuth);
router.use(requireRole('director'));

/**
 * GET /users - List all users
 */
router.get('/', async (req, res) => {
    try {
        const usersResult = await db.query(
            'SELECT id, name, email, role, created_at FROM users ORDER BY name'
        );
        
        res.render('users/index', {
            users: usersResult.rows,
            error: null
        });
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).send('Error loading users');
    }
});

/**
 * GET /users/new - New user form
 */
router.get('/new', (req, res) => {
    res.render('users/user-form', {
        user: null,
        isEdit: false,
        error: null
    });
});

/**
 * POST /users/new - Create new user
 */
router.post('/new', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        if (!name || !email || !password || !role) {
            return res.render('users/user-form', {
                user: null,
                isEdit: false,
                error: 'All fields are required'
            });
        }
        
        // Check if email already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.render('users/user-form', {
                user: null,
                isEdit: false,
                error: 'Email already exists'
            });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Insert user
        await db.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            [name, email, passwordHash, role]
        );
        
        res.redirect('/users?success=1');
    } catch (error) {
        console.error('Create user error:', error);
        res.render('users/user-form', {
            user: null,
            isEdit: false,
            error: 'Error creating user'
        });
    }
});

/**
 * GET /users/:id/edit - Edit user form
 */
router.get('/:id/edit', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        const userResult = await db.query(
            'SELECT id, name, email, role FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).send('User not found');
        }
        
        res.render('users/user-form', {
            user: userResult.rows[0],
            isEdit: true,
            error: null
        });
    } catch (error) {
        console.error('Edit user form error:', error);
        res.status(500).send('Error loading form');
    }
});

/**
 * POST /users/:id/edit - Update user
 */
router.post('/:id/edit', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, email, password, role } = req.body;
        
        if (!name || !email || !role) {
            const userResult = await db.query(
                'SELECT id, name, email, role FROM users WHERE id = $1',
                [userId]
            );
            
            return res.render('users/user-form', {
                user: userResult.rows[0],
                isEdit: true,
                error: 'Name, email, and role are required'
            });
        }
        
        // Check if email already exists (excluding current user)
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [email, userId]
        );
        
        if (existingUser.rows.length > 0) {
            const userResult = await db.query(
                'SELECT id, name, email, role FROM users WHERE id = $1',
                [userId]
            );
            
            return res.render('users/user-form', {
                user: userResult.rows[0],
                isEdit: true,
                error: 'Email already exists'
            });
        }
        
        // Update user (with or without password)
        if (password && password.length > 0) {
            const passwordHash = await bcrypt.hash(password, 10);
            await db.query(
                'UPDATE users SET name = $1, email = $2, password_hash = $3, role = $4 WHERE id = $5',
                [name, email, passwordHash, role, userId]
            );
        } else {
            await db.query(
                'UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4',
                [name, email, role, userId]
            );
        }
        
        res.redirect('/users?success=1');
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).send('Error updating user');
    }
});

/**
 * POST /users/:id/delete - Delete user
 */
router.post('/:id/delete', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Safety check: don't allow deleting yourself
        if (userId === req.session.userId) {
            return res.redirect('/users?error=cannot_delete_self');
        }
        
        // Check if user has orders
        const ordersResult = await db.query(
            'SELECT COUNT(*) as count FROM orders WHERE sales_rep_id = $1',
            [userId]
        );
        
        if (parseInt(ordersResult.rows[0].count) > 0) {
            return res.redirect('/users?error=user_has_orders');
        }
        
        // Delete user
        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        
        res.redirect('/users?success=1');
    } catch (error) {
        console.error('Delete user error:', error);
        res.redirect('/users?error=delete_failed');
    }
});

module.exports = router;
