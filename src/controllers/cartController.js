const { pool } = require('../config/database');

class CartController {
    // Get cart items
    async getCart(req, res, next) {
        try {
            const userId = req.user.id;

            const [items] = await pool.query(
                `SELECT c.*, mp.price, mp.status, mp.image_url, mp.custom_name,
                        im.name as item_name, im.unit,
                        m.id as merchant_id, m.business_name as merchant_name,
                        (mp.price * c.quantity) as subtotal
                 FROM cart c
                 LEFT JOIN merchant_products mp ON c.merchant_product_id = mp.id
                 LEFT JOIN items_master im ON mp.item_master_id = im.id
                 LEFT JOIN merchants m ON mp.merchant_id = m.id
                 WHERE c.user_id = ?
                 ORDER BY c.created_at DESC`,
                [userId]
            );

            const total = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

            res.json({ 
                cart_items: items,
                total: total.toFixed(2),
                item_count: items.length
            });
        } catch (error) {
            next(error);
        }
    }

    // Add item to cart
    async addItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { merchant_product_id, quantity } = req.body;

            if (!merchant_product_id || !quantity || quantity < 1) {
                return res.status(400).json({ 
                    error: 'Valid product ID and quantity are required' 
                });
            }

            // Check if product exists and is available
            const [products] = await pool.query(
                'SELECT status FROM merchant_products WHERE id = ?',
                [merchant_product_id]
            );

            if (products.length === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }

            if (products[0].status !== 'available') {
                return res.status(400).json({ error: 'Product is not available' });
            }

            // Check if item already in cart
            const [existing] = await pool.query(
                'SELECT id, quantity FROM cart WHERE user_id = ? AND merchant_product_id = ?',
                [userId, merchant_product_id]
            );

            if (existing.length > 0) {
                // Update quantity
                await pool.query(
                    'UPDATE cart SET quantity = quantity + ? WHERE id = ?',
                    [quantity, existing[0].id]
                );
            } else {
                // Add new item
                await pool.query(
                    'INSERT INTO cart (user_id, merchant_product_id, quantity) VALUES (?, ?, ?)',
                    [userId, merchant_product_id, quantity]
                );
            }

            res.json({ message: 'Item added to cart successfully' });
        } catch (error) {
            next(error);
        }
    }

    // Update cart item quantity
    async updateItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { quantity } = req.body;

            if (!quantity || quantity < 1) {
                return res.status(400).json({ error: 'Valid quantity is required' });
            }

            const [result] = await pool.query(
                'UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?',
                [quantity, id, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    error: 'Cart item not found or access denied' 
                });
            }

            res.json({ message: 'Cart updated successfully' });
        } catch (error) {
            next(error);
        }
    }

    // Remove item from cart
    async removeItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [result] = await pool.query(
                'DELETE FROM cart WHERE id = ? AND user_id = ?',
                [id, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    error: 'Cart item not found or access denied' 
                });
            }

            res.json({ message: 'Item removed from cart successfully' });
        } catch (error) {
            next(error);
        }
    }

    // Clear cart
    async clearCart(req, res, next) {
        try {
            const userId = req.user.id;

            await pool.query('DELETE FROM cart WHERE user_id = ?', [userId]);

            res.json({ message: 'Cart cleared successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CartController();
