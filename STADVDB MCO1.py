import pandas as pd
from sqlalchemy import create_engine

# ============== CONFIGURATION ==============
# Database connection info | edit accordingly
SOURCE_DB = {
    "host": "localhost",
    "user": "root",
    "password": "admin12345",
    "database": "financedata"
}

TARGET_DB = {
    "host": "localhost",
    "user": "root",
    "password": "admin12345",
    "database": "bank_dwh"
}

# Create connections 
# FORMAT: create_engine("mysql+mysqlconnector://[user]:[password]@[host]/[database]")
src = create_engine(f"mysql+mysqlconnector://{SOURCE_DB['user']}:{SOURCE_DB['password']}@{SOURCE_DB['host']}/{SOURCE_DB['database']}")
tgt = create_engine(f"mysql+mysqlconnector://{TARGET_DB['user']}:{TARGET_DB['password']}@{TARGET_DB['host']}/{TARGET_DB['database']}")

print("Source:", src.url)
print("Target:", tgt.url)
print("\nConnected to both source and target databases.\n")

# ============ HELPER FUNCTIONS ============

# Row count logger
def log_counts(df, table_name, tgt):
    rows_read = len(df)
    rows_written = pd.read_sql(f"SELECT COUNT(*) AS cnt FROM {table_name}", tgt).iloc[0]["cnt"]
    print(f"{table_name}: {rows_read} rows read, {rows_written} rows now in target.")

# Null handler
def replace_nulls(df):
    # convert whitespace to null
    df = df.replace(r'^\s*$', pd.NA, regex=True) 

    null_summary = df.isnull().sum()
    total_nulls = null_summary.sum()

    if total_nulls == 0:
        print("No null values found.")
        return df

    print(null_summary[null_summary > 0]) # Only prints columns with nulls
    print(f"Total Nulls: {total_nulls}")

    for col, n_nulls in null_summary[null_summary > 0].items(): # only goes thru columns with null values
        if pd.api.types.is_string_dtype(df[col]): # String > Unknown
            df[col] = df[col].fillna("Unknown")
        elif pd.api.types.is_numeric_dtype(df[col]): # Numeric > -1 
            df[col] = df[col].fillna(-1)
        elif pd.api.types.is_datetime64_any_dtype(df[col]): # Date > 9999-01-01
            df[col] = df[col].fillna(pd.Timestamp("9999-01-01"))
        else: # Used for VARCHAR since it returns an object rather than string
            df[col] = df[col].fillna("Unknown")
        print(f"{col}: replaced {n_nulls} null(s)")

    return df

# ================== ETL ====================
# Note: Based on previous SQL insert into's

# --- 1. DATE DIMENSION ---
print("Loading dim_date...")

# EXTRACT
query = "SELECT DISTINCT newdate FROM trans WHERE newdate IS NOT NULL;"
df_date = pd.read_sql(query, src)

# TRANSFORM
df_date.rename(columns={"newdate": "full_date"}, inplace=True) # rename column from newdate > full_date
df_date["full_date"] = pd.to_datetime(df_date["full_date"], errors="coerce") # convert to datetime format, errors="coerce" forces null on invalid values
df_date = df_date.sort_values("full_date").reset_index(drop=True) # Sort dates oldest > latest

# Separating date values
df_date["year"] = df_date["full_date"].dt.year
df_date["quarter"] = df_date["full_date"].dt.quarter
df_date["month"] = df_date["full_date"].dt.month
df_date["day"] = df_date["full_date"].dt.day
df_date["day_of_week"] = df_date["full_date"].dt.day_name()

df_date = replace_nulls(df_date) # replace nulls

# LOAD
with tgt.begin() as conn: # allows for automatic rollback when loading issues occur
    df_date.to_sql("dim_date", conn, if_exists="append", index=False)
log_counts(df_date, "dim_date", tgt)
print("dim_date loaded.\n")


# --- 2. DISTRICT DIMENSION ---
print("Loading dim_district...")

# EXTRACT
df_district = pd.read_sql("SELECT * FROM district;", src)

