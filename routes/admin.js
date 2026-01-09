/**
 * Admin Routes - One-time fixes
 * WARNING: Remove or protect these routes in production!
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

/**
 * GET /admin/fix-users - Fix user passwords (one-time use)
 * This route can be accessed without authentication for initial setup
 * Remove or protect this route after use!
 */
router.get('/fix-users', async (req, res) => {
    try {
        console.log('Fixing user passwords via admin route...');
        
        // Generate password hash for 'password123'
        const passwordHash = await bcrypt.hash('password123', 10);
        console.log('Generated hash:', passwordHash);
        
        const users = [
            { name: 'Alice Sales', email: 'alice@example.com', role: 'sales' },
            { name: 'Bob Sales', email: 'bob@example.com', role: 'sales' },
            { name: 'Charlie Production', email: 'charlie@example.com', role: 'production' },
            { name: 'Diana Director', email: 'diana@example.com', role: 'director' }
        ];
        
        const results = [];
        for (const user of users) {
            try {
                await db.query(
                    `INSERT INTO users (name, email, password_hash, role) 
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (email) DO UPDATE SET
                         password_hash = EXCLUDED.password_hash,
                         name = EXCLUDED.name,
                         role = EXCLUDED.role`,
                    [user.name, user.email, passwordHash, user.role]
                );
                results.push(`✅ Fixed: ${user.email}`);
            } catch (err) {
                results.push(`❌ Error with ${user.email}: ${err.message}`);
            }
        }
        
        res.send(`
            <html>
                <head><title>Users Fixed</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>Users Fixed Successfully!</h1>
                    <p>Password for all users: <strong>password123</strong></p>
                    <ul>
                        ${results.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                    <p><a href="/login">Go to Login</a></p>
                    <p style="color: red; margin-top: 30px;">
                        <strong>IMPORTANT:</strong> Remove or protect the /admin/fix-users route after use!
                    </p>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error fixing users:', error);
        res.status(500).send(`
            <html>
                <head><title>Error</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>Error Fixing Users</h1>
                    <p>${error.message}</p>
                    <p><a href="/login">Go to Login</a></p>
                </body>
            </html>
        `);
    }
});

module.exports = router;
