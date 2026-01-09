/**
 * One-time script to fix user passwords
 * Run this with: node scripts/fix-users.js
 * Make sure DATABASE_URL is set in your environment
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../db');

async function fixUsers() {
    try {
        console.log('Fixing user passwords...');
        
        // Generate password hash for 'password123'
        const passwordHash = await bcrypt.hash('password123', 10);
        console.log('Generated hash:', passwordHash);
        
        const users = [
            { name: 'Alice Sales', email: 'alice@example.com', role: 'sales' },
            { name: 'Bob Sales', email: 'bob@example.com', role: 'sales' },
            { name: 'Charlie Production', email: 'charlie@example.com', role: 'production' },
            { name: 'Diana Director', email: 'diana@example.com', role: 'director' }
        ];
        
        for (const user of users) {
            await db.query(
                `INSERT INTO users (name, email, password_hash, role) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (email) DO UPDATE SET
                     password_hash = EXCLUDED.password_hash,
                     name = EXCLUDED.name,
                     role = EXCLUDED.role`,
                [user.name, user.email, passwordHash, user.role]
            );
            console.log(`✅ Fixed user: ${user.email}`);
        }
        
        console.log('All users fixed! Password for all: password123');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing users:', error);
        process.exit(1);
    }
}

fixUsers();
