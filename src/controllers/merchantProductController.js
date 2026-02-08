const { pool } = require('../config/database');
const { getCachedData, invalidateCachePattern } = require('../utils/cacheHelper');

class MerchantProductController {
    // Get all merchant products
    async getAll(req, res, next) {
        try {
            const { merchant_id, status, category_id } = req.query;
            
            // Create cache key based on query parameters
            const cacheKey = `products:${merchant_id || 'all'}:${status || 'all'}:${category_id || 'all'}`;
            
            // Use cached data if available, otherwise fetch from DB
            const products = await getCachedData(
                cacheKey,
                async () => {
                    let query = `
                        SELECT mp.*, im.name as item_name, im.unit, c.name as category_name,
                               m.business_name as merchant_name
                        FROM merchant_products mp
                        LEFT JOIN items_master im ON mp.item_master_id = im.id
                        LEFT JOIN merchants m ON mp.merchant_id = m.id
                        LEFT JOIN categories c ON im.category_id = c.id
                        WHERE m.is_verified = TRUE 
                        AND m.subscription_status = 'active'
                        AND m.is_active = TRUE
                    `;
                    const params = [];
                    const conditions = [];

                    if (merchant_id) {
                        conditions.push('mp.merchant_id = ?');
                        params.push(merchant_id);
                    }

                    if (status) {
                        conditions.push('mp.status = ?');
                        params.push(status);
                    }

                    if (category_id) {
                        conditions.push('im.category_id = ?');
                        params.push(category_id);
                    }

                    if (conditions.length > 0) {
                        query += ' AND ' + conditions.join(' AND ');
                    }

                    query += ' ORDER BY mp.created_at DESC';

                    const [result] = await pool.query(query, params);
                    return result;
                },
                1800 // Cache for 30 minutes
            );
            
            res.json({ products });
        } catch (error) {
            next(error);
        }
    }

    // Get products for current merchant
    async getOwnProducts(req, res, next) {
        try {
            const userId = req.user.id;
            const { status } = req.query;

            // Get merchant_id from user_id
            const [merchants] = await pool.query(
                'SELECT id FROM merchants WHERE user_id = ?',
                [userId]
            );

            if (merchants.length === 0) {
                return res.status(404).json({ error: 'Merchant profile not found' });
            }

            const merchantId = merchants[0].id;

            // Create cache key
            const cacheKey = `merchant:${merchantId}:products:${status || 'all'}`;
            
            // Use cached data if available
            const products = await getCachedData(
                cacheKey,
                async () => {
                    let query = `
                        SELECT mp.*, im.name as item_name, im.unit, c.name as category_name
                        FROM merchant_products mp
                        LEFT JOIN items_master im ON mp.item_master_id = im.id
                        LEFT JOIN categories c ON im.category_id = c.id
                        WHERE mp.merchant_id = ?
                    `;
                    const params = [merchantId];

                    if (status) {
                        query += ' AND mp.status = ?';
                        params.push(status);
                    }

                    query += ' ORDER BY mp.created_at DESC';

                    const [result] = await pool.query(query, params);
                    return result;
                },
                1800 // Cache for 30 minutes
            );
            
            res.json({ products });
        } catch (error) {
            next(error);
        }
    }

