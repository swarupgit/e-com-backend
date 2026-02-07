const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Admin routes
router.get('/', authenticateToken, authorizeRoles('super_admin'), subscriptionController.getAll);
router.get('/:id', authenticateToken, authorizeRoles('super_admin'), subscriptionController.getById);
router.post('/', authenticateToken, authorizeRoles('super_admin'), subscriptionController.create);
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), subscriptionController.update);
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), subscriptionController.delete);

// Merchant routes
router.get('/my/subscriptions', authenticateToken, authorizeRoles('merchant'), subscriptionController.getMerchantSubscriptions);

module.exports = router;
