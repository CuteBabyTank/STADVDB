import pandas as pd
from sqlalchemy import create_engine, text

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
src_engine = create_engine(f"mysql+mysqlconnector://{SOURCE_DB['user']}:{SOURCE_DB['password']}@{SOURCE_DB['host']}/{SOURCE_DB['database']}")
tgt_engine = create_engine(f"mysql+mysqlconnector://{TARGET_DB['user']}:{TARGET_DB['password']}@{TARGET_DB['host']}/{TARGET_DB['database']}")

print("Source:", src_engine.url)
print("Target:", tgt_engine.url)
print("\nConnected to both source and target databases.\n")

# Row logs
def log_counts(df, table_name, tgt_engine):
    rows_read = len(df)
    rows_written = pd.read_sql(f"SELECT COUNT(*) AS cnt FROM {table_name}", tgt_engine).iloc[0]["cnt"]
    print(f"{table_name}: {rows_read} rows read, {rows_written} rows now in target.")


# ================== ETL ====================

# --- 1. DATE DIMENSION ---
print("Loading dim_date...")
query = "SELECT DISTINCT newdate FROM trans WHERE newdate IS NOT NULL;"
df_date = pd.read_sql(query, src_engine)

# Transform
df_date.rename(columns={"newdate": "full_date"}, inplace=True) # replaces column name newdate > full_date
df_date["full_date"] = pd.to_datetime(df_date["full_date"], errors="coerce") # converts string to date format
df_date = df_date.sort_values("full_date").reset_index(drop=True) # sorts date + drop jumbled index

df_date["date_key"] = df_date.index + 1
df_date["year"] = df_date["full_date"].dt.year
df_date["quarter"] = df_date["full_date"].dt.quarter
df_date["month"] = df_date["full_date"].dt.month
df_date["day"] = df_date["full_date"].dt.day
df_date["day_of_week"] = df_date["full_date"].dt.day_name()

# Load
df_date.to_sql("dim_date", tgt_engine, if_exists="append", index=False)
log_counts(df_date, "dim_date", tgt_engine)
print("dim_date loaded.\n")


# --- 2. DISTRICT DIMENSION ---
print("Loading dim_district...")
df_district = pd.read_sql("SELECT * FROM district;", src_engine)
df_district.columns = df_district.columns.str.lower()

# Transform
df_district["district_name"] = df_district["district_name"].str.strip().str.upper() # removes leading space + capitalizes
df_district["region"] = df_district["region"].str.strip().str.title() # title case
df_district = df_district.fillna("Unknown")

# Load
df_district.to_sql("dim_district", tgt_engine, if_exists="append", index=False)
log_counts(df_district, "dim_district", tgt_engine)
print("dim_district loaded.\n")


# --- 3. CLIENT DIMENSION ---
print("Loading dim_client...")

# Extract from both db for join
df_client_src = pd.read_sql("SELECT client_id, district_id FROM client;", src_engine)
df_district_tgt = pd.read_sql("SELECT district_id, district_key FROM dim_district;", tgt_engine)

# Merge via python (simulate SQL JOIN across DBs)
df_client = pd.merge(df_client_src, df_district_tgt, on="district_id", how="inner")
df_client = df_client[["client_id", "district_key"]]

# Load
df_client.to_sql("dim_client", tgt_engine, if_exists="append", index=False)
log_counts(df_client, "dim_client", tgt_engine)
print("dim_client loaded.\n")


# --- 4. ACCOUNT DIMENSION ---
print("Loading dim_account...")

# Extract from both db for join
query = """
SELECT a.account_id, a.district_id, a.frequency, a.newdate
FROM account a;
"""
df_account = pd.read_sql(query, src_engine)
df_district_keys = pd.read_sql("SELECT district_id, district_key FROM dim_district;", tgt_engine)

# Merge via python (simulate SQL JOIN across DBs)
df_account = pd.merge(df_account, df_district_keys, on="district_id", how="inner")

