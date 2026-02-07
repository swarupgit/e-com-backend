const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Admin only routes
router.get('/', authenticateToken, authorizeRoles('super_admin'), userController.getAll);
router.get('/customers', authenticateToken, authorizeRoles('super_admin'), userController.getCustomers);
router.get('/:id', authenticateToken, authorizeRoles('super_admin'), userController.getById);
router.post('/', authenticateToken, authorizeRoles('super_admin'), userController.create);
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), userController.update);
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), userController.delete);

module.exports = router;
