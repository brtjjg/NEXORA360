const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool to PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'nexora',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

// Initialize database tables
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'customer',
                is_verified BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                phone_verified BOOLEAN DEFAULT FALSE,
                two_factor_enabled BOOLEAN DEFAULT FALSE,
                two_factor_secret VARCHAR(255),
                last_login TIMESTAMP,
                last_ip VARCHAR(45),
                login_attempts INT DEFAULT 0,
                locked_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            )
        `);

        // Create services table
        await client.query(`
            CREATE TABLE IF NOT EXISTS services (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                provider_id UUID REFERENCES users(id),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100) NOT NULL,
                starting_price_kes INTEGER,
                starting_price_usd INTEGER,
                pricing_model VARCHAR(50) DEFAULT 'starting_from',
                is_custom_quote BOOLEAN DEFAULT FALSE,
                delivery_days INTEGER,
                rating DECIMAL(3,2) DEFAULT 0,
                total_orders INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create packages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS packages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                service_id UUID REFERENCES services(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                price_kes INTEGER NOT NULL,
                price_usd INTEGER NOT NULL,
                features TEXT[],
                is_recommended BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create orders table
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_id UUID REFERENCES users(id),
                provider_id UUID REFERENCES users(id),
                service_id UUID REFERENCES services(id),
                package_id UUID REFERENCES packages(id),
                status VARCHAR(50) DEFAULT 'pending',
                requirements TEXT,
                deadline DATE,
                total_amount_kes INTEGER,
                total_amount_usd INTEGER,
                platform_fee_kes INTEGER,
                provider_earnings_kes INTEGER,
                platform_fee_usd INTEGER,
                provider_earnings_usd INTEGER,
                payment_status VARCHAR(50) DEFAULT 'pending',
                transaction_reference VARCHAR(255),
                files JSONB,
                delivery_notes TEXT,
                delivered_at TIMESTAMP,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create transactions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID REFERENCES orders(id),
                user_id UUID REFERENCES users(id),
                amount_kes INTEGER,
                amount_usd INTEGER,
                method VARCHAR(50),
                status VARCHAR(50),
                reference VARCHAR(255),
                mpesa_receipt VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create reviews table
        await client.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID REFERENCES orders(id),
                customer_id UUID REFERENCES users(id),
                provider_id UUID REFERENCES users(id),
                service_id UUID REFERENCES services(id),
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create messages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID REFERENCES orders(id),
                sender_id UUID REFERENCES users(id),
                receiver_id UUID REFERENCES users(id),
                content TEXT,
                type VARCHAR(50) DEFAULT 'text',
                file_url TEXT,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create audit logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id),
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(50),
                resource_id UUID,
                details JSONB,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create admin sessions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id),
                session_token VARCHAR(255) UNIQUE NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                revoked BOOLEAN DEFAULT FALSE
            )
        `);

        // Create login attempts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS login_attempts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255),
                ip_address VARCHAR(45),
                success BOOLEAN,
                attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_services_category ON services(category)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_provider ON orders(provider_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`);

        await client.query('COMMIT');
        console.log('✅ Database tables created successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Database initialization failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { pool, testConnection, initializeDatabase };
