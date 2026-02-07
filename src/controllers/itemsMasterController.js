const { pool } = require('../config/database');

class ItemsMasterController {
    // Get all items
    async getAll(req, res, next) {
        try {
            const { category_id, active_only } = req.query;
            
            let query = `
                SELECT im.*, c.name as category_name 
                FROM items_master im
                LEFT JOIN categories c ON im.category_id = c.id
            `;
            const params = [];
            const conditions = [];

            if (category_id) {
                conditions.push('im.category_id = ?');
                params.push(category_id);
            }

            if (active_only === 'true') {
                conditions.push('im.is_active = TRUE');
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY im.name ASC';

            const [items] = await pool.query(query, params);
            res.json({ items });
        } catch (error) {
            next(error);
        }
    }

    // Get item by ID
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            const [items] = await pool.query(
                `SELECT im.*, c.name as category_name 
                 FROM items_master im
                 LEFT JOIN categories c ON im.category_id = c.id
                 WHERE im.id = ?`,
                [id]
            );

            if (items.length === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }

            res.json({ item: items[0] });
        } catch (error) {
            next(error);
        }
    }

    // Create item
    async create(req, res, next) {
        try {
            const { category_id, name, description, base_price, unit, is_active } = req.body;

            if (!category_id || !name) {
                return res.status(400).json({ error: 'Category and name are required' });
            }

            const [result] = await pool.query(
                `INSERT INTO items_master (category_id, name, description, base_price, unit, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [category_id, name, description || null, base_price || null, unit || null, is_active !== false]
            );

            const [items] = await pool.query(
                `SELECT im.*, c.name as category_name 
                 FROM items_master im
                 LEFT JOIN categories c ON im.category_id = c.id
                 WHERE im.id = ?`,
                [result.insertId]
            );

            res.status(201).json({
                message: 'Item created successfully',
                item: items[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Update item
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { category_id, name, description, base_price, unit, is_active } = req.body;

            if (!category_id || !name) {
                return res.status(400).json({ error: 'Category and name are required' });
            }

            const [result] = await pool.query(
                `UPDATE items_master 
                 SET category_id = ?, name = ?, description = ?, base_price = ?, unit = ?, is_active = ?
                 WHERE id = ?`,
                [category_id, name, description || null, base_price || null, unit || null, is_active !== false, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }

            const [items] = await pool.query(
                `SELECT im.*, c.name as category_name 
                 FROM items_master im
                 LEFT JOIN categories c ON im.category_id = c.id
                 WHERE im.id = ?`,
                [id]
            );

            res.json({
                message: 'Item updated successfully',
                item: items[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete item
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            const [result] = await pool.query(
                'DELETE FROM items_master WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }

            res.json({ message: 'Item deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ItemsMasterController();
