const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Public route
router.get('/', categoryController.getAll);
router.get('/:id', categoryController.getById);

// Admin only routes
router.post('/', authenticateToken, authorizeRoles('super_admin'), categoryController.create);
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), categoryController.update);
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), categoryController.delete);

module.exports = router;
