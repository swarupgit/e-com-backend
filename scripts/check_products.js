require('dotenv').config();
const { pool, testConnection } = require('../src/config/database');

const run = async () => {
    try {
        await testConnection();

        const merchantEmail = process.env.MERCHANT_EMAIL || 'merchant1@example.com';

        const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [merchantEmail]);
        console.log('Users with email', merchantEmail, users.length);
        if (users.length === 0) return;
        const userId = users[0].id;

        const [merchants] = await pool.query('SELECT id FROM merchants WHERE user_id = ?', [userId]);
        console.log('Merchants for user', userId, merchants.length);
        if (merchants.length === 0) return;
        const merchantId = merchants[0].id;

        const [productsForMerchant] = await pool.query('SELECT * FROM merchant_products WHERE merchant_id = ?', [merchantId]);
        console.log('Products for merchant', merchantId, productsForMerchant.length);
        console.dir(productsForMerchant, { depth: null });

        const [allProducts] = await pool.query('SELECT * FROM merchant_products LIMIT 50');
        console.log('Total products in merchant_products table:', allProducts.length);

        const [itemsMaster] = await pool.query('SELECT * FROM items_master LIMIT 50');
        console.log('Items master rows:', itemsMaster.length);

    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        try { await pool.end(); } catch(e){}
    }
};

run();
