const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const authService = require('../config/auth');

// Get dashboard stats
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const queries = {
            revenue: 'SELECT COALESCE(SUM(total_amount_kes), 0) as revenue FROM orders WHERE status = $1',
            orders: 'SELECT COUNT(*) as count FROM orders',
            customers: 'SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true',
            providers: 'SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true',
            pendingOrders: 'SELECT COUNT(*) as count FROM orders WHERE status = $1',
            recentOrders: 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 10'
        };

        const results = await Promise.all([
            pool.query(queries.revenue, ['completed']),
            pool.query(queries.orders),
            pool.query(queries.customers, ['customer']),
            pool.query(queries.providers, ['provider']),
            pool.query(queries.pendingOrders, ['pending']),
            pool.query(queries.recentOrders)
        ]);

        res.json({
            revenue: parseInt(results[0].rows[0].revenue),
            orders: parseInt(results[1].rows[0].count),
            customers: parseInt(results[2].rows[0].count),
            providers: parseInt(results[3].rows[0].count),
            pendingOrders: parseInt(results[4].rows[0].count),
            recentOrders: results[5].rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const query = `
            SELECT id, email, phone, full_name, role, is_active, is_verified, 
                   created_at, last_login
            FROM users 
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user
router.patch('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, role, isVerified } = req.body;
        
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (isActive !== undefined) {
            updates.push(`is_active = $${paramCount}`);
            values.push(isActive);
            paramCount++;
        }
        if (role !== undefined) {
            updates.push(`role = $${paramCount}`);
            values.push(role);
            paramCount++;
        }
        if (isVerified !== undefined) {
            updates.push(`is_verified = $${paramCount}`);
            values.push(isVerified);
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
            UPDATE users 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, email, phone, full_name, role, is_active, is_verified
        `;

        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await authService.logAudit(req.user.id, 'UPDATE_USER', 'user', id, {
            changes: req.body,
            target_user_id: id
        });

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all services (admin)
router.get('/services', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const query = `
            SELECT s.*, u.full_name as provider_name
            FROM services s
            LEFT JOIN users u ON s.provider_id = u.id
            ORDER BY s.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update service
router.patch('/services/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, name, description, category, starting_price_kes } = req.body;
        
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (isActive !== undefined) {
            updates.push(`is_active = $${paramCount}`);
            values.push(isActive);
            paramCount++;
        }
        if (name !== undefined) {
            updates.push(`name = $${paramCount}`);
            values.push(name);
            paramCount++;
        }
        if (description !== undefined) {
            updates.push(`description = $${paramCount}`);
            values.push(description);
            paramCount++;
        }
        if (category !== undefined) {
            updates.push(`category = $${paramCount}`);
            values.push(category);
            paramCount++;
        }
        if (starting_price_kes !== undefined) {
            updates.push(`starting_price_kes = $${paramCount}`);
            values.push(starting_price_kes);
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
            UPDATE services 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        await authService.logAudit(req.user.id, 'UPDATE_SERVICE', 'service', id, {
            changes: req.body
        });

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all orders
router.get('/orders', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const query = `
            SELECT o.*, 
                   c.full_name as customer_name,
                   p.full_name as provider_name,
                   s.name as service_name
            FROM orders o
            LEFT JOIN users c ON o.customer_id = c.id
            LEFT JOIN users p ON o.provider_id = p.id
            LEFT JOIN services s ON o.service_id = s.id
            ORDER BY o.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update order status
router.patch('/orders/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'paid', 'in_progress', 'submitted', 'completed', 'cancelled', 'disputed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const query = `
            UPDATE orders 
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `;
        const result = await pool.query(query, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        await authService.logAudit(req.user.id, 'UPDATE_ORDER_STATUS', 'order', id, {
            new_status: status,
            old_status: result.rows[0].status
        });

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get audit logs
router.get('/audit-logs', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit)
