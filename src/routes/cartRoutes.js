const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All cart routes require authentication
router.get('/', authenticateToken, authorizeRoles('user'), cartController.getCart);
router.post('/items', authenticateToken, authorizeRoles('user'), cartController.addItem);
router.put('/items/:id', authenticateToken, authorizeRoles('user'), cartController.updateItem);
router.delete('/items/:id', authenticateToken, authorizeRoles('user'), cartController.removeItem);
router.delete('/', authenticateToken, authorizeRoles('user'), cartController.clearCart);

module.exports = router;
