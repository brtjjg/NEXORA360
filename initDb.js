const { pool } = require('../config/database');
const authService = require('../config/auth');
const bcrypt = require('bcrypt');

const createAdminUser = async () => {
    try {
        // Check if admin exists
        const checkQuery = 'SELECT * FROM users WHERE role = $1 AND is_active = true';
        const checkResult = await pool.query(checkQuery, ['admin']);

        if (checkResult.rows.length > 0) {
            console.log('✅ Admin user already exists');
            return;
        }

        // Create admin user
        const adminData = {
            email: 'admin@nexora.com',
            phone: '0712345678',
            password: 'Admin@2026!',
            fullName: 'NEXORA Admin'
        };

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(adminData.password, saltRounds);

        // Insert admin
        const query = `
            INSERT INTO users (email, phone, password_hash, full_name, role, is_verified, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, email, role
        `;

        const result = await pool.query(query, [
            adminData.email,
            adminData.phone,
            passwordHash,
            adminData.fullName,
            'admin',
            true,
            true
        ]);

        console.log('✅ Admin user created successfully');
        console.log(`📧 Email: ${adminData.email}`);
        console.log(`🔑 Password: ${adminData.password}`);
        console.log('⚠️  Please change password after first login');

        return result.rows[0];
    } catch (error) {
        console.error('❌ Failed to create admin user:', error.message);
        throw error;
    }
};

// Create test users for development
const createTestUsers = async () => {
    try {
        const testUsers = [
            {
                email: 'provider@nexora.com',
                phone: '0712345679',
                password: 'Provider@2026!',
                fullName: 'Test Provider',
                role: 'provider'
            },
            {
                email: 'customer@nexora.com',
                phone: '0712345680',
                password: 'Customer@2026!',
                fullName: 'Test Customer',
                role: 'customer'
            }
        ];

        for (const userData of testUsers) {
            const checkQuery = 'SELECT * FROM users WHERE email = $1';
            const checkResult = await pool.query(checkQuery, [userData.email]);

            if (checkResult.rows.length === 0) {
                const saltRounds = 12;
                const passwordHash = await bcrypt.hash(userData.password, saltRounds);

                await pool.query(
                    `INSERT INTO users (email, phone, password_hash, full_name, role, is_verified, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [userData.email, userData.phone, passwordHash, userData.fullName, userData.role, true, true]
                );
                console.log(`✅ Test ${userData.role} created: ${userData.email}`);
            }
        }
    } catch (error) {
        console.error('❌ Failed to create test users:', error.message);
    }
};

module.exports = { createAdminUser, createTestUsers };
