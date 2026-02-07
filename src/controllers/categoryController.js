const { pool } = require('../config/database');
const { getCachedData, invalidateCachePattern } = require('../utils/cacheHelper');

class CategoryController {
    // Get all categories
    async getAll(req, res, next) {
        try {
            const { active_only } = req.query;
            
            // Create a cache key based on query params
            const cacheKey = active_only === 'true' ? 'categories:active' : 'categories:all';
            
            // Use cached data if available, otherwise fetch from DB
            const categories = await getCachedData(
                cacheKey,
                async () => {
                    let query = 'SELECT * FROM categories';
                    const params = [];

                    if (active_only === 'true') {
                        query += ' WHERE is_active = TRUE';
                    }

                    query += ' ORDER BY name ASC';

                    const [result] = await pool.query(query, params);
                    return result;
                },
                1800 // Cache for 30 minutes
            );
            
            res.json({ categories });
        } catch (error) {
            next(error);
        }
    }

    // Get category by ID
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            // Use cached data if available
            const category = await getCachedData(
                `category:${id}`,
                async () => {
                    const [categories] = await pool.query(
                        'SELECT * FROM categories WHERE id = ?',
                        [id]
                    );
                    return categories.length > 0 ? categories[0] : null;
                },
                3600 // Cache for 1 hour
            );

            if (!category) {
                return res.status(404).json({ error: 'Category not found' });
            }

            res.json({ category });
        } catch (error) {
            next(error);
        }
    }

    // Create category
    async create(req, res, next) {
        try {
            const { name, description, is_active } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const [result] = await pool.query(
                'INSERT INTO categories (name, description, is_active) VALUES (?, ?, ?)',
                [name, description || null, is_active !== false]
            );

            const [categories] = await pool.query(
                'SELECT * FROM categories WHERE id = ?',
                [result.insertId]
            );

            // Invalidate categories cache
            await invalidateCachePattern('categories:*');

            res.status(201).json({
                message: 'Category created successfully',
                category: categories[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Update category
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { name, description, is_active } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const [result] = await pool.query(
                'UPDATE categories SET name = ?, description = ?, is_active = ? WHERE id = ?',
                [name, description || null, is_active !== false, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Category not found' });
            }

            const [categories] = await pool.query(
                'SELECT * FROM categories WHERE id = ?',
                [id]
            );

            // Invalidate all category caches
            await invalidateCachePattern('categories:*');
            await invalidateCachePattern(`category:${id}`);

            res.json({
                message: 'Category updated successfully',
                category: categories[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete category
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            const [result] = await pool.query(
                'DELETE FROM categories WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Category not found' });
            }

            // Invalidate all category caches
            await invalidateCachePattern('categories:*');
            await invalidateCachePattern(`category:${id}`);

            res.json({ message: 'Category deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CategoryController();
