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

// Route to get available years for filtering
app.get('/api/available-years', (req, res) => {
    const query = `
        SELECT DISTINCT year 
        FROM dim_date 
        WHERE year IS NOT NULL 
        ORDER BY year;
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const years = results.map(row => row.year);
        res.json(years);
    });
});

app.get('/api/available-trans-types', (req, res) => {
    const query = `
        SELECT DISTINCT trans_type 
        FROM fact_trans 
        WHERE trans_type IS NOT NULL 
        ORDER BY trans_type;
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const transTypes = results.map(row => row.trans_type);
        res.json(transTypes);
    });
});

// Routes for OLAP operations
app.post('/api/reports/rollup', (req, res) => {
    console.log('Roll-up report requested');
    const { fromYear, toYear } = req.body;
    
    let query = `
        SELECT
            d.year,
            d.quarter,
            d.month,
            SUM(t.amount) AS total_amount,
            COUNT(*) AS transaction_count
        FROM fact_trans t
        JOIN dim_date d ON t.trans_date_key = d.date_key
    `;
    
    const params = [];
    const conditions = [];
    
    if (fromYear) {
        conditions.push('d.year >= ?');
        params.push(fromYear);
    }
    if (toYear) {
        conditions.push('d.year <= ?');
        params.push(toYear);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY d.year, d.quarter, d.month WITH ROLLUP;';
    
    console.log('[🚀] Executing Roll-up query...', fromYear || toYear ? `from ${fromYear || 'start'} to ${toYear || 'end'}` : 'all years');
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('[❌] Roll-up query failed:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(`[✅] Roll-up query successful (${results.length} rows)`);
        res.json(results);
    });
});

app.post('/api/reports/drilldown', (req, res) => {
    console.log('[📊] Drill-down report requested');
    const { fromYear, toYear } = req.body;
    
    let query = `
        SELECT
            dist.region,
            dist.district_name,
            a.account_id,
            d.year,
            SUM(t.amount) as total_amount
        FROM fact_trans t
        JOIN dim_account a ON t.account_key = a.account_key
        JOIN dim_district dist ON a.district_key = dist.district_key
        JOIN dim_date d ON t.trans_date_key = d.date_key
    `;
    
    const params = [];
    const conditions = [];
    
    if (fromYear) {
        conditions.push('d.year >= ?');
        params.push(fromYear);
    }
    if (toYear) {
        conditions.push('d.year <= ?');
        params.push(toYear);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY dist.region, dist.district_name, a.account_id, d.year ORDER BY dist.region, dist.district_name, a.account_id, d.year;';
    
    console.log('[🚀] Executing Drill-down query...', fromYear || toYear ? `from ${fromYear || 'start'} to ${toYear || 'end'}` : 'for all years');
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('[❌] Drill-down query failed:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[✅] Drill-down query successful (${results.length} rows)`);
        res.json(results);
    });
});

app.post('/api/reports/slice', (req, res) => {
    console.log('[📊] Slice report requested');
    const { fromYear, toYear } = req.body;
    
    let query = `
        SELECT
            t.k_symbol,
            COUNT(*) as transaction_count,
            SUM(t.amount) as total_amount,
            AVG(t.amount) as average_amount
        FROM fact_trans t
    `;
    
    const params = [];
    const conditions = ['t.k_symbol IS NOT NULL', "t.k_symbol != ''"];
    
    if (fromYear || toYear) {
        query += ' JOIN dim_date d ON t.trans_date_key = d.date_key';
        if (fromYear) {
            conditions.push('d.year >= ?');
            params.push(fromYear);
        }
        if (toYear) {
            conditions.push('d.year <= ?');
            params.push(toYear);
        }
    }
    
    query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY t.k_symbol ORDER BY transaction_count DESC LIMIT 10;';
    
    console.log('[🚀] Executing Slice query...', fromYear || toYear ? `from ${fromYear || 'start'} to ${toYear || 'end'}` : 'all years');
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('[❌] Slice query failed:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[✅] Slice query successful (${results.length} rows)`);
        console.log('Available k_symbol values:', results.map(r => r.k_symbol));
        res.json(results);
    });
});

app.post('/api/reports/dice', (req, res) => {
    console.log('[📊] Dice report requested');
    const { fromYear, toYear, transType } = req.body;
    
    let query = `
        SELECT
            dist.region,
            d.year,
            t.trans_type,
            COUNT(*) as transaction_count,
            SUM(t.amount) as total_amount,
            AVG(t.amount) as average_amount
        FROM fact_trans t
        JOIN dim_account a ON t.account_key = a.account_key
        JOIN dim_district dist ON a.district_key = dist.district_key
        JOIN dim_date d ON t.trans_date_key = d.date_key
    `;
    
    const params = [];
    const conditions = ['t.trans_type IS NOT NULL'];
    
    if (fromYear) {
        conditions.push('d.year >= ?');
        params.push(fromYear);
    }
    if (toYear) {
        conditions.push('d.year <= ?');
        params.push(toYear);
    }
    if (transType) {
        conditions.push('t.trans_type = ?');
        params.push(transType);
    }
    
    query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY dist.region, d.year, t.trans_type ORDER BY dist.region, d.year, t.trans_type;';
    
    const filterDesc = [];
    if (fromYear || toYear) filterDesc.push(`from ${fromYear || 'start'} to ${toYear || 'end'}`);
    if (transType) filterDesc.push(`type: ${transType}`);
    console.log('[🚀] Executing Dice query...', filterDesc.length > 0 ? filterDesc.join(', ') : 'all data');
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('[❌] Dice query failed:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[✅] Dice query successful (${results.length} rows)`);
        res.json(results);
    });
});

app.post('/api/reports/pivot', (req, res) => {
    console.log('[📊] Pivot report requested');
    const { fromYear, toYear } = req.body;
    
    let query = `
        SELECT
            dist.region,
            d.year,
            d.month,
            SUM(CASE WHEN f.trans_type = 'CREDIT' THEN f.amount ELSE 0 END) AS inflow,
            SUM(CASE WHEN f.trans_type = 'DEBIT (WITHDRAWAL)' OR f.trans_type = 'VYBER' THEN f.amount ELSE 0 END) AS outflow
        FROM fact_trans f
        JOIN dim_account acc ON f.account_key = acc.account_key
        JOIN dim_district dist ON acc.district_key = dist.district_key
        JOIN dim_date d ON f.trans_date_key = d.date_key
    `;
    
    const params = [];
    const conditions = [];
    
    if (fromYear) {
        conditions.push('d.year >= ?');
        params.push(fromYear);
    }
    if (toYear) {
        conditions.push('d.year <= ?');
        params.push(toYear);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY dist.region, d.year, d.month ORDER BY dist.region, d.year, d.month;';
    
    console.log('[🚀] Executing Pivot query...', fromYear || toYear ? `from ${fromYear || 'start'} to ${toYear || 'end'}` : 'all years');
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('[❌] Pivot query failed:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[✅] Pivot query successful (${results.length} rows)`);
        res.json(results);
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
