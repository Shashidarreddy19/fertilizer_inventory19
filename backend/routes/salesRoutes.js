const express = require('express');
const router = express.Router();
const SalesController = require('../controllers/salesController');

// Middleware to check for userId
const checkUserId = (req, res, next) => {
    const userId =
        req.headers.userid ||
        req.body?.user_id ||
        req.query?.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    req.userId = userId;
    next();
};

// Apply userId check middleware to all routes
router.use(checkUserId);

// Get daily statistics
router.get('/daily-stats', SalesController.getDailyStats);

// Get available products for sales
router.get('/products', SalesController.getAvailableProducts);

// Get sales statistics
router.get('/stats', SalesController.getSalesStats);

// Export sales report
router.get('/export', SalesController.exportSalesReport);

// Archive sale
router.put('/:id/archive', SalesController.archiveSale);

// Unarchive sale
router.put('/:id/unarchive', SalesController.unarchiveSale);

// Get sale details
router.get('/:id', SalesController.getSaleDetails);

// Get all sales with optional date filtering
router.get('/', SalesController.getAll);

// Create new sale
router.post('/', SalesController.create);

// Update sale
router.put('/:id', SalesController.update);

// Delete sale
router.delete('/:id', SalesController.delete);

module.exports = router; 