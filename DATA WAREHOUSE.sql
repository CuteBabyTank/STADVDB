CREATE DATABASE IF NOT EXISTS `bank_dwh`;
USE `bank_dwh`;

-- DATE DIMENSION
DROP TABLE IF EXISTS `dim_date`;
CREATE TABLE `dim_date` (
    date_key INT PRIMARY KEY,
    full_date DATE,
    year INT,
    quarter INT,
    month INT,
    day INT,
    day_of_week VARCHAR(15)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- populating

INSERT INTO bank_dwh.dim_date (date_key, full_date, year, quarter, month, day, day_of_week)
SELECT
    ROW_NUMBER() OVER (ORDER BY newdate) AS date_key,
    newdate AS full_date,
    YEAR(newdate),
    QUARTER(newdate),
    MONTH(newdate),
    DAY(newdate),
    DAYNAME(newdate)
FROM (
    SELECT DISTINCT newdate
    FROM financedata.trans
    WHERE newdate IS NOT NULL
) AS unique_dates;

-- testing
SELECT *
FROM dim_date;

-- DISTRICT DIMENSION
DROP TABLE IF EXISTS `dim_district`;
CREATE TABLE `dim_district` (
    district_key INT AUTO_INCREMENT PRIMARY KEY,
    district_id INT,
    district_name VARCHAR(100),
    region VARCHAR(100),
    inhabitants INT,
    nocities INT,
    ratio_urbaninhabitants DOUBLE,
    average_salary INT,
    unemployment DOUBLE,
    noentrepreneur INT,
    nocrimes INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- populate
INSERT INTO bank_dwh.dim_district (
    district_id,
    district_name,
    region,
    inhabitants,
    nocities,
    ratio_urbaninhabitants,
    average_salary,
    unemployment,
    noentrepreneur,
    nocrimes
)
SELECT
    district_id,
    district_name,
    region,
    inhabitants,
    nocities,
    ratio_urbaninhabitants,
    average_salary,
    unemployment,
    noentrepreneur,
    nocrimes
FROM financedata.district;

-- test
select *
From dim_district;

-- CLIENT DIMENSION
DROP TABLE IF EXISTS `dim_client`;
CREATE TABLE `dim_client` (
    client_key INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT,
    district_key INT,
    FOREIGN KEY (district_key) REFERENCES dim_district(district_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- populate
INSERT INTO bank_dwh.dim_client (client_id, district_key)
SELECT
    c.client_id,
    d.district_key
FROM financedata.client c
JOIN bank_dwh.dim_district d
  ON c.district_id = d.district_id;

-- test
select*
FROM dim_client;


-- ACCOUNT DIMENSION
DROP TABLE IF EXISTS `dim_account`;
CREATE TABLE `dim_account` (
    account_key INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    district_key INT,
    frequency VARCHAR(50),
    account_open_date DATE,
    FOREIGN KEY (district_key) REFERENCES dim_district(district_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- populate
INSERT INTO bank_dwh.dim_account (account_id, district_key, frequency, account_open_date)
SELECT
    a.account_id,
    d.district_key,
    a.frequency,
    a.newdate
FROM financedata.account a
JOIN bank_dwh.dim_district d
  ON a.district_id = d.district_id;

-- test
select *
FROM dim_account;

-- LOAN DIMENSION
DROP TABLE IF EXISTS `dim_loan`;
CREATE TABLE `dim_loan` (
    loan_key INT AUTO_INCREMENT PRIMARY KEY,
    loan_id INT,
    account_id INT,
    amount DOUBLE,
    duration INT,
    payments DOUBLE,
    status CHAR(1),
    start_date DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- populate
INSERT INTO bank_dwh.dim_loan (loan_id, account_id, amount, duration, payments, status, start_date)
SELECT
    loan_id,
    account_id,
    amount,
    duration,
    payments,
    status,
    newdate
FROM financedata.loan;

-- test
Select *
From dim_loan;


-- CARD DIMENSION
DROP TABLE IF EXISTS `dim_card`;
CREATE TABLE `dim_card` (
    card_key INT AUTO_INCREMENT PRIMARY KEY,
    card_id INT,
    type VARCHAR(50),
    issued_date DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- populate
INSERT INTO bank_dwh.dim_card (card_id, type, issued_date)
SELECT
    card_id,
    type,
    newissued
FROM financedata.card;

-- test
Select *
From dim_card;

-- FACT TABLE
DROP TABLE IF EXISTS `fact_financials`;
CREATE TABLE `fact_financials` (
    fact_id INT AUTO_INCREMENT PRIMARY KEY,
    trans_id INT,
    account_key INT,
    client_key INT,
    district_key INT,
    loan_key INT,
    card_key INT,
    date_key INT,
    transaction_type VARCHAR(50),
    operation VARCHAR(100),
    k_symbol VARCHAR(100),
    amount DOUBLE,
    balance DOUBLE,
    bank_to VARCHAR(50),
    account_to VARCHAR(50),
    FOREIGN KEY (account_key) REFERENCES dim_account(account_key),
    FOREIGN KEY (client_key) REFERENCES dim_client(client_key),
    FOREIGN KEY (district_key) REFERENCES dim_district(district_key),
    FOREIGN KEY (loan_key) REFERENCES dim_loan(loan_key),
    FOREIGN KEY (card_key) REFERENCES dim_card(card_key),
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- populate
INSERT INTO bank_dwh.fact_financials (
    trans_id,
    account_key,
    client_key,
    district_key,
    loan_key,
    card_key,
    date_key,
    transaction_type,
    operation,
    k_symbol,
    amount,
    balance,
    bank_to,
    account_to
)
SELECT
    t.trans_id,
    da.account_key,
    dc.client_key,
    dd.district_key,
    dl.loan_key,
    dcard.card_key,
    ddate.date_key,
    t.type,
    t.operation,
    t.k_symbol,
    t.amount,
    t.balance,
    t.bank,
    t.account
FROM financedata.trans t
JOIN bank_dwh.dim_account da
  ON t.account_id = da.account_id
LEFT JOIN financedata.disp disp
  ON t.account_id = disp.account_id
LEFT JOIN bank_dwh.dim_client dc
  ON disp.client_id = dc.client_id
LEFT JOIN bank_dwh.dim_district dd
  ON da.district_key = dd.district_key
LEFT JOIN bank_dwh.dim_loan dl
  ON dl.account_id = da.account_id
LEFT JOIN bank_dwh.dim_card dcard
  ON dcard.card_id = disp.disp_id
LEFT JOIN bank_dwh.dim_date ddate
  ON ddate.full_date = t.newdate;
-- broken runtime error cause query is too big, optimize this more

-- test
Select *
From fact_financials;
