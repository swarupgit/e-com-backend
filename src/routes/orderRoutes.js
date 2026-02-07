const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Admin routes
router.get('/', authenticateToken, authorizeRoles('super_admin'), orderController.getAll);

// Merchant routes
router.get('/merchant/orders', authenticateToken, authorizeRoles('merchant'), orderController.getMerchantOrders);

// User routes
router.get('/my/orders', authenticateToken, authorizeRoles('user'), orderController.getUserOrders);
router.post('/', authenticateToken, orderController.create); // Can be used by users or guests

// Shared routes
router.get('/:id', authenticateToken, orderController.getById);
router.patch('/:id/status', authenticateToken, authorizeRoles('super_admin', 'merchant'), orderController.updateStatus);
router.put('/:id/status', authenticateToken, authorizeRoles('super_admin', 'merchant'), orderController.updateStatus);

module.exports = router;
