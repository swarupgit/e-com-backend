const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
    // Prefer full connection string if available (set this in Vercel env)
    const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

    const poolConfig = connectionString ? {
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    } : {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'mydb',
        port: Number(process.env.DB_PORT) || 5432,
        ssl: { rejectUnauthorized: false }, // Supabase requires SSL
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    };

    const pool = new Pool(poolConfig);

    // Log which connection source is used (mask sensitive parts)
    try {
        if (connectionString) {
            try {
                const parsed = new URL(connectionString);
                const hostInfo = parsed.hostname + (parsed.port ? `:${parsed.port}` : '');
                console.log(`Using Postgres connection string (host: ${hostInfo})`);
            } catch (e) {
                console.log('Using Postgres connection string (host parsing failed)');
            }
        } else {
            console.log(`Using Postgres host/port: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
        }
    } catch (e) {
        // ignore logging errors
    }

    // Normalize pg Pool.query to return [rows, fields] like mysql2 and
    // convert MySQL-style `?` placeholders to Postgres $1,$2... so existing
    // code using `?` continues to work.
    const _origQuery = pool.query.bind(pool);
    pool.query = async (text, params) => {
        let newText = text;
        // If params exist and text contains '?', replace them with $1, $2, ...
        if (params && params.length > 0 && typeof text === 'string' && text.indexOf('?') !== -1) {
            let i = 0;
            newText = text.replace(/\?/g, () => {
                i += 1;
                return '$' + i;
            });
        }

        // For INSERT without RETURNING, add RETURNING id so we can mimic mysql insertId
        const isInsert = typeof newText === 'string' && /^\s*insert\s+/i.test(newText);
        const hasReturning = typeof newText === 'string' && /returning\s+/i.test(newText);
        let execText = newText;
        if (isInsert && !hasReturning) {
            execText = `${newText} RETURNING id`;
        }

        const res = await _origQuery(execText, params);

        // Normalize responses to mysql2 shape
        if (res.command === 'SELECT') {
            return [res.rows, res.fields];
        }

        if (res.command === 'INSERT') {
            const insertId = res.rows && res.rows[0] ? (res.rows[0].id || null) : null;
            const resultObj = {
                insertId,
                affectedRows: res.rowCount
            };
            return [resultObj, res.fields];
        }

        // For UPDATE/DELETE and others
        const resultObj = {
            affectedRows: res.rowCount
        };
        return [resultObj, res.fields];
    };

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
