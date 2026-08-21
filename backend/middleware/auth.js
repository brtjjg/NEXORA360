const { pool } = require('../config/database');
const authService = require('../config/auth');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = authService.verifyToken(token);
        
        const query = 'SELECT id, email, role, is_active FROM users WHERE id = $1 AND deleted_at IS NULL';
        const result = await pool.query(query, [decoded.id]);
        
        if (!result.rows[0] || !result.rows[0].is_active) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        return res.status(401).json({ error: error.message });
    }
};

const adminMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (req.user.role !== 'admin') {
            await pool.query(
                'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
                [req.user.id, 'UNAUTHORIZED_ADMIN_ACCESS', { 
                    attempted_at: new Date(),
                    endpoint: req.originalUrl,
                    method: req.method
                }, req.ip]
            );
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
};

const providerMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (req.user.role !== 'provider' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Provider or admin access required' });
        }

        next();
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { authMiddleware, adminMiddleware, providerMiddleware };
