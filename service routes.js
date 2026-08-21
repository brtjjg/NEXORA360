// backend/src/routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, providerMiddleware } = require('../middleware/auth');

// Get all services
router.get('/', async (req, res) => {
    try {
        const { category, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT s.*, u.full_name as provider_name, 
                   COALESCE(AVG(r.rating), 0) as avg_rating
            FROM services s
            LEFT JOIN users u ON s.provider_id = u.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true
        `;
        const values = [];
        let paramCount = 1;

        if (category) {
            query += ` AND s.category = $${paramCount}`;
            values.push(category);
            paramCount++;
        }

        if (search) {
            query += ` AND (s.name ILIKE $${paramCount} OR s.description ILIKE $${paramCount})`;
            values.push(`%${search}%`);
            paramCount++;
        }

        query += ` GROUP BY s.id, u.full_name ORDER BY s.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get featured services
router.get('/featured', async (req, res) => {
    try {
        const query = `
            SELECT s.*, u.full_name as provider_name,
                   COALESCE(AVG(r.rating), 0) as avg_rating
            FROM services s
            LEFT JOIN users u ON s.provider_id = u.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.is_active = true
            GROUP BY s.id, u.full_name
            ORDER BY s.total_orders DESC, s.created_at DESC
            LIMIT 6
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get categories
router.get('/categories', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT category 
            FROM services 
            WHERE is_active = true 
            ORDER BY category
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(row => row.category));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single service
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT s.*, u.full_name as provider_name, u.email as provider_email,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM services s
            LEFT JOIN users u ON s.provider_id = u.id
            LEFT JOIN reviews r ON s.id = r.service_id
            WHERE s.id = $1 AND s.is_active = true
            GROUP BY s.id, u.full_name, u.email
        `;
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Get packages
        const packagesQuery = 'SELECT * FROM packages WHERE service_id = $1 ORDER BY price_kes';
        const packagesResult = await pool.query(packagesQuery, [id]);

        // Get reviews
        const reviewsQuery = `
            SELECT r.*, u.full_name 
            FROM reviews r
            LEFT JOIN users u ON r.customer_id = u.id
            WHERE r.service_id = $1
            ORDER BY r.created_at DESC
            LIMIT 10
        `;
        const reviewsResult = await pool.query(reviewsQuery, [id]);

        res.json({
            ...result.rows[0],
            packages: packagesResult.rows,
            reviews: reviewsResult.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create service (provider only)
router.post('/', authMiddleware, providerMiddleware, async (req, res) => {
    try {
        const { 
            name, description, category, starting_price_kes, 
            starting_price_usd, delivery_days, packages, is_custom_quote 
        } = req.body;

        const query = `
            INSERT INTO services (
                provider_id, name, description, category, 
                starting_price_kes, starting_price_usd, delivery_days,
                is_custom_quote
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `;
        const result = await pool.query(query, [
            req.user.id,
            name,
            description,
            category,
            starting_price_kes,
            starting_price_usd,
            delivery_days,
            is_custom_quote || false
        ]);

        const serviceId = result.rows[0].id;

        // Add packages if provided
        if (packages && packages.length > 0) {
            for (const pkg of packages) {
                await pool.query(
                    `INSERT INTO packages (service_id, name, price_kes, price_usd, features, is_recommended)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [serviceId, pkg.name, pkg.price_kes, pkg.price_usd, pkg.features, pkg.is_recommended || false]
                );
            }
        }

        res.status(201).json({ 
            success: true, 
            message: 'Service created successfully',
            serviceId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update service
router.put('/:id', authMiddleware, providerMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = [];
        const values = [];
        let paramCount = 1;

        const allowedFields = ['name', 'description', 'category', 'starting_price_kes', 
                              'starting_price_usd', 'delivery_days', 'is_active', 'is_custom_quote'];
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(req.body[field]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);
        const query = `
            UPDATE services 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${paramCount} AND provider_id = $${paramCount + 1}
            RETURNING *
        `;
        values.push(req.user.id);
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found or unauthorized' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
