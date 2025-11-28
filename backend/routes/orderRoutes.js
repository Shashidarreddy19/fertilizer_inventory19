const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');

// Get order count
router.get('/count', OrderController.getOrderCount);

// Get all orders
router.get('/', OrderController.getAll);

// Create new order
router.post('/', OrderController.create);

// Update order
router.put('/:id', OrderController.update);

// Delete order
router.delete('/:id', OrderController.delete);

module.exports = router; 