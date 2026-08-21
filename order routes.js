// backend/src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, providerMiddleware } = require('../middleware/auth');

// Create order
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { 
            service_id, package_id, requirements, deadline,
            total_amount_kes, total_amount_usd
        } = req.body;

        // Get service details
        const serviceQuery = 'SELECT provider_id FROM services WHERE id = $1 AND is_active = true';
        const serviceResult = await pool.query(serviceQuery, [service_id]);
        
        if (serviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        const providerId = serviceResult.rows[0].provider_id;
        const platformFeeRate = parseFloat(process.env.PLATFORM_FEE_RATE) || 0.30;
        const platformFeeKes = Math.round(total_amount_kes * platformFeeRate);
        const providerEarningsKes = total_amount_kes - platformFeeKes;

        const query = `
            INSERT INTO orders (
                customer_id, provider_id, service_id, package_id,
                requirements, deadline, total_amount_kes, total_amount_usd,
                platform_fee_kes, provider_earnings_kes,
                platform_fee_usd, provider_earnings_usd,
                status, payment_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id
        `;
        
        const result = await pool.query(query, [
            req.user.id,
            providerId,
            service_id,
            package_id,
            requirements,
            deadline,
            total_amount_kes,
            total_amount_usd,
            platformFeeKes,
            providerEarningsKes,
            Math.round(total_amount_usd * platformFeeRate),
            Math.round(total_amount_usd * (1 - platformFeeRate)),
            'pending',
            'pending'
        ]);

        res.status(201).json({
            success: true,
            orderId: result.rows[0].id,
            message: 'Order created successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get customer orders
router.get('/customer', authMiddleware, async (req, res) => {
    try {
        const query = `
            SELECT o.*, s.name as service_name, u.full_name as provider_name
            FROM orders o
            LEFT JOIN services s ON o.service_id = s.id
            LEFT JOIN users u ON o.provider_id = u.id
            WHERE o.customer_id = $1
            ORDER BY o.created_at DESC
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get provider orders
router.get('/provider', authMiddleware, providerMiddleware, async (req, res) => {
    try {
        const query = `
            SELECT o.*, s.name as service_name, u.full_name as customer_name
            FROM orders o
            LEFT JOIN services s ON o.service_id = s.id
            LEFT JOIN users u ON o.customer_id = u.id
            WHERE o.provider_id = $1
            ORDER BY o.created_at DESC
        `;
        const result = await pool.query(query, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single order
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT o.*, 
                   s.name as service_name, s.category,
                   c.full_name as customer_name, c.email as customer_email,
                   p.full_name as provider_name, p.email as provider_email,
                   pk.name as package_name
            FROM orders o
            LEFT JOIN services s ON o.service_id = s.id
            LEFT JOIN users c ON o.customer_id = c.id
            LEFT JOIN users p ON o.provider_id = p.id
            LEFT JOIN packages pk ON o.package_id = pk.id
            WHERE o.id = $1
        `;
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = result.rows[0];
        
        // Check authorization
        if (order.customer_id !== req.user.id && 
            order.provider_id !== req.user.id && 
            req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get messages
        const messagesQuery = `
            SELECT m.*, u.full_name as sender_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.order_id = $1
            ORDER BY m.created_at ASC
        `;
        const messagesResult = await pool.query(messagesQuery, [id]);

        res.json({
            ...order,
            messages: messagesResult.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update order status
router.patch('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'paid', 'in_progress', 'submitted', 'completed', 'cancelled', 'disputed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Check authorization
        const checkQuery = 'SELECT customer_id, provider_id FROM orders WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = checkResult.rows[0];
        if (order.customer_id !== req.user.id && 
            order.provider_id !== req.user.id && 
            req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const query = `
            UPDATE orders 
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `;
        const result = await pool.query(query, [status, id]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit deliverable (provider only)
router.post('/:id/deliver', authMiddleware, providerMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { delivery_notes, files } = req.body;

        const query = `
            UPDATE orders 
            SET status = 'submitted', 
                delivery_notes = $1, 
                files = $2,
                delivered_at = NOW(),
                updated_at = NOW()
            WHERE id = $3 AND provider_id = $4
            RETURNING *
        `;
        const result = await pool.query(query, [delivery_notes, files, id, req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found or unauthorized' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Accept delivery (customer only)
router.post('/:id/accept', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            UPDATE orders 
            SET status = 'completed', 
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1 AND customer_id = $2 AND status = 'submitted'
            RETURNING *
        `;
        const result = await pool.query(query, [id, req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found or cannot be accepted' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
