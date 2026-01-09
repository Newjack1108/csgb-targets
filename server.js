/**
 * Main Server File
 * CSGB Targets - Sales + Production Dashboard System
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const db = require('./db');
const { userLocals } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Make user available to all views
app.use(userLocals);

// Routes
app.use('/', require('./routes/auth'));
app.use('/sales', require('./routes/sales'));
app.use('/production', require('./routes/production'));
app.use('/settings', require('./routes/settings'));
app.use('/users', require('./routes/users'));

// Root redirect
app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        const role = req.session.userRole;
        if (role === 'sales') {
            return res.redirect('/sales/dashboard');
        } else if (role === 'production') {
            return res.redirect('/production/dashboard');
        } else if (role === 'director') {
            return res.redirect('/sales/dashboard');
        }
    }
    res.redirect('/login');
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).send('Internal Server Error');
});

// Initialize database on startup
async function initializeDatabase() {
    try {
        // Check if tables exist by trying to query settings
        const result = await db.query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = \'settings\'');
        
        if (parseInt(result.rows[0].count) === 0) {
            console.log('Database tables not found. Running schema...');
            
            // Read and execute schema
            const schemaSQL = await fs.readFile(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
            await db.query(schemaSQL);
            
            console.log('Schema created successfully.');
            
            // Check if we should seed
            const settingsCheck = await db.query('SELECT COUNT(*) FROM settings');
            if (parseInt(settingsCheck.rows[0].count) === 0) {
                console.log('Seeding database...');
                
                // Read and execute seeds
                // Execute entire file as one query - PostgreSQL handles multiple statements
                const seedsSQL = await fs.readFile(path.join(__dirname, 'db', 'seeds.sql'), 'utf8');
                try {
                    await db.query(seedsSQL);
                    console.log('Database seeded successfully.');
                } catch (err) {
                    console.error('Seed error:', err.message);
                    // Continue anyway - some seeds may have succeeded
                }
            }
        } else {
            console.log('Database already initialized.');
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        // Don't exit - let the app start and show errors
    }
}

// Start server
async function startServer() {
    try {
        // Log environment info
        console.log('Starting server...');
        console.log('PORT:', process.env.PORT || '3000 (default)');
        console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
        console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET - This will cause errors!');
        
        // Test database connection
        if (!process.env.DATABASE_URL) {
            console.error('ERROR: DATABASE_URL environment variable is not set!');
            console.error('Railway should provide this automatically when PostgreSQL service is connected.');
            process.exit(1);
        }
        
        console.log('Testing database connection...');
        await db.query('SELECT NOW()');
        console.log('Database connection successful');
        
        // Initialize database
        await initializeDatabase();
        
        // Start listening - Railway requires binding to 0.0.0.0
        console.log(`Starting HTTP server on 0.0.0.0:${PORT}...`);
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('Server is ready to accept connections');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        console.error('Error stack:', error.stack);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

startServer();
