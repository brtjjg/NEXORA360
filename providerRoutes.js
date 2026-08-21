// backend/src/routes/providerRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, providerMiddleware } = require('../middleware/auth');

// Get provider earnings
router.get('/earnings', authMiddleware, providerMiddleware, async (req, res) => {
    try {
        const query = `
            SELECT 
                COALESCE(SUM(provider_earnings_kes), 0) as total_earnings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN provider_earnings_kes ELSE 0 END), 0) as completed_earnings,
                COALESCE(SUM(CASE WHEN status IN ('paid', 'in_progress', 'submitted') THEN provider_earnings_kes ELSE 0 END), 0) as pending_earnings,
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders
            FROM orders
            WHERE provider_id = $1
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get provider services
router.get('/services', authMiddleware, providerMiddleware, async (req, res) => {
    try {
        const query = `
            SELECT s.*, 
                   COUNT(o.id) as order_count,
                   COALESCE(AVG(r.rating), 0) as avg_rating
            FROM services s
            LEFT JOIN orders o ON s.id = o.service_id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.provider_id = $1
            GROUP BY s.id
            ORDER BY s.created_at DESC
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get provider reviews
router.get('/reviews', authMiddleware, providerMiddleware, async (req, res) => {
    try {
        const query = `
            SELECT r.*, u.full_name as customer_name, s.name as service_name
            FROM reviews r
            LEFT JOIN users u ON r.customer_id = u.id
            LEFT JOIN services s ON r.service_id = s.id
            WHERE r.provider_id = $1
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
