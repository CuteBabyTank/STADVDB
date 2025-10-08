CREATE DATABASE bank_dwh;
USE bank_dwh;

-- DATE DIMENSION
CREATE TABLE dim_date (
    date_key INT PRIMARY KEY,
    full_date DATE,
    year INT,
    quarter INT,
    month INT,
    day INT,
    day_of_week VARCHAR(15)
);

-- DISTRICT DIMENSION
CREATE TABLE dim_district (
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
);

-- CLIENT DIMENSION
CREATE TABLE dim_client (
    client_key INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT,
    district_key INT,
    FOREIGN KEY (district_key) REFERENCES dim_district(district_key)
);

-- ACCOUNT DIMENSION
CREATE TABLE dim_account (
    account_key INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    district_key INT,
    frequency VARCHAR(50),
    account_open_date DATE,
    FOREIGN KEY (district_key) REFERENCES dim_district(district_key)
);

-- LOAN DIMENSION
CREATE TABLE dim_loan (
    loan_key INT AUTO_INCREMENT PRIMARY KEY,
    loan_id INT,
    account_id INT,
    amount DOUBLE,
    duration INT,
    payments DOUBLE,
    status CHAR(1),
    start_date DATE
);

-- CARD DIMENSION
CREATE TABLE dim_card (
    card_key INT AUTO_INCREMENT PRIMARY KEY,
    card_id INT,
    type VARCHAR(50),
    issued_date DATE
);

-- FACT TABLE: FINANCIAL FACTS
CREATE TABLE fact_financials (
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
);