    // Get product by ID
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            // Use cached data if available
            const product = await getCachedData(
                `product:${id}`,
                async () => {
                    const [products] = await pool.query(
                        `SELECT mp.*, im.name as item_name, im.unit, c.name as category_name,
                                m.business_name as merchant_name
                         FROM merchant_products mp
                         LEFT JOIN items_master im ON mp.item_master_id = im.id
                         LEFT JOIN merchants m ON mp.merchant_id = m.id
                         LEFT JOIN categories c ON im.category_id = c.id
                         WHERE mp.id = ?`,
                        [id]
                    );
                    return products.length > 0 ? products[0] : null;
                },
                3600 // Cache for 1 hour
            );

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            res.json({ product });
        } catch (error) {
            next(error);
        }
    }

    // Create merchant product
    async create(req, res, next) {
        try {
            const userId = req.user.id;
            const { 
                item_master_id, custom_name, price, stock_quantity, 
                status, description, is_active 
            } = req.body;

            if (!item_master_id || !price) {
                return res.status(400).json({ 
                    error: 'Item master ID and price are required' 
                });
            }

            // Get merchant_id
            const [merchants] = await pool.query(
                'SELECT id FROM merchants WHERE user_id = ?',
                [userId]
            );

            if (merchants.length === 0) {
                return res.status(403).json({ error: 'Merchant profile not found' });
            }

            const merchantId = merchants[0].id;

            // Handle file upload if exists
            const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

            const [result] = await pool.query(
                `INSERT INTO merchant_products 
                 (merchant_id, item_master_id, custom_name, price, stock_quantity, status, image_url, description, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    merchantId, 
                    item_master_id, 
                    custom_name || null, 
                    price, 
                    stock_quantity || 0,
                    status || 'available',
                    imageUrl,
                    description || null,
                    is_active !== false
                ]
            );

            const [products] = await pool.query(
                `SELECT mp.*, im.name as item_name, im.unit, c.name as category_name
                 FROM merchant_products mp
                 LEFT JOIN items_master im ON mp.item_master_id = im.id
                 LEFT JOIN categories c ON im.category_id = c.id
                 WHERE mp.id = ?`,
                [result.insertId]
            );

            // Invalidate product caches
            await invalidateCachePattern('products:*');

            res.status(201).json({
                message: 'Product created successfully',
                product: products[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Update merchant product
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { 
                item_master_id, custom_name, price, stock_quantity, 
                status, description, is_active 
            } = req.body;

            // Verify ownership
            const [merchants] = await pool.query(
                'SELECT id FROM merchants WHERE user_id = ?',
                [userId]
            );

            if (merchants.length === 0) {
                return res.status(403).json({ error: 'Merchant profile not found' });
            }

            const merchantId = merchants[0].id;

            // Check if product belongs to merchant
            const [existing] = await pool.query(
                'SELECT id FROM merchant_products WHERE id = ? AND merchant_id = ?',
                [id, merchantId]
            );

            if (existing.length === 0) {
                return res.status(404).json({ 
                    error: 'Product not found or access denied' 
                });
            }

            if (!item_master_id || !price) {
                return res.status(400).json({ 
                    error: 'Item master ID and price are required' 
                });
            }

            // Handle file upload if exists
            const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : undefined;

            let query = `
                UPDATE merchant_products 
                SET item_master_id = ?, custom_name = ?, price = ?, stock_quantity = ?, 
                    status = ?, description = ?, is_active = ?
            `;
            const params = [
                item_master_id, 
                custom_name || null, 
                price, 
                stock_quantity || 0,
                status || 'available',
                description || null,
                is_active !== false
            ];

            if (imageUrl) {
                query += ', image_url = ?';
                params.push(imageUrl);
            }

            query += ' WHERE id = ?';
            params.push(id);

            await pool.query(query, params);

            const [products] = await pool.query(
                `SELECT mp.*, im.name as item_name, im.unit, c.name as category_name
                 FROM merchant_products mp
                 LEFT JOIN items_master im ON mp.item_master_id = im.id
                 LEFT JOIN categories c ON im.category_id = c.id
                 WHERE mp.id = ?`,
                [id]
            );

            // Invalidate product caches
            await invalidateCachePattern('products:*');
            await invalidateCachePattern(`product:${id}`);

            res.json({
                message: 'Product updated successfully',
                product: products[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Update product status only
    async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { status } = req.body;

            if (!status || !['available', 'out_of_stock', 'not_available'].includes(status)) {
                return res.status(400).json({ 
                    error: 'Valid status is required (available, out_of_stock, not_available)' 
                });
            }

            // Verify ownership
            const [merchants] = await pool.query(
                'SELECT id FROM merchants WHERE user_id = ?',
                [userId]
            );

            if (merchants.length === 0) {
                return res.status(403).json({ error: 'Merchant profile not found' });
            }

            const merchantId = merchants[0].id;

            const [result] = await pool.query(
                'UPDATE merchant_products SET status = ? WHERE id = ? AND merchant_id = ?',
                [status, id, merchantId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    error: 'Product not found or access denied' 
                });
            }

            // Invalidate product caches
            await invalidateCachePattern('products:*');
            await invalidateCachePattern(`product:${id}`);

            res.json({ message: 'Product status updated successfully' });
        } catch (error) {
            next(error);
        }
    }

    // Delete merchant product
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Verify ownership
            const [merchants] = await pool.query(
                'SELECT id FROM merchants WHERE user_id = ?',
                [userId]
            );

            if (merchants.length === 0) {
                return res.status(403).json({ error: 'Merchant profile not found' });
            }

            const merchantId = merchants[0].id;

            const [result] = await pool.query(
                'DELETE FROM merchant_products WHERE id = ? AND merchant_id = ?',
                [id, merchantId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    error: 'Product not found or access denied' 
                });
            }

            // Invalidate product caches
            await invalidateCachePattern('products:*');
            await invalidateCachePattern(`product:${id}`);

            res.json({ message: 'Product deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new MerchantProductController();
