USE bank_dwh;
# Roll up - Hierarchical Aggregation of transaction counts by year, quarter, month, and day
SELECT 
    d.year,
    d.quarter,
    d.month,
    d.full_date,
    COUNT(f.trans_id) AS transaction_count --Can be changed to SUM(f.amount) for total transaction amount
FROM fact_trans f
JOIN dim_date d ON f.trans_date_key = d.date_key
GROUP BY d.year, d.quarter, d.month, d.full_date WITH ROLLUP
ORDER BY d.year, d.quarter, d.month, d.full_date;

# Drill Down - Detailed Analysis of average account balance by region and district
SELECT 
    dist.region,
    dist.district_name,
    acc.account_id,
    AVG(f.balance) AS avg_balance --Can be changed to SUM for total balance instead of avg
FROM fact_trans f
JOIN dim_account acc ON f.account_key = acc.account_key
JOIN dim_district dist ON acc.district_key = dist.district_key
GROUP BY dist.region, dist.district_name, acc.account_id
ORDER BY dist.region, dist.district_name;

# Slice - Filtering a Single Dimension Value(Transaction reason)
SELECT 
    d.full_date,
    SUM(f.amount) AS total_amount_paid
FROM fact_trans f
JOIN dim_date d ON f.trans_date_key = d.date_key
WHERE f.k_symbol = 'HOUSEHOLD PAYMENT' --Change this to filter by a different transaction reason
GROUP BY d.full_date
ORDER BY d.full_date; 

# Dice - Multi-Dimensional Filtering by region, year, and transaction type
SELECT 
    dist.region,
    d.quarter,
    f.trans_type,
    SUM(f.amount) AS total_amount
FROM fact_trans f
JOIN dim_account acc ON f.account_key = acc.account_key
JOIN dim_district dist ON acc.district_key = dist.district_key
JOIN dim_date d ON f.trans_date_key = d.date_key
WHERE dist.region = 'Central Bohemia' --Change this to filter by a different region
  AND d.year = 1997 --Change this to filter by a different year
  AND f.trans_type = 'CREDIT' --Change this to filter by a different transaction type
GROUP BY dist.region, d.quarter, f.trans_type;

# Pivot - Cross-Tabulation - Monthly inflow and outflow by region
SELECT 
    dist.region,
    SUM(CASE WHEN f.trans_type = 'CREDIT' THEN f.amount ELSE 0 END) AS inflow,
    SUM(CASE WHEN f.trans_type = 'DEBIT' THEN f.amount ELSE 0 END) AS outflow,
    d.month
FROM fact_trans f
JOIN dim_account acc ON f.account_key = acc.account_key
JOIN dim_district dist ON acc.district_key = dist.district_key
JOIN dim_date d ON f.trans_date_key = d.date_key
GROUP BY dist.region, d.month
ORDER BY dist.region, d.month;