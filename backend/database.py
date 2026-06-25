from google.cloud import bigquery
import datetime
import subprocess

def get_bigquery_client():
    # Attempt to fetch credentials from local gcloud profile (excellent for local development)
    try:
        # Check if we can run gcloud.cmd or gcloud
        gcloud_cmd = "gcloud.cmd" if subprocess.run("where.exe gcloud.cmd", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0 else "gcloud"
        
        # Get access token
        token_process = subprocess.run(f"{gcloud_cmd} auth print-access-token", shell=True, capture_output=True, text=True)
        if token_process.returncode != 0:
            raise Exception("Failed to print gcloud access token: " + token_process.stderr.strip())
        token = token_process.stdout.strip()
        
        # Get project ID
        project_process = subprocess.run(f"{gcloud_cmd} config get-value project", shell=True, capture_output=True, text=True)
        if project_process.returncode != 0:
            raise Exception("Failed to get gcloud project: " + project_process.stderr.strip())
        project = project_process.stdout.strip()
        
        print(f"Loaded credentials from local gcloud config. Project: {project}")
        from google.oauth2 import credentials as oauth_credentials
        creds = oauth_credentials.Credentials(token)
        return bigquery.Client(credentials=creds, project=project)
    except Exception as e:
        print(f"Could not load local gcloud credentials ({e}). Falling back to Application Default Credentials...")
        return bigquery.Client()

class BigQuerySimulation:
    def __init__(self):
        self._client = None
        self._last_auth_time = None
        self.dataset_id = 'lloyds_financial_wellbeing'
        self.customers = []
        self.accounts = []
        self.products_live = []
        self.activity_log = []
        self.refresh_cache()

    @property
    def client(self):
        now = datetime.datetime.now()
        if self._client is None or self._last_auth_time is None or (now - self._last_auth_time).total_seconds() > 2700: # 45 minutes
            print("Client is None or token might be expired. Fetching fresh BigQuery client...")
            self._client = get_bigquery_client()
            self._last_auth_time = now
        return self._client

    def log_query(self, query):
        entry = {
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "agent": "BigQuery Engine",
            "message": f"Executing SQL: {query}",
            "type": "query"
        }
        self.activity_log.append(entry)
        print(f"[BigQuery] {query}")

    def refresh_cache(self):
        print("Refreshing local cache from real BigQuery...")
        try:
            # 1. Fetch Products (Static for now, or fetch from BQ if they exist)
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
        self.log_query(query)
        try:
            query_job = self.client.query(query)
            results = query_job.result()
        except Exception as e:
            print(f"Query failed: {e}. Re-authenticating...")
            self._client = None # Force property to fetch a fresh client
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
            print(f"BQ Insert Error (Accounts): {e}. Re-authenticating...")
            self._client = None # Force property to fetch a fresh client
            try:
                self.client.insert_rows_json(f"{self.dataset_id}.accounts", [new_acc])
            except Exception as retry_err:
                print(f"Retry BQ Insert Error (Accounts) failed: {retry_err}")
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
        except Exception as e:
            print(f"BQ Insert Error (Transactions): {e}. Re-authenticating...")
            self._client = None # Force property to fetch a fresh client
            try:
                self.client.insert_rows_json(f"{self.dataset_id}.transactions", [new_txn])
            except Exception as retry_err:
                print(f"Retry BQ Insert Error (Transactions) failed: {retry_err}")
        return new_txn
