const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Create the connection pool with enhanced settings
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'fertilizer_inventory',
    port: process.env.DB_PORT || 8081,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    multipleStatements: true,
    timezone: '+00:00',
    dateStrings: true
});

// Function to test database connection
async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Test if the customers table exists
        const [tables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = 'fertilizer_inventory' 
            AND TABLE_NAME = 'customers'
        `);
        
        if (tables.length === 0) {
            console.error('Customers table not found. Please ensure the database is properly initialized.');
            process.exit(1);
        }
        
        return true;
    } catch (err) {
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Please check your database username and password');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('Database server is not running');
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.error('Database "fertilizer_inventory" does not exist');
        }
        throw err;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// Execute a query with proper error handling
async function executeQuery(sql, params = []) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [results] = await connection.execute(sql, params);
        return Array.isArray(results) ? results : [results];
    } catch (error) {
        throw new Error('Database query failed: ' + error.message);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// Execute a transaction
async function executeTransaction(callback) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const result = await callback(connection);
        
        await connection.commit();
        return result;
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    testConnection,
    executeQuery,
    executeTransaction,
    pool
}; 