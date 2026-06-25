from google.cloud import bigquery
import datetime

class BigQuerySimulation:
    def __init__(self):
        self.client = bigquery.Client()
        self.dataset_id = 'lloyds_financial_wellbeing'
        self.customers = []
        self.accounts = []
        self.products_live = []
        self.refresh_cache()

    def refresh_cache(self):
        print("Refreshing local cache from real BigQuery...")
        try:
            # 1. Fetch Products (Static for now, or fetch from BQ if they exist)
            # Actually products were in products table in BQ? Let's check.
            self.products_live = self.query_to_dict(f"SELECT * FROM {self.dataset_id}.products")
            if not self.products_live:
                # Fallback to some defaults if table is empty
                self.products_live = [
                    { "product_id": "PROD_001", "name": "Flexible Saver", "category": "Savings", "interest_rate_aer": "1.40%", "min_deposit": 1, "monthly_min": 0, "term_months": 0, "eligibility_tier": "NORMAL", "fees": "No fees", "product_url": "https://www.lloydsbank.com/savings/flexible-saver.html" },
                    { "product_id": "PROD_003", "name": "Club Lloyds Monthly Saver", "category": "Savings", "interest_rate_aer": "6.25%", "min_deposit": 25, "monthly_min": 25, "term_months": 12, "eligibility_tier": "NORMAL", "fees": "Club Lloyds account required", "product_url": "https://www.lloydsbank.com/savings/club-lloyds-monthly-saver.html" }
                ]

            # 2. Fetch Customers
            self.customers = self.query_to_dict(f"SELECT * FROM {self.dataset_id}.customers")
            
            # 3. Fetch Accounts
            self.accounts = self.query_to_dict(f"SELECT * FROM {self.dataset_id}.accounts")
            
            print(f"Cache refreshed: {len(self.customers)} customers, {len(self.accounts)} accounts.")
        except Exception as e:
            print(f"Error refreshing cache from BigQuery: {e}")

    def query_to_dict(self, query):
        query_job = self.client.query(query)
        results = query_job.result()
        return [dict(row) for row in results]

    def get_transactions_for_customer(self, customer_id):
        # Fetch transactions on demand as they are large
        query = f"SELECT * FROM {self.dataset_id}.transactions WHERE customer_id = '{customer_id}'"
        return self.query_to_dict(query)

    def create_account(self, customer_id, account_type, balance, product_id):
        # In a real app, we'd insert into BQ. For the demo, we update local cache and mock BQ insert.
        acc_id = f"ACC_NEW_{datetime.datetime.now().strftime('%H%M%S')}"
        new_acc = { 
            "account_id": acc_id, 
            "customer_id": customer_id, 
            "account_type": account_type, 
            "balance": balance, 
            "opened_date": datetime.date.today().isoformat(), 
            "credit_limit": 0, 
            "product_id": product_id 
        }
        self.accounts.append(new_acc)
        # Attempt real BQ insert
        try:
            self.client.insert_rows_json(f"{self.dataset_id}.accounts", [new_acc])
        except Exception as e:
            print(f"BQ Insert Error (Accounts): {e}")
        return new_acc

    def insert_transaction(self, account_id, customer_id, amount, category, merchant, txn_type, is_direct_debit=False):
        txn_id = f"TXN_NEW_{datetime.datetime.now().strftime('%H%M%S')}"
        new_txn = { 
            "txn_id": txn_id, 
            "account_id": account_id, 
            "customer_id": customer_id, 
            "date": datetime.date.today().isoformat(), 
            "amount": amount, 
            "category": category, 
            "merchant": merchant, 
            "type": txn_type, 
            "is_direct_debit": is_direct_debit 
        }
        # Update local account balance
        acc = next((a for a in self.accounts if a["account_id"] == account_id), None)
        if acc: acc["balance"] += amount
        
        # Attempt real BQ insert
        try:
            self.client.insert_rows_json(f"{self.dataset_id}.transactions", [new_txn])
            if acc:
                # Update balance in BQ? Usually balances are derived, but here we have a balance field.
                # For simplicity in this demo, we'll just assume transactions are enough.
                pass
        except Exception as e:
            print(f"BQ Insert Error (Transactions): {e}")
        return new_txn
