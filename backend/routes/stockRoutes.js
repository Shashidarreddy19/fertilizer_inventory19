const express = require('express');
const router = express.Router();
const path = require('path');
const StockController = require('../controllers/stockController');


// Get all stock items
router.get('/', StockController.getAll);

// Get low stock alerts
router.get('/low-stock-alerts', StockController.getLowStock);

// Get expiring soon items
router.get('/expiring-soon', StockController.getExpiringSoon);

// Get stock counts
router.get('/count', StockController.getStockCounts);

// Get a single stock item
router.get('/:id', StockController.getById);

// Create new stock item
router.post('/', StockController.create);

// Update stock item
router.put('/:id', StockController.update);

// Delete stock item
router.delete('/:id', (req, res) => StockController.delete(req, res));

module.exports = router;