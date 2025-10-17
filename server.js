const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Replace with your MySQL username
    password: 'Newpassword123?', // Replace with your MySQL password
    database: 'bank_dwh', // Replace with your database name
    // Update settings to handle larger datasets
    supportBigNumbers: true,
    bigNumberStrings: true,
    typeCast: true,
    multipleStatements: true,
    // Add setting for larger results
    maxAllowedPacket: 16777216 // 16MB packet size
});

// Test database connection
db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Route to serve UI.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'UI.html'));
});

// Route to get table data with proper SQL queries
app.get('/api/table/:tableName', (req, res) => {
    const { tableName } = req.params;
    let query;

    // Define specific queries for each table
    switch(tableName) {
        case 'dim_date':
            query = 'SELECT date_key, DATE_FORMAT(full_date, "%Y-%m-%d") as full_date, year, quarter, month, day, day_of_week FROM dim_date';
            break;
        case 'dim_district':
            query = 'SELECT district_key, district_id, district_name, region, inhabitants, nocities, ratio_urbaninhabitants, average_salary, unemployment, noentrepreneur, nocrimes FROM dim_district';
            break;
        case 'dim_client':
            query = 'SELECT client_key, client_id, district_key FROM dim_client';
            break;
        case 'dim_account':
            query = 'SELECT account_key, account_id, district_key, frequency, DATE_FORMAT(account_open_date, "%Y-%m-%d") as account_open_date FROM dim_account';
            break;
        case 'dim_loan':
            query = 'SELECT loan_key, loan_id, account_id, amount, duration, payments, status, DATE_FORMAT(start_date, "%Y-%m-%d") as start_date FROM dim_loan';
            break;
        case 'dim_card':
            query = 'SELECT card_key, card_id, type, DATE_FORMAT(issued_date, "%Y-%m-%d") as issued_date FROM dim_card';
            break;
        case 'fact_orders':
            query = 'SELECT order_key, order_id, account_key, bank_to, account_to, amount, k_symbol FROM fact_orders';
            break;
        case 'fact_trans':
            query = 'SELECT trans_key, trans_id, account_key, trans_date_key, trans_type, operation, amount, balance, k_symbol, bank, account_no FROM fact_trans';
            break;
        default:
            return res.status(400).json({ error: 'Invalid table name' });
    }

    query += ' LIMIT 10000';

    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// Routes for OLAP operations
app.post('/api/reports/rollup', (req, res) => {
    const query = `
        SELECT
            d.year,
            d.quarter,
            d.month,
            SUM(t.amount) as total_amount,
            COUNT(*) as transaction_count
        FROM fact_trans t
        JOIN dim_date d ON t.trans_date_key = d.date_key
        GROUP BY d.year, d.quarter, d.month WITH ROLLUP;
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

app.post('/api/reports/drilldown', (req, res) => {
    const query = `
        SELECT 
            dist.region,
            dist.district_name,
            a.account_id,
            SUM(t.amount) as total_amount
        FROM fact_trans t
        JOIN dim_account a ON t.account_key = a.account_key
        JOIN dim_district dist ON a.district_key = dist.district_key
        GROUP BY dist.region, dist.district_name, a.account_id;
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

app.post('/api/reports/slice', (req, res) => {
    const query = `
        SELECT 
            t.k_symbol,
            COUNT(*) as transaction_count,
            SUM(t.amount) as total_amount,
            AVG(t.amount) as average_amount
        FROM fact_trans t
        WHERE t.k_symbol IN ('SIPO', 'LEASING')
        GROUP BY t.k_symbol;
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

app.post('/api/reports/dice', (req, res) => {
    const query = `
        SELECT 
            dist.region,
            d.year,
            t.k_symbol,
            COUNT(*) as transaction_count,
            SUM(t.amount) as total_amount
        FROM fact_trans t
        JOIN dim_account a ON t.account_key = a.account_key
        JOIN dim_district dist ON a.district_key = dist.district_key
        JOIN dim_date d ON t.trans_date_key = d.date_key
        WHERE dist.region IN ('north Bohemia', 'south Bohemia')
            AND d.year BETWEEN 1995 AND 1997
            AND t.k_symbol IN ('POJISTNE', 'UVER')
        GROUP BY dist.region, d.year, t.k_symbol;
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

app.post('/api/reports/pivot', (req, res) => {
    const query = `
        SELECT 
            dist.region,
            d.month,
            SUM(CASE WHEN t.trans_type = 'PRIJEM' THEN t.amount ELSE 0 END) as inflow,
            SUM(CASE WHEN t.trans_type = 'VYDAJ' THEN t.amount ELSE 0 END) as outflow,
            SUM(t.amount) as net_amount,
            COUNT(*) as transaction_count
        FROM fact_trans t
        JOIN dim_account a ON t.account_key = a.account_key
        JOIN dim_district dist ON a.district_key = dist.district_key
        JOIN dim_date d ON t.trans_date_key = d.date_key
        GROUP BY dist.region, d.month
        ORDER BY dist.region, d.month;
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
