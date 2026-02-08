const bcrypt = require('bcryptjs');
require('dotenv').config();

const { pool, testConnection } = require('../src/config/database');

const getInsertId = (result) => {
    if (!result) return null;
    if (Array.isArray(result) && result.length > 0 && result[0] && typeof result[0] === 'object' && 'insertId' in result[0]) return result[0].insertId;
    if (result && typeof result === 'object' && 'insertId' in result) return result.insertId;
    if (result && result.rows && result.rows[0] && result.rows[0].id) return result.rows[0].id;
    return null;
};

const run = async () => {
    try {
        await testConnection();

        const email = process.env.MERCHANT_EMAIL || 'merchant1@example.com';
        const password = process.env.MERCHANT_PASSWORD || 'merchant123';
        const name = process.env.MERCHANT_NAME || 'Merchant One';
        const phone = process.env.MERCHANT_PHONE || '9876543210';

        const hashed = await bcrypt.hash(password, 10);

        // Insert user
        const insertUserSql = `INSERT INTO users (email, password, name, phone, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const now = new Date();
        const createdAt = now.toISOString().slice(0, 19).replace('T', ' ');
        const updatedAt = createdAt;
        const [userResult] = await pool.query(insertUserSql, [email, hashed, name, phone, 'merchant', true, createdAt, updatedAt]);
        const userId = getInsertId(userResult);
        if (!userId) throw new Error('Failed to get inserted user id');
        console.log('Inserted user id:', userId);

        // Insert merchant profile
        const businessName = process.env.MERCHANT_BUSINESS || 'Local Grocery Store';
        const businessAddress = process.env.MERCHANT_ADDRESS || '123 Main Street, City';
        const contactPhone = phone;
        const contactEmail = email;
        const subStart = new Date();
        const subEnd = new Date(subStart);
        subEnd.setDate(subEnd.getDate() + 30);
        const subStartStr = subStart.toISOString().slice(0, 10);
        const subEndStr = subEnd.toISOString().slice(0, 10);

        // Note: merchants table does not have contact_phone/contact_email in PostgreSQL schema
        const insertMerchantSql = `INSERT INTO merchants (user_id, business_name, business_address, category_id, subscription_status, subscription_start_date, subscription_end_date, subscription_amount, payment_method, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [merchantResult] = await pool.query(insertMerchantSql, [userId, businessName, businessAddress, null, 'active', subStartStr, subEndStr, 3000.00, 'offline', true, createdAt, updatedAt]);
        const merchantId = getInsertId(merchantResult);
        if (!merchantId) throw new Error('Failed to get inserted merchant id');
        console.log('Inserted merchant id:', merchantId);

        // Insert sample merchant products (assumes items_master ids exist)
        const products = [
            { item_master_id: 1, custom_name: 'Local Rice 5kg', price: 250.00, stock_quantity: 20 },
            { item_master_id: 2, custom_name: 'Local Wheat Flour 5kg', price: 200.00, stock_quantity: 15 }
        ];

        for (const p of products) {
            const insertProductSql = `INSERT INTO merchant_products (merchant_id, item_master_id, custom_name, price, stock_quantity, status, image_url, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const [prodRes] = await pool.query(insertProductSql, [merchantId, p.item_master_id, p.custom_name, p.price, p.stock_quantity, 'available', null, null, true, createdAt, updatedAt]);
            const prodId = getInsertId(prodRes);
            console.log('Inserted product id:', prodId);
        }

        console.log('Merchant seeding completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err.message);
        process.exit(1);
    }
};

run();
