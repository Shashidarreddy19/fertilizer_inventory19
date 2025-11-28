const cron = require('node-cron');
const db = require('../config/db');
const CreditModel = require('../models/creditModel');

// Initialize tables when the cron starts
(async () => {
    try {
        await CreditModel.initializeTables();
        console.log('Tables initialized successfully');
    } catch (error) {
        console.error('Error initializing tables:', error);
    }
})();

// This cron runs daily to check for credits needing interest calculation
cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Starting daily interest check...');
    try {
        // Get all active credits that have outstanding balance
        const credits = await db.executeQuery(`
            SELECT cs.credit_id, cs.user_id, cs.remaining_amount, cs.interest_rate,
                   DATEDIFF(CURRENT_DATE, COALESCE(cs.last_interest_calculation, cs.created_at)) as days_since_last_calc
            FROM credit_sales cs
            WHERE cs.status != 'Paid' 
            AND cs.status != 'Archived'
            AND cs.remaining_amount > 0
            AND (cs.last_interest_calculation IS NULL 
                 OR DATEDIFF(CURRENT_DATE, cs.last_interest_calculation) >= 30)
        `);

        console.log(`[Cron] Found ${credits.length} credits needing interest calculation`);

        const results = [];
        for (const credit of credits) {
            try {
                // Calculate interest for the number of days since last calculation
                const result = await CreditModel.calculateInterest(
                    credit.credit_id,
                    credit.days_since_last_calc,
                    credit.user_id
                );
                
                results.push({
                    credit_id: credit.credit_id,
                    success: true,
                    ...result
                });
            } catch (err) {
                console.error(`[Cron] Error processing interest for credit ${credit.credit_id}:`, err);
                results.push({
                    credit_id: credit.credit_id,
                    success: false,
                    error: err.message
                });
            }
        }

        // Log results
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`[Cron] Interest calculation completed:`);
        console.log(`- Successfully processed: ${successful}`);
        console.log(`- Failed: ${failed}`);

        // Log detailed errors if any
        if (failed > 0) {
            console.log('\nFailed calculations:');
            results
                .filter(r => !r.success)
                .forEach(r => console.log(`Credit ID ${r.credit_id}: ${r.error}`));
        }

        // Log successful calculations
        if (successful > 0) {
            console.log('\nSuccessful calculations:');
            results
                .filter(r => r.success)
                .forEach(r => {
                    console.log(
                        `Credit ID ${r.credit_id}: ` +
                        `Days: ${r.days}, ` +
                        `Interest: ${r.interest_amount}, ` +
                        `New Balance: ${r.remaining_balance}`
                    );
                });
        }
    } catch (error) {
        console.error('[Cron] Error in daily interest check:', error);
        
        // Log to a separate error log or send notification
        console.error('[Cron] Critical error in interest calculation:', {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = cron;