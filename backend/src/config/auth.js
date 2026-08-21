const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('./database');
require('dotenv').config();

class AuthService {
    async findUserByEmailOrPhone(identifier) {
        const query = `SELECT * FROM users WHERE (email = $1 OR phone = $1) AND deleted_at IS NULL`;
        const result = await pool.query(query, [identifier]);
        return result.rows[0] || null;
    }

    generateToken(user) {
        return jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'nexora-secret',
            { expiresIn: process.env.JWT_EXPIRY || '7d' }
        );
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET || 'nexora-secret');
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async register(userData) {
        const { email, phone, password, fullName, role = 'customer' } = userData;
        
        const existingUser = await this.findUserByEmailOrPhone(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const query = `
            INSERT INTO users (email, phone, password_hash, full_name, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, phone, full_name, role
        `;
        const result = await pool.query(query, [email, phone, passwordHash, fullName, role]);
        return result.rows[0];
    }

    async login(credentials) {
        const { email, password } = credentials;
        const user = await this.findUserByEmailOrPhone(email);
        
        if (!user) {
            throw new Error('Invalid credentials');
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            throw new Error('Invalid credentials');
        }

        const token = this.generateToken(user);
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                fullName: user.full_name,
                role: user.role
            }
        };
    }
}

module.exports = new AuthService();
