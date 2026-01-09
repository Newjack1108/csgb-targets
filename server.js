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
                const seedsSQL = await fs.readFile(path.join(__dirname, 'db', 'seeds.sql'), 'utf8');
                // Split by semicolons and execute each statement
                const statements = seedsSQL.split(';').filter(s => s.trim().length > 0);
                
                for (const statement of statements) {
                    if (statement.trim()) {
                        try {
                            await db.query(statement);
                        } catch (err) {
                            // Ignore errors for DO blocks and other complex statements
                            if (!err.message.includes('syntax error')) {
                                console.error('Seed error:', err.message);
                            }
                        }
                    }
                }
                
                console.log('Database seeded successfully.');
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
        // Test database connection
        await db.query('SELECT NOW()');
        console.log('Database connection successful');
        
        // Initialize database
        await initializeDatabase();
        
        // Start listening
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
