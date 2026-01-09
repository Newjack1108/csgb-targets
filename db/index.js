/**
 * Database Connection Pool
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
        rejectUnauthorized: false
    }
});

// Test connection
pool.on('connect', () => {
    console.log('Database connected');
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

// Helper function to execute queries
pool.query = pool.query.bind(pool);

module.exports = pool;
