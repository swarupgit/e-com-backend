const express = require('express');
const router = express.Router();
const itemsMasterController = require('../controllers/itemsMasterController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Public routes
router.get('/', itemsMasterController.getAll);
router.get('/:id', itemsMasterController.getById);

// Merchant and Admin routes
router.post('/', authenticateToken, authorizeRoles('super_admin', 'merchant'), itemsMasterController.create);

// Admin only routes
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), itemsMasterController.update);
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), itemsMasterController.delete);

module.exports = router;
