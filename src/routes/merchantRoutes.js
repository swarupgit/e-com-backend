const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Admin routes
router.get('/', authenticateToken, authorizeRoles('super_admin'), merchantController.getAll);
router.get('/:id', authenticateToken, authorizeRoles('super_admin'), merchantController.getById);
router.post('/', authenticateToken, authorizeRoles('super_admin'), merchantController.create);
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), merchantController.update);
router.put('/:id/verify', authenticateToken, authorizeRoles('super_admin'), merchantController.verify);
router.put('/:id/subscription', authenticateToken, authorizeRoles('super_admin'), merchantController.updateSubscription);
router.put('/:id/status', authenticateToken, authorizeRoles('super_admin'), merchantController.updateStatus);
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), merchantController.delete);

// Merchant own profile
router.get('/my/profile', authenticateToken, authorizeRoles('merchant'), merchantController.getByUserId);
router.put('/my/profile', authenticateToken, authorizeRoles('merchant'), merchantController.updateOwnProfile);

module.exports = router;
