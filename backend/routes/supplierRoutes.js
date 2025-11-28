const express = require('express');
const router = express.Router();
const SupplierController = require('../controllers/supplierController');

// Get supplier count
router.get('/count', SupplierController.getSupplierCount);

// Get all suppliers
router.get('/', SupplierController.getAll);

// Create new supplier
router.post('/', SupplierController.create);

// Update supplier
router.put('/:id', SupplierController.update);

// Delete supplier
router.delete('/:id', SupplierController.delete);

module.exports = router;
