const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, providerMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { service_id, package_id, requirements, deadline, total_amount_kes, total_amount_usd } = req.body;

        const serviceQuery = 'SELECT provider_id FROM services WHERE id = $1 AND is_active = true';
        const serviceResult = await pool.query(serviceQuery, [service_id]);
        
        if (serviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        const providerId = serviceResult.rows[0].provider_id;
        const platformFeeRate = 0.30;
        const platformFeeKes = Math.round(total_amount_kes * platformFeeRate);
        const providerEarningsKes = total_amount_kes - platformFeeKes;

        const query = `
            INSERT INTO orders (customer_id, provider_id, service_id, package_id, requirements, deadline,
                               total_amount_kes, total_amount_usd, platform_fee_kes, provider_earnings_kes,
                               platform_fee_usd, provider_earnings_usd, status, payment_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', 'pending')
            RETURNING id
        `;
        
        const result = await pool.query(query
