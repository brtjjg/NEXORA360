const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('./database');
require('dotenv').config();

class AuthService {
    validatePasswordStrength(password) {
        const errors = [];
        if (password.length < 8) errors.push('Password must be at least 8 characters');
        if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
        if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
        if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
        if (!/[!@#$%^&*]/.test(password)) errors.push('Password must contain at least one special character');
        
        if (errors.length > 0) {
            throw new Error(`Password validation failed: ${errors.join(', ')}`);
        }
        return true;
    }

    async findUserByEmailOrPhone(identifier) {
        const query = `
            SELECT * FROM users 
            WHERE (email = $1 OR phone = $1)
            AND deleted_at IS NULL
        `;
        const result = await pool.query(query, [identifier]);
        return result.rows[0] || null;
    }

    async findUserById(id) {
        const query = `
            SELECT id, email, phone, full_name, role, is_verified, is_active, 
                   two_factor_enabled, created_at, last_login
            FROM users 
            WHERE id = $1 AND deleted_at IS NULL
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    generateToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name
        };
        
        return jwt.sign(
            payload,
            process.env.JWT_SECRET || 'nexora-super-secret-key',
            { expiresIn: process.env.JWT_EXPIRY || '7d' }
        );
    }

    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nexora-super-secret-key');
            return decoded;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async createSession(user, ipAddress, userAgent) {
        const sessionToken = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const query = `
            INSERT INTO admin_sessions (user_id, session_token, ip_address, user_agent, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;
        
        const result = await pool.query(query, [
            user.id,
            sessionToken,
            ipAddress,
            userAgent,
            expiresAt
        ]);

        return {
            id: result.rows[0].id,
            token: sessionToken
        };
    }

    async handleFailedLogin(user) {
        const newAttempts = (user.login_attempts || 0) + 1;
        let lockedUntil = null;

        if (newAttempts >= 5) {
            lockedUntil = new Date();
            lockedUntil.setMinutes(lockedUntil.getMinutes() + 30);
        }

        await pool.query(
            'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
            [newAttempts, lockedUntil, user.id]
        );
    }

    async checkRateLimit(email, ipAddress) {
        const query = `
            SELECT COUNT(*) as attempts
            FROM login_attempts
            WHERE (email = $1 OR ip_address = $2)
            AND attempted_at > NOW() - INTERVAL '15 minutes'
        `;
        const result = await pool.query(query, [email, ipAddress]);
        const attempts = parseInt(result.rows[0].attempts);

        if (attempts > 10) {
            throw new Error('Too many login attempts. Please try again later.');
        }
    }

    async logFailedAttempt(email, ipAddress, success) {
        await pool.query(
            'INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, $3)',
            [email, ipAddress, success]
        );
    }

    async logAudit(userId, action, resourceType, resourceId, details) {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, action, resourceType, resourceId, details]
        );
    }

    getDashboardRoute(role) {
        const routes = {
            'admin': '/admin/dashboard',
            'provider': '/provider/dashboard',
            'customer': '/dashboard'
        };
        return routes[role] || '/dashboard';
    }

    async register(userData) {
        const { email, phone, password, fullName, role = 'customer' } = userData;
        
        if (!email || !phone || !password || !fullName) {
            throw new Error('All fields are required');
        }

        const existingUser = await this.findUserByEmailOrPhone(email);
        if (existingUser) {
            throw new Error('User already exists with this email or phone');
        }

        this.validatePasswordStrength(password);

        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const query = `
            INSERT INTO users (email, phone, password_hash, full_name, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, phone, full_name, role, is_verified, created_at
        `;
        const result = await pool.query(query, [
            email,
            phone,
            passwordHash,
            fullName,
            role
        ]);

        const user = result.rows[0];

        await this.logAudit(user.id, 'REGISTER', 'user', user.id, {
            email: user.email,
            role: user.role
        });

        return user;
    }

    async login(credentials, ipAddress, userAgent) {
        const { email, password } = credentials;

        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        await this.checkRateLimit(email, ipAddress);

        const user = await this.findUserByEmailOrPhone(email);
        if (!user) {
            await this.logFailedAttempt(email, ipAddress, false);
            throw new Error('Invalid credentials');
        }

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            throw new Error(`Account locked until ${new Date(user.locked_until).toLocaleString()}`);
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            await this.handleFailedLogin(user);
            await this.logFailedAttempt(email, ipAddress, false);
            throw new Error('Invalid credentials');
        }

        if (!user.is_active) {
            throw new Error('Account has been deactivated');
        }

        const session = await this.createSession(user, ipAddress, userAgent);

        await pool.query(
            'UPDATE users SET last_login = NOW(), last_ip = $1, login_attempts = 0 WHERE id = $2',
            [ipAddress, user.id]
        );

        await this.logAudit(user.id, 'LOGIN', 'user', user.id, {
            email: user.email,
            ip: ipAddress,
            role: user.role
        });

        const token = this.generateToken(user);
        const dashboardRoute = this.getDashboardRoute(user.role);

        return {
            token,
            sessionId: session.id,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                fullName: user.full_name,
                role: user.role,
                isVerified: user.is_verified,
                twoFactorEnabled: user.two_factor_enabled
            },
            dashboardRoute,
            requiresTwoFactor: user.role === 'admin' && user.two_factor_enabled
        };
    }
}

module.exports = new AuthService();
