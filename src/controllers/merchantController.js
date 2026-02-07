const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

class MerchantController {
    // Get all merchants
    async getAll(req, res, next) {
        try {
            const { subscription_status } = req.query;
            
            let query = `
                SELECT m.*, 
                       u.email, 
                       u.name, 
                       u.phone, 
                       c.name as category_name
                FROM merchants m
                LEFT JOIN users u ON m.user_id = u.id
                LEFT JOIN categories c ON m.category_id = c.id
            `;
            const params = [];

            if (subscription_status) {
                query += ' WHERE m.subscription_status = ?';
                params.push(subscription_status);
            }

            query += ' ORDER BY m.created_at DESC';

            const [merchants] = await pool.query(query, params);
            res.json({ merchants });
        } catch (error) {
            next(error);
        }
    }

    // Get merchant by ID
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            const [merchants] = await pool.query(
                `SELECT m.*, u.email, u.name as user_name, u.phone, c.name as category_name
                 FROM merchants m
                 LEFT JOIN users u ON m.user_id = u.id
                 LEFT JOIN categories c ON m.category_id = c.id
                 WHERE m.id = ?`,
                [id]
            );

            if (merchants.length === 0) {
                return res.status(404).json({ error: 'Merchant not found' });
            }

            res.json({ merchant: merchants[0] });
        } catch (error) {
            next(error);
        }
    }

    // Get merchant by user ID
    async getByUserId(req, res, next) {
        try {
            const userId = req.user.id;

            const [merchants] = await pool.query(
                `SELECT m.*, c.name as category_name
                 FROM merchants m
                 LEFT JOIN categories c ON m.category_id = c.id
                 WHERE m.user_id = ?`,
                [userId]
            );

            if (merchants.length === 0) {
                return res.status(404).json({ error: 'Merchant profile not found' });
            }

            res.json({ merchant: merchants[0] });
        } catch (error) {
            next(error);
        }
    }

    // Create merchant (register merchant account)
    async create(req, res, next) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const { 
                email, password, name, phone,
                business_name, business_address, category_id 
            } = req.body;

            if (!email || !password || !name || !business_name) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: 'Email, password, name, and business name are required' 
                });
            }

            // Check if email exists
            const [existingUsers] = await connection.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existingUsers.length > 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Email already registered' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user with merchant role
            const [userResult] = await connection.query(
                'INSERT INTO users (email, password, name, phone, role) VALUES (?, ?, ?, ?, ?)',
                [email, hashedPassword, name, phone || null, 'merchant']
            );

            // Create merchant profile
            const [merchantResult] = await connection.query(
                `INSERT INTO merchants (user_id, business_name, business_address, category_id) 
                 VALUES (?, ?, ?, ?)`,
                [userResult.insertId, business_name, business_address || null, category_id || null]
            );

            await connection.commit();

            const [merchants] = await connection.query(
                `SELECT m.*, u.email, u.name as user_name, u.phone, c.name as category_name
                 FROM merchants m
                 LEFT JOIN users u ON m.user_id = u.id
                 LEFT JOIN categories c ON m.category_id = c.id
                 WHERE m.id = ?`,
                [merchantResult.insertId]
            );

            res.status(201).json({
                message: 'Merchant account created successfully',
                merchant: merchants[0]
            });
        } catch (error) {
            await connection.rollback();
            next(error);
        } finally {
            connection.release();
        }
    }

    // Update merchant
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                business_name, business_address, category_id,
                subscription_status, subscription_start_date, subscription_end_date,
                subscription_amount, is_verified 
            } = req.body;

            if (!business_name) {
                return res.status(400).json({ error: 'Business name is required' });
            }

            const [result] = await pool.query(
                `UPDATE merchants 
                 SET business_name = ?, business_address = ?, category_id = ?,
                     subscription_status = ?, subscription_start_date = ?, subscription_end_date = ?,
                     subscription_amount = ?, is_verified = ?
                 WHERE id = ?`,
                [
                    business_name, 
                    business_address || null, 
                    category_id || null,
                    subscription_status || 'inactive',
                    subscription_start_date || null,
                    subscription_end_date || null,
                    subscription_amount || 3000,
                    is_verified !== undefined ? is_verified : false,
                    id
                ]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Merchant not found' });
            }

            const [merchants] = await pool.query(
                `SELECT m.*, u.email, u.name as user_name, u.phone, c.name as category_name
                 FROM merchants m
                 LEFT JOIN users u ON m.user_id = u.id
                 LEFT JOIN categories c ON m.category_id = c.id
                 WHERE m.id = ?`,
                [id]
            );

            res.json({
                message: 'Merchant updated successfully',
                merchant: merchants[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Update own merchant profile
    async updateOwnProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const { business_name, business_address, category_id } = req.body;

            if (!business_name) {
                return res.status(400).json({ error: 'Business name is required' });
            }

            const [result] = await pool.query(
                `UPDATE merchants 
                 SET business_name = ?, business_address = ?, category_id = ?
                 WHERE user_id = ?`,
                [business_name, business_address || null, category_id || null, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Merchant profile not found' });
            }

            const [merchants] = await pool.query(
                `SELECT m.*, c.name as category_name
                 FROM merchants m
                 LEFT JOIN categories c ON m.category_id = c.id
                 WHERE m.user_id = ?`,
                [userId]
            );

            res.json({
                message: 'Merchant profile updated successfully',
                merchant: merchants[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete merchant
    async delete(req, res, next) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const { id } = req.params;

            // Get merchant user_id
            const [merchants] = await connection.query(
                'SELECT user_id FROM merchants WHERE id = ?',
                [id]
            );

            if (merchants.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Merchant not found' });
            }

            // Delete merchant (cascades to products)
            await connection.query('DELETE FROM merchants WHERE id = ?', [id]);

            // Delete user account
            await connection.query('DELETE FROM users WHERE id = ?', [merchants[0].user_id]);

            await connection.commit();
            res.json({ message: 'Merchant deleted successfully' });
        } catch (error) {
            await connection.rollback();
            next(error);
        } finally {
            connection.release();
        }
    }

    // Verify/Unverify merchant
    async verify(req, res, next) {
        try {
            const { id } = req.params;
            const { is_verified } = req.body;

            const [result] = await pool.query(
                'UPDATE merchants SET is_verified = ? WHERE id = ?',
                [is_verified, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Merchant not found' });
            }

            res.json({ 
                message: `Merchant ${is_verified ? 'verified' : 'unverified'} successfully` 
            });
        } catch (error) {
            next(error);
        }
    }

    // Update merchant subscription
    async updateSubscription(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                subscription_status, 
                subscription_start_date, 
                subscription_end_date 
            } = req.body;

            const [result] = await pool.query(
                `UPDATE merchants 
                 SET subscription_status = ?, 
                     subscription_start_date = ?, 
                     subscription_end_date = ? 
                 WHERE id = ?`,
                [subscription_status, subscription_start_date, subscription_end_date, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Merchant not found' });
            }

            res.json({ message: 'Subscription updated successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new MerchantController();
