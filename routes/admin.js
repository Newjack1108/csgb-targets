/**
 * Admin Routes (Temporary setup routes)
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

// All routes require authentication and director role
router.use(requireAuth);
router.use(requireRole('director'));

router.get('/', (req, res) => {
    res.send('Admin routes - setup and maintenance');
});

module.exports = router;
