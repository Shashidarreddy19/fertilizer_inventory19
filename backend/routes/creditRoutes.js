const express = require('express');
const router = express.Router();
const CreditController = require('../controllers/creditController');

// Create a new credit
router.post('/', CreditController.createCredit);

// Get all credits
router.get('/', CreditController.getAllCredits);

// Get credit by ID
router.get('/:id', CreditController.getCreditById);

// Update credit - ensure this matches frontend URL pattern
router.put('/:id', CreditController.updateCredit);

// Delete credit
router.delete('/:id', CreditController.deleteCredit);

// Interest related routes
router.get('/:id/interest-history', CreditController.getInterestHistory);
router.post('/:id/interest', CreditController.calculateInterest);
router.delete('/:id/interest/:calculationId', CreditController.deleteInterestCalculation);

// Payment related routes
router.get('/:id/payments', CreditController.getPayments);
router.post('/:id/payment', CreditController.makePayment);

// Customer credit score
router.get('/score/:customer_id', CreditController.getCustomerScore);

// Get credits by customer
router.get('/customer/:customerId', CreditController.getCredits);

module.exports = router;