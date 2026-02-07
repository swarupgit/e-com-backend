const express = require('express');
const router = express.Router();
const merchantProductController = require('../controllers/merchantProductController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', merchantProductController.getAll);
router.get('/:id', merchantProductController.getById);

// Merchant routes
router.get('/my/products', authenticateToken, authorizeRoles('merchant'), merchantProductController.getOwnProducts);
router.post('/', authenticateToken, authorizeRoles('merchant'), upload.single('image'), merchantProductController.create);
router.put('/:id', authenticateToken, authorizeRoles('merchant'), upload.single('image'), merchantProductController.update);
router.patch('/:id/status', authenticateToken, authorizeRoles('merchant'), merchantProductController.updateStatus);
router.delete('/:id', authenticateToken, authorizeRoles('merchant'), merchantProductController.delete);

module.exports = router;
