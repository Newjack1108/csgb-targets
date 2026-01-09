/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

/**
 * GET /login - Show login form
 */
router.get('/login', (req, res) => {
    if (req.session && req.session.userId) {
        // Already logged in, redirect to appropriate dashboard
        const role = req.session.userRole;
        if (role === 'sales') {
            return res.redirect('/sales/dashboard');
        } else if (role === 'production') {
            return res.redirect('/production/dashboard');
        } else if (role === 'director') {
            return res.redirect('/sales/dashboard'); // Directors see sales dashboard by default
        }
    }
    res.render('auth/login', { error: null });
});

/**
 * POST /login - Authenticate user
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.render('auth/login', { 
            error: 'Email and password are required' 
        });
    }
    
    try {
        const result = await db.query(
            'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.render('auth/login', { 
                error: 'Invalid email or password' 
            });
        }
        
        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordMatch) {
            return res.render('auth/login', { 
                error: 'Invalid email or password' 
            });
        }
        
        // Set session
        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userRole = user.role;
        req.session.userEmail = user.email;
        
        console.log('Login successful for:', user.email, 'Role:', user.role);
        console.log('Session ID:', req.sessionID);
        
        // Save session before redirect
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.render('auth/login', { 
                    error: 'Session error. Please try again.' 
                });
            }
            
            // Redirect based on role
            if (user.role === 'sales') {
                res.redirect('/sales/dashboard');
            } else if (user.role === 'production') {
                res.redirect('/production/dashboard');
            } else if (user.role === 'director') {
                res.redirect('/sales/dashboard');
            } else {
                res.redirect('/login');
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', { 
            error: 'An error occurred. Please try again.' 
        });
    }
});

/**
 * POST /logout - Logout user
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});

module.exports = router;