# TRANSORM
df_district["district_name"] = df_district["district_name"].str.strip().str.upper() # str.strip() = remove leading spaces | str.upper() + uppercase
df_district["region"] = df_district["region"].str.strip().str.title() # str.title() = titlecase
df_district = replace_nulls(df_district) # replace nulls

# LOAD
with tgt.begin() as conn: # allows for automatic rollback when loading issues occur
    df_district.to_sql("dim_district", conn, if_exists="append", index=False)
log_counts(df_district, "dim_district", tgt)
print("dim_district loaded.\n")


# --- 3. CLIENT DIMENSION ---
print("Loading dim_client...")

# EXTRACT
# Retrieve from financedata.client and bank_dwh.dim_district, inner join on district_id
df_client_src = pd.read_sql("SELECT client_id, district_id FROM client;", src)
df_district_tgt = pd.read_sql("SELECT district_id, district_key FROM dim_district;", tgt)
df_client = pd.merge(df_client_src, df_district_tgt, on="district_id", how="inner") 

# TRANSFORM
df_client = df_client[["client_id", "district_key"]] # reorder columns to match with dim_client
df_client = replace_nulls(df_client) # replace nulls

with tgt.begin() as conn: # allows for automatic rollback when loading issues occur
    df_client.to_sql("dim_client", conn, if_exists="append", index=False)
log_counts(df_client, "dim_client", tgt)
print("dim_client loaded.\n")


# --- 4. ACCOUNT DIMENSION ---
print("Loading dim_account...")

# EXTRACT
# Retrieve from financedata.account and bank_dwh.dim_district, inner join on district_id to get district_key
query = "SELECT account_id, district_id, frequency, newdate FROM account;"
df_account = pd.read_sql(query, src)
df_district_keys = pd.read_sql("SELECT district_id, district_key FROM dim_district;", tgt)
df_account = pd.merge(df_account, df_district_keys, on="district_id", how="inner")

# TRANSFORM
df_account.rename(columns={"newdate": "account_open_date"}, inplace=True) # rename column from newdate > account_open_date
df_account["frequency"] = df_account["frequency"].str.strip().str.upper() # str.strip() = remove leading spaces | str.upper() + uppercase
df_account = df_account[["account_id", "district_key", "frequency", "account_open_date"]] # reorder columns to match with dim_account
df_account = replace_nulls(df_account) # replace nulls

# LOAD
with tgt.begin() as conn: # allows for automatic rollback when loading issues occur
    df_account.to_sql("dim_account", conn, if_exists="append", index=False)
log_counts(df_account, "dim_account", tgt)
print("dim_account loaded.\n")


# --- 5. LOAN DIMENSION ---
print("Loading dim_loan...")

# EXTRACT
query = "SELECT loan_id, account_id, amount, duration, payments, status, newdate FROM loan;"
df_loan = pd.read_sql(query, src)

# TRANSFORM
df_loan.columns = ["loan_id", "account_id", "amount", "duration", "payments", "status", "start_date"] # rename columns to fit with dim_loan
df_loan["status"] = df_loan["status"].str.strip().str.upper() # str.strip() = remove leading spaces | str.upper() + uppercase
df_loan= replace_nulls(df_loan) # replace nulls

# LOAD
with tgt.begin() as conn: # allows for automatic rollback when loading issues occur
    df_loan.to_sql("dim_loan", conn, if_exists="append", index=False)
log_counts(df_loan, "dim_loan", tgt)
print("dim_loan loaded.\n")


# --- 6. CARD DIMENSION ---
print("Loading dim_card...")

# EXTRACT
df_card = pd.read_sql("SELECT card_id, type, newissued FROM card;", src)
df_card.columns = ["card_id", "type", "issued_date"]

# TRANSFORM 
df_card["type"] = df_card["type"].str.strip().str.upper() # str.strip() = remove leading spaces | str.upper() + uppercase
df_card = replace_nulls(df_card) # replace nulls

# LOAD
with tgt.begin() as conn: # allows for automatic rollback when loading issues occur
    df_card.to_sql("dim_card", conn, if_exists="append", index=False)
