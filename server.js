const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fileUpload = require('express-fileupload');
const fs = require('fs');

// Import routes
const userRoutes = require('./backend/routes/userRoutes');
const stockRoutes = require('./backend/routes/stockRoutes');
const supplierRoutes = require('./backend/routes/supplierRoutes');
const orderRoutes = require('./backend/routes/orderRoutes');
const customerRoutes = require('./backend/routes/customerRoutes');
const salesRoutes = require('./backend/routes/salesRoutes');
const creditRoutes = require('./backend/routes/creditRoutes');

// Import database connection
const db = require('./backend/config/db');

const app = express();
const port = 3036;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Updated CORS configuration
app.use(cors({
    origin: [`http://localhost:${port}`, `http://127.0.0.1:${port}`],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'userId'],
    credentials: true
}));

// File upload middleware with error handling
// Note: Static file serving for /uploads and /images is handled by the general static middleware below

app.use(fileUpload({
    createParentPath: true,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    },
    abortOnLimit: true,
    responseOnLimit: 'File size limit has been reached'
}));

// Database connection error handling middleware
app.use((req, res, next) => {
    if (db.pool && !db.pool._closed) {
        next();
    } else {
        res.status(500).json({ error: 'Database connection is not available' });
    }
});

// Create necessary directories
const dirs = [
    path.join(__dirname, 'backend/public'),
    path.join(__dirname, 'backend/public/images'),
    path.join(__dirname, 'backend/public/uploads'),
    path.join(__dirname, 'backend/public/uploads/products')
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Create default product image if it doesn't exist
const defaultImagePath = path.join(__dirname, 'backend/public/images/default-product.png');
if (!fs.existsSync(defaultImagePath)) {
    const defaultImageContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(defaultImagePath, defaultImageContent);
}

// Serve static files from backend public directory (must come before API routes)
// This serves /uploads, /images, and other static files from backend/public
app.use(express.static(path.join(__dirname, 'backend/public')));

// API Routes with error handling
app.use('/api/users', userRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/credit', creditRoutes);

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve the dashboard page on the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dashboard.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Handle database-specific errors
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        return res.status(500).json({ error: 'Database connection was lost' });
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
        return res.status(500).json({ error: 'Database has too many connections' });
    }
    if (err.code === 'ECONNREFUSED') {
        return res.status(500).json({ error: 'Database connection was refused' });
    }
    
    res.status(500).json({
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server only after database connection is established
async function startServer() {
    try {
        // Wait for database connection
        await db.testConnection();
        console.log('Database connection test successful');

        const allowedOrigins = [
            `http://localhost:${port}`, `http://127.0.0.1:${port}`
        ];
        
        const server = app.listen(port, () => {
            console.log(`Server running at ${port}`);
        });
        
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use`);
            } else {
                console.error('Server error:', error);
            }
            process.exit(1);
        });

        // Graceful shutdown handling
        process.on('SIGTERM', async () => {
            console.log('Received SIGTERM. Performing graceful shutdown...');
            await db.pool.end();
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('Failed to start server:', error.message);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Please check your database username and password');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('Database server is not running. Please start MySQL server');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('Database "fertilizer_inventory" does not exist. Please create the database');
        }
        process.exit(1);
    }
}

// Initialize server
startServer();