# Transform
df_account.rename(columns={"newdate": "account_open_date"}, inplace=True) # replaces column name "newdate"
df_account["frequency"] = df_account["frequency"].str.strip().str.upper() # removes leading space + capitalizes
df_account = df_account[["account_id", "district_key", "frequency", "account_open_date"]]

# Load
df_account.to_sql("dim_account", tgt_engine, if_exists="append", index=False)
log_counts(df_account, "dim_account", tgt_engine)
print("dim_account loaded.\n")


# --- 5. LOAN DIMENSION ---
print("Loading dim_loan...")
query = """
SELECT loan_id, account_id, amount, duration, payments, status, newdate
FROM loan;
"""
df_loan = pd.read_sql(query, src_engine)
df_loan.columns = ["loan_id", "account_id", "amount", "duration", "payments", "status", "start_date"]

# Transform
df_loan["status"] = df_loan["status"].str.strip().str.upper()

# Load
df_loan.to_sql("dim_loan", tgt_engine, if_exists="append", index=False)
log_counts(df_loan, "dim_loan", tgt_engine)
print("dim_loan loaded.\n")


# --- 6. CARD DIMENSION ---
print("Loading dim_card...")
df_card = pd.read_sql("SELECT card_id, type, newissued FROM card;", src_engine)
df_card.columns = ["card_id", "type", "issued_date"]
df_card["type"] = df_card["type"].str.strip().str.upper() # removes leading space + capitalizes

df_card.to_sql("dim_card", tgt_engine, if_exists="append", index=False)
log_counts(df_card, "dim_card", tgt_engine)
print("dim_card loaded.\n")


# --- 7. FACT: ORDERS ---
print("Loading fact_orders...")

# Extract from both db for join
query = """
SELECT order_id, account_id, bank_to, account_to, amount, k_symbol
FROM orders;
"""
df_orders = pd.read_sql(query, src_engine)
df_accounts = pd.read_sql("SELECT account_id, account_key FROM dim_account;", tgt_engine)

# Transform |  # removes leading space + capitalizes
df_orders["k_symbol"] = df_orders["k_symbol"].str.strip().str.upper()
df_orders["bank_to"] = df_orders["bank_to"].str.strip().str.upper()
df_orders["k_symbol"] = df_orders["k_symbol"].str.strip().str.upper()

# Merge via python (simulate SQL JOIN across DBs) | reorder columns
df_fact_orders = df_orders.merge(df_accounts, on="account_id", how="inner")
df_fact_orders = df_fact_orders[["order_id","account_key","bank_to","account_to","amount","k_symbol"]] # reordering

# Load
df_fact_orders.to_sql("fact_orders", tgt_engine, if_exists="append", index=False)
log_counts(df_orders, "fact_orders", tgt_engine)
print("fact_orders loaded.\n")


# --- 8. FACT: TRANSACTIONS ---
print("Loading fact_trans...")
query = """
SELECT trans_id, account_id, newdate, type, operation, amount, balance, k_symbol, bank, account
FROM trans;
"""
df_trans = pd.read_sql(query, src_engine)

# Transform | removes leading space + capitalizes
df_trans["type"] = df_trans["type"].str.strip().str.upper()
df_trans["operation"] = df_trans["operation"].str.strip().str.upper()
df_trans["k_symbol"] = df_trans["k_symbol"].str.strip().str.upper()
df_trans["bank"] = df_trans["bank"].str.strip().str.upper()

# convert string to date format
df_trans["newdate"] = pd.to_datetime(df_trans["newdate"]).dt.date
df_date["full_date"] = pd.to_datetime(df_date["full_date"]).dt.date

# Join account_key and date_key
df_trans = df_trans.merge(
    df_date[["date_key", "full_date"]],
    left_on="newdate",
    right_on="full_date",
    how="left"
).drop(columns=["full_date"])

# Load
df_trans.to_sql("fact_trans", tgt_engine, if_exists="append", index=False)
log_counts(df_trans, "fact_trans", tgt_engine)
print("fact_trans loaded.\n")

# ================== DONE ====================
print("ETL process completed successfully!")