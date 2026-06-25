from google.cloud import bigquery
import datetime
import random

client = bigquery.Client()
dataset_id = 'lloyds_financial_wellbeing'
customer_id = 'CUST_0422'
account_id = 'ACC_0422_1' # Current Account

# Generate 3 salaries
salaries = []
for i in range(3):
    salaries.append({
        "txn_id": f"TXN_{customer_id}_SAL_{i}_{datetime.datetime.now().strftime('%H%M%S')}",
        "customer_id": customer_id,
        "account_id": account_id,
        "date": (datetime.date.today() - datetime.timedelta(days=i*30)).isoformat(),
        "amount": 3500.0,
        "category": "Salary",
        "merchant": "LLOYDS TECH",
        "type": "CREDIT",
        "is_direct_debit": False
    })

# Generate some spending
spending = []
merchants = [("TESCO", "Groceries"), ("SHELL", "Transport"), ("NETFLIX", "Entertainment"), ("AMAZON", "Shopping")]
for i in range(20):
    m, cat = random.choice(merchants)
    spending.append({
        "txn_id": f"TXN_{customer_id}_SPEND_{i}_{datetime.datetime.now().strftime('%H%M%S')}",
        "customer_id": customer_id,
        "account_id": account_id,
        "date": (datetime.date.today() - datetime.timedelta(days=random.randint(1, 90))).isoformat(),
        "amount": -random.uniform(10, 100),
        "category": cat,
        "merchant": m,
        "type": "DEBIT",
        "is_direct_debit": False
    })

# Insert into BigQuery
errors = client.insert_rows_json(f"{dataset_id}.transactions", salaries + spending)
if not errors:
    print("Data inserted for CUST_0422")
else:
    print(f"Errors: {errors}")
