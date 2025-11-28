const express = require('express');
const router = express.Router();
const CreditController = require('../controllers/creditController');
const CreditModel = require('../models/creditModel');

// Calculate interest for a credit with date range
router.post('/:id/calculate', CreditController.calculateInterest);

// Get interest history for a credit with optional date range
router.get('/:id/history', CreditController.getInterestHistory);

// Delete an interest calculation
router.delete('/:id/calculation/:calculationId', CreditController.deleteInterestCalculation);

// Get interest breakdown for a credit with date range
router.get('/:id/breakdown', async (req, res) => {
    try {
        const { id: creditId } = req.params;
        const { userId, startDate, endDate } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Get credit details
        const credit = await CreditModel.getCreditById(creditId, userId);
        if (!credit) {
            return res.status(404).json({ error: 'Credit not found or unauthorized' });
        }

        // Calculate interest for the date range
        const result = await CreditModel.calculateInterestForDateRange(
            creditId,
            startDate || credit.credit_date,
            endDate || new Date().toISOString().split('T')[0],
            userId
        );

        res.json(result);
    } catch (error) {
        console.error('Error fetching interest breakdown:', error);
        res.status(500).json({ error: 'Failed to fetch interest breakdown' });
    }
});

module.exports = router; 