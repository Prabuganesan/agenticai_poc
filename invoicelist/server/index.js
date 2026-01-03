const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/dist')));

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'prabu',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'agent',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
    } else {
        console.log('✅ Database connected successfully');
    }
});

// API Routes

// GET /api/invoices - List all invoices with mail metadata
app.get('/api/invoices', async (req, res) => {
    try {
        const query = `
      SELECT 
        ih.id,
        ih.invoice_number,
        ih.vendor_name,
        ih.invoice_date,
        ih.total_amount,
        ih.currency,
        mh.subject,
        mh.sender,
        mh.received_date,
        mh.gmail_message_id
      FROM invoice_header ih
      JOIN inv_meta_line ml ON ih.attachment_filename = ml.attachment_filename
      JOIN inv_meta_header mh ON ml.meta_header_id = mh.id
      ORDER BY ih.created_at DESC
    `;

        const result = await pool.query(query);
        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/invoices/:id - Get invoice details with line items
app.get('/api/invoices/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get invoice header
        const headerQuery = `
      SELECT 
        ih.*,
        mh.subject,
        mh.sender,
        mh.received_date,
        mh.gmail_message_id,
        mh.attachment_count
      FROM invoice_header ih
      JOIN inv_meta_line ml ON ih.attachment_filename = ml.attachment_filename
      JOIN inv_meta_header mh ON ml.meta_header_id = mh.id
      WHERE ih.id = $1
    `;

        const headerResult = await pool.query(headerQuery, [id]);

        if (headerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Get line items
        const linesQuery = `
      SELECT *
      FROM invoice_lines
      WHERE invoice_id = $1
      ORDER BY line_number
    `;

        const linesResult = await pool.query(linesQuery, [id]);

        res.json({
            success: true,
            data: {
                header: headerResult.rows[0],
                line_items: linesResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching invoice details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve React app for all other routes (must be last)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📱 Frontend available at http://localhost:${port}`);
});
