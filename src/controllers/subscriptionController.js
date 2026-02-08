const { pool } = require('../config/database');

class SubscriptionController {
    // Get all subscriptions
    async getAll(req, res, next) {
        try {
            const { payment_status, merchant_id } = req.query;
            
            let query = `
                SELECT sp.*, m.business_name, u.email as merchant_email, u.name as merchant_owner_name
                FROM subscription_payments sp
                LEFT JOIN merchants m ON sp.merchant_id = m.id
                LEFT JOIN users u ON m.user_id = u.id
            `;
            const params = [];
            const conditions = [];

            if (payment_status) {
                conditions.push('sp.payment_status = ?');
                params.push(payment_status);
            }

            if (merchant_id) {
                conditions.push('sp.merchant_id = ?');
                params.push(merchant_id);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY sp.created_at DESC';

            const [subscriptions] = await pool.query(query, params);
            res.json({ subscriptions });
        } catch (error) {
            next(error);
        }
    }

    // Get merchant's own subscriptions
    async getMerchantSubscriptions(req, res, next) {
        try {
            const userId = req.user.id;

            // Get merchant_id
            const [merchants] = await pool.query(
                'SELECT id FROM merchants WHERE user_id = ?',
                [userId]
            );

            if (merchants.length === 0) {
                return res.status(404).json({ error: 'Merchant profile not found' });
            }

            const merchantId = merchants[0].id;

            const [subscriptions] = await pool.query(
                'SELECT * FROM subscription_payments WHERE merchant_id = ? ORDER BY created_at DESC',
                [merchantId]
            );

            res.json({ subscriptions });
        } catch (error) {
            next(error);
        }
    }

    // Get subscription by ID
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            const [subscriptions] = await pool.query(
                `SELECT sp.*, m.business_name, u.email as merchant_email, u.name as merchant_owner_name
                 FROM subscription_payments sp
                 LEFT JOIN merchants m ON sp.merchant_id = m.id
                 LEFT JOIN users u ON m.user_id = u.id
                 WHERE sp.id = ?`,
                [id]
            );

            if (subscriptions.length === 0) {
                return res.status(404).json({ error: 'Subscription not found' });
            }

            res.json({ subscription: subscriptions[0] });
        } catch (error) {
            next(error);
        }
    }

    // Create subscription payment
    async create(req, res, next) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const { 
                merchant_id, amount, payment_method, payment_status, 
                transaction_id, payment_date, subscription_start_date, 
                subscription_end_date, notes 
            } = req.body;

            if (!merchant_id || !amount || !subscription_start_date || !subscription_end_date) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: 'Merchant, amount, start date, and end date are required' 
                });
            }

            // Create subscription payment record
            const [result] = await connection.query(
                `INSERT INTO subscription_payments 
                 (merchant_id, amount, payment_method, payment_status, transaction_id, 
                  payment_date, subscription_start_date, subscription_end_date, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    merchant_id, amount, payment_method || 'offline', 
                    payment_status || 'pending', transaction_id || null,
                    payment_date || null, subscription_start_date, 
                    subscription_end_date, notes || null
                ]
            );

            // If payment is completed, update merchant subscription status
            if (payment_status === 'completed') {
                await connection.query(
                    `UPDATE merchants 
                     SET subscription_status = 'active', 
                         subscription_start_date = ?, 
                         subscription_end_date = ?,
                         subscription_amount = ?
                     WHERE id = ?`,
                    [subscription_start_date, subscription_end_date, amount, merchant_id]
                );
            }

            await connection.commit();

            const [subscriptions] = await connection.query(
                `SELECT sp.*, m.business_name, u.email as merchant_email
                 FROM subscription_payments sp
                 LEFT JOIN merchants m ON sp.merchant_id = m.id
                 LEFT JOIN users u ON m.user_id = u.id
                 WHERE sp.id = ?`,
                [result.insertId]
            );

            res.status(201).json({
                message: 'Subscription payment created successfully',
                subscription: subscriptions[0]
            });
        } catch (error) {
            await connection.rollback();
            next(error);
        } finally {
            connection.release();
        }
    }

    // Update subscription payment
    async update(req, res, next) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const { id } = req.params;
            const { 
                amount, payment_method, payment_status, transaction_id, 
                payment_date, subscription_start_date, subscription_end_date, notes 
            } = req.body;

            // Get current subscription
            const [current] = await connection.query(
                'SELECT * FROM subscription_payments WHERE id = ?',
                [id]
            );

            if (current.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Subscription not found' });
            }

            // Update subscription payment
            await connection.query(
                `UPDATE subscription_payments 
                 SET amount = ?, payment_method = ?, payment_status = ?, transaction_id = ?,
                     payment_date = ?, subscription_start_date = ?, subscription_end_date = ?, notes = ?
                 WHERE id = ?`,
                [
                    amount || current[0].amount,
                    payment_method || current[0].payment_method,
                    payment_status || current[0].payment_status,
                    transaction_id,
                    payment_date,
                    subscription_start_date || current[0].subscription_start_date,
                    subscription_end_date || current[0].subscription_end_date,
                    notes,
                    id
                ]
            );

            // If payment status changed to completed, update merchant
            if (payment_status === 'completed' && current[0].payment_status !== 'completed') {
                await connection.query(
                    `UPDATE merchants 
                     SET subscription_status = 'active', 
                         subscription_start_date = ?, 
                         subscription_end_date = ?,
                         subscription_amount = ?
                     WHERE id = ?`,
                    [
                        subscription_start_date || current[0].subscription_start_date,
                        subscription_end_date || current[0].subscription_end_date,
                        amount || current[0].amount,
                        current[0].merchant_id
                    ]
                );
            }

            await connection.commit();

            const [subscriptions] = await connection.query(
                `SELECT sp.*, m.business_name as merchant_name
                 FROM subscription_payments sp
                 LEFT JOIN merchants m ON sp.merchant_id = m.id
                 WHERE sp.id = ?`,
                [id]
            );

            res.json({
                message: 'Subscription payment updated successfully',
                subscription: subscriptions[0]
            });
        } catch (error) {
            await connection.rollback();
            next(error);
        } finally {
            connection.release();
        }
    }

    // Delete subscription payment
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            const [result] = await pool.query(
                'DELETE FROM subscription_payments WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Subscription not found' });
            }

            res.json({ message: 'Subscription payment deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SubscriptionController();
