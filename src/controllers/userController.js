const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

class UserController {
    // Get all users (Admin only)
    async getAll(req, res, next) {
        try {
            const { role } = req.query;
            
            let query = 'SELECT id, email, name, phone, role, is_active, created_at FROM users';
            const params = [];

            if (role) {
                query += ' WHERE role = ?';
                params.push(role);
            }

            query += ' ORDER BY created_at DESC';

            const [users] = await pool.query(query, params);
            res.json({ users });
        } catch (error) {
            next(error);
        }
    }

    // Get user by ID
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            const [users] = await pool.query(
                'SELECT id, email, name, phone, role, is_active, created_at FROM users WHERE id = ?',
                [id]
            );

            if (users.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ user: users[0] });
        } catch (error) {
            next(error);
        }
    }

    // Create user (Admin only)
    async create(req, res, next) {
        try {
            const { email, password, name, phone, role, is_active } = req.body;

            if (!email || !password || !name || !role) {
                return res.status(400).json({ 
                    error: 'Email, password, name, and role are required' 
                });
            }

            // Check if email exists
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existing.length > 0) {
                return res.status(400).json({ error: 'Email already registered' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            const [result] = await pool.query(
                'INSERT INTO users (email, password, name, phone, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                [email, hashedPassword, name, phone || null, role, is_active !== false]
            );

            const [users] = await pool.query(
                'SELECT id, email, name, phone, role, is_active, created_at FROM users WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json({
                message: 'User created successfully',
                user: users[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Update user (Admin only)
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { email, name, phone, role, is_active } = req.body;

            if (!email || !name || !role) {
                return res.status(400).json({ 
                    error: 'Email, name, and role are required' 
                });
            }

            // Check if email is taken by another user
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );

            if (existing.length > 0) {
                return res.status(400).json({ error: 'Email already in use' });
            }

            const [result] = await pool.query(
                'UPDATE users SET email = ?, name = ?, phone = ?, role = ?, is_active = ? WHERE id = ?',
                [email, name, phone || null, role, is_active !== false, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const [users] = await pool.query(
                'SELECT id, email, name, phone, role, is_active, created_at FROM users WHERE id = ?',
                [id]
            );

            res.json({
                message: 'User updated successfully',
                user: users[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete user (Admin only)
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            const [result] = await pool.query(
                'DELETE FROM users WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            next(error);
        }
    }

    // Get all customers (users with role 'user')
    async getCustomers(req, res, next) {
        try {
            const [users] = await pool.query(
                `SELECT id, email, name, phone, is_active, created_at,
                        (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as total_orders
                 FROM users 
                 WHERE role = 'user'
                 ORDER BY created_at DESC`
            );

            res.json({ customers: users });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();
