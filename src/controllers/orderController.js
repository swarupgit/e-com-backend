const { pool } = require('../config/database');

class OrderController {
    // Get all orders (Admin)
    async getAll(req, res, next) {
        try {
            const { status, merchant_id } = req.query;
            
            let query = `
                SELECT o.*, m.business_name as merchant_name,
                       u.name as customer_name, u.email as customer_email
                FROM orders o
                LEFT JOIN merchants m ON o.merchant_id = m.id
                LEFT JOIN users u ON o.user_id = u.id
            `;
            const params = [];
            const conditions = [];

            if (status) {
                conditions.push('o.status = ?');
                params.push(status);
            }

            if (merchant_id) {
                conditions.push('o.merchant_id = ?');
                params.push(merchant_id);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY o.created_at DESC';

            const [orders] = await pool.query(query, params);
            res.json({ orders });
        } catch (error) {
            next(error);
        }
    }

    // Get merchant's orders
    async getMerchantOrders(req, res, next) {
        try {
            const userId = req.user.id;
            const { status } = req.query;

            // Get merchant_id
            const [merchants] = await pool.query(
                'SELECT id FROM merchants WHERE user_id = ?',
                [userId]
            );

            if (merchants.length === 0) {
                return res.status(404).json({ error: 'Merchant profile not found' });
            }

            const merchantId = merchants[0].id;

            let query = `
                SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                WHERE o.merchant_id = ?
            `;
            const params = [merchantId];

            if (status) {
                query += ' AND o.status = ?';
                params.push(status);
            }

            query += ' ORDER BY o.created_at DESC';

            const [orders] = await pool.query(query, params);
            res.json({ orders });
        } catch (error) {
            next(error);
        }
    }

    // Get user's orders
    async getUserOrders(req, res, next) {
        try {
            const userId = req.user.id;

            const [orders] = await pool.query(
                `SELECT o.*, m.business_name as merchant_name,
                 (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
                 FROM orders o
                 LEFT JOIN merchants m ON o.merchant_id = m.id
                 WHERE o.user_id = ?
                 ORDER BY o.created_at DESC`,
                [userId]
            );

            res.json({ orders });
        } catch (error) {
            next(error);
        }
    }

    // Get order by ID with items
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            const [orders] = await pool.query(
                `SELECT o.*, m.business_name as merchant_name,
                        u.name as customer_name, u.email as customer_email, u.phone as customer_phone
                 FROM orders o
                 LEFT JOIN merchants m ON o.merchant_id = m.id
                 LEFT JOIN users u ON o.user_id = u.id
                 WHERE o.id = ?`,
                [id]
            );

            if (orders.length === 0) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // Get order items
            const [items] = await pool.query(
                `SELECT oi.*, mp.image_url
                 FROM order_items oi
                 LEFT JOIN merchant_products mp ON oi.merchant_product_id = mp.id
                 WHERE oi.order_id = ?`,
                [id]
            );

            res.json({ 
                order: {
                    ...orders[0],
                    items
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Create order (checkout)
    async create(req, res, next) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const userId = req.user ? req.user.id : null;
            const { 
                merchant_id, delivery_address, payment_method, notes,
                guest_name, guest_email, guest_phone, items 
            } = req.body;

            // Validate required fields
            if (!merchant_id || !delivery_address || !items || items.length === 0) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: 'Merchant, delivery address, and items are required' 
                });
            }

            // For guest checkout, require guest details
            if (!userId && (!guest_name || !guest_email || !guest_phone)) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: 'Guest name, email, and phone are required for guest checkout' 
                });
            }

            // Calculate total
            let totalAmount = 0;
            for (const item of items) {
                const [products] = await connection.query(
                    'SELECT price, status FROM merchant_products WHERE id = ? AND merchant_id = ?',
                    [item.merchant_product_id, merchant_id]
                );

                if (products.length === 0 || products[0].status !== 'available') {
                    await connection.rollback();
                    return res.status(400).json({ 
                        error: `Product ${item.merchant_product_id} is not available` 
                    });
                }

                totalAmount += products[0].price * item.quantity;
            }

            // Generate order number
            const orderNumber = 'ORD' + Date.now() + Math.floor(Math.random() * 1000);

            // Create order
            const [orderResult] = await connection.query(
                `INSERT INTO orders 
                 (order_number, user_id, merchant_id, guest_name, guest_email, guest_phone,
                  delivery_address, total_amount, payment_method, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderNumber, userId, merchant_id,
                    guest_name || null, guest_email || null, guest_phone || null,
                    delivery_address, totalAmount, payment_method || 'cod', notes || null
                ]
            );

            const orderId = orderResult.insertId;

            // Insert order items
            for (const item of items) {
                const [products] = await connection.query(
                    'SELECT price, custom_name, im.name FROM merchant_products mp LEFT JOIN items_master im ON mp.item_master_id = im.id WHERE mp.id = ?',
                    [item.merchant_product_id]
                );

                const productName = products[0].custom_name || products[0].name;
                const price = products[0].price;
                const subtotal = price * item.quantity;

                await connection.query(
                    `INSERT INTO order_items 
                     (order_id, merchant_product_id, product_name, price, quantity, subtotal) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [orderId, item.merchant_product_id, productName, price, item.quantity, subtotal]
                );

                // Update product stock
                await connection.query(
                    'UPDATE merchant_products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                    [item.quantity, item.merchant_product_id]
                );
            }

            // Clear cart if user is logged in
            if (userId) {
                await connection.query('DELETE FROM cart WHERE user_id = ?', [userId]);
            }

            await connection.commit();

            // Fetch complete order
            const [orders] = await connection.query(
                `SELECT o.*, m.business_name as merchant_name
                 FROM orders o
                 LEFT JOIN merchants m ON o.merchant_id = m.id
                 WHERE o.id = ?`,
                [orderId]
            );

            res.status(201).json({
                message: 'Order placed successfully',
                order: orders[0]
            });
        } catch (error) {
            await connection.rollback();
            next(error);
        } finally {
            connection.release();
        }
    }

    // Update order status
    async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, itemAvailability } = req.body;

            const validStatuses = [
                'pending', 'accepted', 'partial_accepted', 'rejected', 
                'processing', 'partial_processing', 'out_for_delivery', 
                'delivered', 'cancelled'
            ];

            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({ 
                    error: `Status must be one of: ${validStatuses.join(', ')}` 
                });
            }

            // For merchants, verify ownership
            if (req.user.role === 'merchant') {
                const [merchants] = await pool.query(
                    'SELECT id FROM merchants WHERE user_id = ?',
                    [req.user.id]
                );

                if (merchants.length === 0) {
                    return res.status(403).json({ error: 'Merchant profile not found' });
                }

                // If itemAvailability is provided, update individual items
                if (itemAvailability && typeof itemAvailability === 'object') {
                    // Get order items
                    const [items] = await pool.query(
                        'SELECT id FROM order_items WHERE order_id = ? ORDER BY id',
                        [id]
                    );

                    // Update each item's availability
                    for (let i = 0; i < items.length; i++) {
                        const isAvailable = itemAvailability[i] !== false;
                        await pool.query(
                            'UPDATE order_items SET is_available = ? WHERE id = ?',
                            [isAvailable, items[i].id]
                        );
                    }
                }

                const [result] = await pool.query(
                    'UPDATE orders SET status = ? WHERE id = ? AND merchant_id = ?',
                    [status, id, merchants[0].id]
                );

                if (result.affectedRows === 0) {
                    return res.status(404).json({ 
                        error: 'Order not found or access denied' 
                    });
                }
            } else {
                // Admin can update any order
                const [result] = await pool.query(
                    'UPDATE orders SET status = ? WHERE id = ?',
                    [status, id]
                );

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Order not found' });
                }
            }

            res.json({ message: 'Order status updated successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new OrderController();
