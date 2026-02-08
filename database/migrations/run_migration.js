require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('Adding is_active column to merchants table...');
        
        await pool.query(`
            ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
        `);
        
        console.log('✓ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
