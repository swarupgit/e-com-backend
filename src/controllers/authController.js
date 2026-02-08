const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

class AuthController {
    // Register new user
    async register(req, res, next) {
        try {
            const { email, password, name, phone } = req.body;

            // Validate required fields
            if (!password || !name || !phone) {
                return res.status(400).json({ error: 'Password, name, and phone are required' });
            }

            // Validate phone number format (exactly 10 digits)
            const phoneRegex = /^[0-9]{10}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
            }

            // Check if user already exists (by email or phone)
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE phone = ? OR (email IS NOT NULL AND email = ?)',
                [phone, email || null]
            );

            if (existing.length > 0) {
                return res.status(400).json({ error: 'Email or phone already registered' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const [result] = await pool.query(
                'INSERT INTO users (email, password, name, phone, role) VALUES (?, ?, ?, ?, ?)',
                [email || null, hashedPassword, name, phone, 'user']
            );

            // Generate token
            const token = jwt.sign(
                { id: result.insertId, email, role: 'user' },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '7d' }
            );

            res.status(201).json({
                message: 'User registered successfully',
                token,
                user: {
                    id: result.insertId,
                    email,
                    name,
                    phone,
                    role: 'user'
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Login
    async login(req, res, next) {
        try {
            const { email, password } = req.body;

            if ((!email) || !password) {
                return res.status(400).json({ error: 'Email/phone and password are required' });
            }

            // Find user by email or phone
            const [users] = await pool.query(
                'SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_active = TRUE',
                [email, email]
            );

            if (users.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = users[0];

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Generate token
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '7d' }
            );

            res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    role: user.role
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Get current user profile
    async getProfile(req, res, next) {
        try {
            const [users] = await pool.query(
                'SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?',
                [req.user.id]
            );

            if (users.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ user: users[0] });
        } catch (error) {
            next(error);
        }
    }

    // Update profile
    async updateProfile(req, res, next) {
        try {
            const { name, phone } = req.body;
            const userId = req.user.id;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            await pool.query(
                'UPDATE users SET name = ?, phone = ? WHERE id = ?',
                [name, phone || null, userId]
            );

            const [users] = await pool.query(
                'SELECT id, email, name, phone, role FROM users WHERE id = ?',
                [userId]
            );

            res.json({
                message: 'Profile updated successfully',
                user: users[0]
            });
        } catch (error) {
            next(error);
        }
    }

    // Change password
    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ 
                    error: 'Current password and new password are required' 
                });
            }

            // Get user
            const [users] = await pool.query(
                'SELECT password FROM users WHERE id = ?',
                [userId]
            );

            if (users.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Verify current password
            const isValid = await bcrypt.compare(currentPassword, users[0].password);
            if (!isValid) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            await pool.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, userId]
            );

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
