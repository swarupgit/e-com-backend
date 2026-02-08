const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'mydb',
        port: Number(process.env.DB_PORT) || 5432,
        ssl: { rejectUnauthorized: false }, // Supabase requires SSL
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });

    const testConnection = async () => {
        try {
            const client = await pool.connect();
            console.log('✓ PostgreSQL connected successfully');
            client.release();
        } catch (error) {
            console.error('✗ PostgreSQL connection failed:', error.message);
            process.exit(1);
        }
    };

    module.exports = { pool, testConnection };
} else {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ecommerce_db',
        port: Number(process.env.DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    // Test database connection
    const testConnection = async () => {
        try {
            const connection = await pool.getConnection();
            console.log('✓ Database connected successfully');
            connection.release();
        } catch (error) {
            console.error('✗ Database connection failed:', error.message);
            process.exit(1);
        }
    };

    module.exports = { pool, testConnection };
}
