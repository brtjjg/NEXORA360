const express = require('express');
const router = express.Router();
const authService = require('../config/auth');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { pool } = require('../config/database');

router.post('/register', async (req, res) => {
    try {
        const user = await authService.register(req.body);
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(
            { email, password },
            req.ip,
            req.headers['user-agent']
        );
        
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await authService.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.split(' ')[1];
        
        await pool.query(
            'UPDATE admin_sessions SET revoked = true WHERE session_token = $1',
            [token]
        );
        
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