log_counts(df_card, "dim_card", tgt)
print("dim_card loaded.\n")


# --- 7. FACT: ORDERS ---
print("Loading fact_orders...")

# EXTRACT / TRANSFORM
# Extract from source
query = """
SELECT order_id, account_id, bank_to, account_to, amount, k_symbol
FROM orders;
"""
df_orders = pd.read_sql(query, src)

for col in ["bank_to", "k_symbol"]: # str.strip() = remove leading spaces | str.upper() + uppercase
    df_orders[col] = df_orders[col].str.strip().str.upper()

# Inner join on 'account_id' with bank_dwh.dim_account to get account_key
df_accounts = pd.read_sql("SELECT account_id, account_key FROM dim_account;", tgt)
df_orders = df_orders.merge(df_accounts, on="account_id", how="inner")

# Reorder columns to match fact_orders 
df_orders = df_orders[[
    "order_id", "account_key", "bank_to", "account_to", "amount", "k_symbol"
]]

# Change account_to to int,  errors="coerce" forces null on invalid values
df_orders["account_to"] = pd.to_numeric(df_orders["account_to"], errors="coerce")

df_orders= replace_nulls(df_orders) # replace nulls

# LOAD
# Load in chunks to avoid connection loss
chunksize = 10000 # Can be edited based on current device specs
with tgt.begin() as conn: # allows for automatic rollback when loading issues occur
    df_orders.to_sql(
        "fact_orders",
        conn,
        if_exists="append",
        index=False,
        chunksize=chunksize
    )

log_counts(df_orders, "fact_orders", tgt)
print("fact_orders loaded.\n")


# --- 8. FACT: TRANSACTIONS ---
print("Loading fact_trans...")

# EXTRACT / TRANSFORM
# Extract from source
query = """
SELECT trans_id, account_id, newdate, type, operation, amount, balance, k_symbol, bank, account
FROM trans;
"""
df_trans = pd.read_sql(query, src)

for col in ["type", "operation", "k_symbol", "bank"]: # str.strip() = remove leading spaces | str.upper() + uppercase
    df_trans[col] = df_trans[col].str.strip().str.upper()

df_date_tgt = pd.read_sql("SELECT date_key, full_date FROM dim_date;", tgt)

# Ensure dates are datetime.date
df_trans["newdate"] = pd.to_datetime(df_trans["newdate"]).dt.date
df_date_tgt["full_date"] = pd.to_datetime(df_date["full_date"]).dt.date

# Rename column from newdate > full_date to prepare for merge
df_trans.rename(columns={"newdate": "full_date"}, inplace=True)

#Inner join on date columns to get (trans_)date_key
df_trans = df_trans.merge(df_date_tgt, on="full_date", how="inner")

# Inner join on 'account_id' with bank_dwh.dim_account to get account_key
df_accounts = pd.read_sql("SELECT account_id, account_key FROM dim_account;", tgt)
df_trans = df_trans.merge(df_accounts, on="account_id", how="left")
df_trans = df_trans.drop(columns=["full_date"]) # drop date column

# Reorder and rename columns to match fact_trans 
df_trans = df_trans[[
    "trans_id", "account_key", "date_key", "type", "operation",
    "amount", "balance", "k_symbol", "bank", "account"
]]
df_trans.rename(columns={
    "type": "trans_type",
    "date_key": "trans_date_key",
    "account": "account_no"
}, inplace=True)

# Change account_no to int, errors="coerce" forces null on invalid values
df_trans["account_no"] = pd.to_numeric(df_trans["account_no"], errors="coerce")

df_trans = replace_nulls(df_trans) # replace nulls

# LOAD
# Load in chunks to avoid connection loss
chunksize = 10000 # Can be edited based on current device specs
with tgt.begin() as conn: # allows for automatic rollback when loading issues occur
    df_trans.to_sql(
        "fact_trans",
        conn,
        if_exists="append",
        index=False,
        chunksize=chunksize
    )

log_counts(df_trans, "fact_trans", tgt)
print("fact_trans loaded.\n")


print("ETL process completed successfully!")
