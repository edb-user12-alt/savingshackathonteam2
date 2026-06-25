import datetime
import random
import math

class BigQuerySimulation:
    def __init__(self):
        self.customers = []
        self.accounts = []
        self.transactions = []
        self.products_live = []
        self.banners = []
        self.init_database()

    def init_database(self):
        print("Initializing Synthetic BigQuery Database (1000 customers)...")

        # 1. Initialize Live Products
        self.products_live = [
            { "product_id": "PROD_001", "name": "Flexible Saver", "category": "Savings", "interest_rate_aer": "1.40%", "min_deposit": 1, "monthly_min": 0, "term_months": 0, "eligibility_tier": "NORMAL", "fees": "No fees", "product_url": "https://www.lloydsbank.com/savings/flexible-saver.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_002", "name": "Standard Saver", "category": "Savings", "interest_rate_aer": "1.30%", "min_deposit": 1, "monthly_min": 0, "term_months": 0, "eligibility_tier": "NORMAL", "fees": "No fees", "product_url": "https://www.lloydsbank.com/savings/standard-saver.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_003", "name": "Club Lloyds Monthly Saver", "category": "Savings", "interest_rate_aer": "6.25%", "min_deposit": 25, "monthly_min": 25, "term_months": 12, "eligibility_tier": "NORMAL", "fees": "Club Lloyds account required", "product_url": "https://www.lloydsbank.com/savings/club-lloyds-monthly-saver.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_004", "name": "Cash ISA", "category": "Savings", "interest_rate_aer": "2.50%", "min_deposit": 1, "monthly_min": 0, "term_months": 0, "eligibility_tier": "NORMAL", "fees": "Tax-free up to £20,000", "product_url": "https://www.lloydsbank.com/savings/cash-isa.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_005", "name": "Club Lloyds Advantage Saver", "category": "Savings", "interest_rate_aer": "2.75%", "min_deposit": 1, "monthly_min": 0, "term_months": 0, "eligibility_tier": "NORMAL", "fees": "Up to 5 savings pots", "product_url": "https://www.lloydsbank.com/savings/club-lloyds-advantage-saver.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_006", "name": "Club Lloyds Advantage ISA Saver", "category": "Savings", "interest_rate_aer": "2.75%", "min_deposit": 1, "monthly_min": 0, "term_months": 0, "eligibility_tier": "NORMAL", "fees": "Tax-free", "product_url": "https://www.lloydsbank.com/savings/club-lloyds-advantage-isa-saver.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_007", "name": "Ready-Made Investments Cautious", "category": "Investments", "interest_rate_aer": "Estimated 3.5%", "min_deposit": 50, "monthly_min": 50, "term_months": 0, "eligibility_tier": "NORMAL", "fees": "£3/month fee", "product_url": "https://www.lloydsbank.com/investing/ready-made-investments.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_008", "name": "Fixed Rate Bond", "category": "Savings", "interest_rate_aer": "4.40%", "min_deposit": 2000, "monthly_min": 0, "term_months": 12, "eligibility_tier": "PRIVILEGED", "fees": "Fixed term, no early access", "product_url": "https://www.lloydsbank.com/savings/fixed-rate-bond.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_009", "name": "Ready-Made Investments Balanced", "category": "Investments", "interest_rate_aer": "Estimated 5.8%", "min_deposit": 50, "monthly_min": 50, "term_months": 0, "eligibility_tier": "PRIVILEGED", "fees": "0.24% annual account fee", "product_url": "https://www.lloydsbank.com/investing/ready-made-investments.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_010", "name": "Ready-Made Investments Adventurous", "category": "Investments", "interest_rate_aer": "Estimated 8.2%", "min_deposit": 500, "monthly_min": 50, "term_months": 0, "eligibility_tier": "PRIVILEGED", "fees": "0.24% account fee + fund fees", "product_url": "https://www.lloydsbank.com/investing/ready-made-investments.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_011", "name": "Share Dealing ISA", "category": "Investments", "interest_rate_aer": "N/A", "min_deposit": 100, "monthly_min": 0, "term_months": 0, "eligibility_tier": "PRIVILEGED", "fees": "£9.50 per trade, £40 annual fee", "product_url": "https://www.lloydsbank.com/investing/share-dealing-isa.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_012", "name": "Personal Pension (SIPP)", "category": "Investments", "interest_rate_aer": "Estimated 6.5%", "min_deposit": 500, "monthly_min": 50, "term_months": 0, "eligibility_tier": "PRIVILEGED", "fees": "Tax relief up to 100% of earnings", "product_url": "https://www.lloydsbank.com/investing/personal-pension.html", "scraped_at": datetime.datetime.now().isoformat() },
            { "product_id": "PROD_013", "name": "Club Lloyds Private Banking", "category": "Wealth", "interest_rate_aer": "Negotiated", "min_deposit": 250000, "monthly_min": 0, "term_months": 0, "eligibility_tier": "PRIVILEGED", "fees": "Bespoke pricing", "product_url": "https://www.lloydsbank.com/private-banking.html", "scraped_at": datetime.datetime.now().isoformat() }
        ]

        # 2. Generate Customers
        first_names = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Elizabeth", "William", "Linda", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley", "Steven", "Dorothy", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna", "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa", "Edward", "Deborah"]
        last_names = ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright", "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Harris", "Clark", "Lewis", "Thomas", "Harrison", "Martin", "Patel", "Cooper", "Ward", "Turner", "Carter", "Phillips", "Mitchell", "Yates", "Webb", "Pearson", "Gray", "Mason", "Hills", "Simpson", "Marshall", "Collins", "Bennett", "Bailey", "Fox", "Cox", "Ellis", "Graham", "Chapman", "Shaw"]
        life_stages = ["Young Professional", "Established Family", "Mid-Career", "Retired", "Student", "Empty Nester"]

        # Explicit demo scenarios
        self.customers.append({ "customer_id": "CUST_0042", "name": "Marcus Sterling", "age": 29, "life_stage": "Young Professional", "tenure_years": 3, "income_annual": 28000, "income_band": "£20k - £30k", "premier_flag": False, "tier": "NORMAL" })
        self.customers.append({ "customer_id": "CUST_0099", "name": "Victoria Hargreaves", "age": 42, "life_stage": "Mid-Career Specialist", "tenure_years": 12, "income_annual": 95000, "income_band": "£90k - £100k", "premier_flag": True, "tier": "PRIVILEGED" })
        self.customers.append({ "customer_id": "CUST_0150", "name": "Julian Finch", "age": 36, "life_stage": "High Spend Professional", "tenure_years": 5, "income_annual": 110000, "income_band": "£100k+", "premier_flag": False, "tier": "PRIVILEGED" })

        for i in range(1, 1001):
            padded_id = f"CUST_{str(i).zfill(4)}"
            if padded_id in ["CUST_0042", "CUST_0099", "CUST_0150"]:
                continue

            seed = i
            first_name = first_names[seed % len(first_names)]
            last_name = last_names[(seed * 7) % len(last_names)]
            age = 18 + (seed % 65)
            life_stage = life_stages[seed % len(life_stages)]
            tenure = 1 + (seed % 20)
            
            income_annual = 18000 + (seed * 431) % 150000
            tier = "PRIVILEGED" if income_annual >= 65000 else "NORMAL"
            
            if income_annual < 25000: income_band = "£15k - £25k"
            elif income_annual < 40000: income_band = "£25k - £40k"
            elif income_annual < 60000: income_band = "£40k - £60k"
            elif income_annual < 100000: income_band = "£60k - £100k"
            else: income_band = "£100k+"

            self.customers.append({ "customer_id": padded_id, "name": f"{first_name} {last_name}", "age": age, "life_stage": life_stage, "tenure_years": tenure, "income_annual": income_annual, "income_band": income_band, "premier_flag": tier == "PRIVILEGED" and (seed % 3 == 0), "tier": tier })

        # 3. Generate Accounts
        for idx, cust in enumerate(self.customers):
            seed = idx
            cust_id = cust["customer_id"]
            num_suffix = cust_id.split('_')[1]
            
            is_distressed = (int(num_suffix) % 6 == 0)
            is_wealthy = (int(num_suffix) % 5 == 0)

            if cust_id == "CUST_0042" or (is_distressed and cust["tier"] == "NORMAL"):
                self.accounts.append({ "account_id": f"ACC_{num_suffix}_1", "customer_id": cust_id, "account_type": "Classic Current Account", "balance": 15.50, "opened_date": "2022-01-10", "credit_limit": 500, "product_id": None })
                self.accounts.append({ "account_id": f"ACC_{num_suffix}_2", "customer_id": cust_id, "account_type": "Flexible Saver", "balance": 5.00, "opened_date": "2022-03-15", "credit_limit": 0, "product_id": "PROD_001" })
            elif cust_id == "CUST_0099" or (is_wealthy and cust["tier"] == "PRIVILEGED"):
                self.accounts.append({ "account_id": f"ACC_{num_suffix}_1", "customer_id": cust_id, "account_type": "Club Lloyds Current Account", "balance": 25000.00 + (seed * 100), "opened_date": "2014-03-22", "credit_limit": 5000, "product_id": None })
                self.accounts.append({ "account_id": f"ACC_{num_suffix}_2", "customer_id": cust_id, "account_type": "Club Lloyds Advantage Saver", "balance": 75000.00 + (seed * 500), "opened_date": "2018-05-11", "credit_limit": 0, "product_id": "PROD_005" })
                self.accounts.append({ "account_id": f"ACC_{num_suffix}_3", "customer_id": cust_id, "account_type": "Cash ISA", "balance": 15000.00, "opened_date": "2020-04-06", "credit_limit": 0, "product_id": "PROD_004" })
            elif cust_id == "CUST_0150":
                self.accounts.append({ "account_id": "ACC_0150_1", "customer_id": cust_id, "account_type": "Choice Current Account", "balance": -1250.00, "opened_date": "2021-02-18", "credit_limit": 2000, "product_id": None })
                self.accounts.append({ "account_id": "ACC_0150_2", "customer_id": cust_id, "account_type": "Standard Saver", "balance": 150.00, "opened_date": "2021-04-12", "credit_limit": 0, "product_id": "PROD_002" })
                self.accounts.append({ "account_id": "ACC_0150_3", "customer_id": cust_id, "account_type": "Lloyds Bank Credit Card", "balance": 9500.00, "opened_date": "2021-09-05", "credit_limit": 10000, "product_id": None })
            else:
                has_privilege = cust["tier"] == "PRIVILEGED"
                current_balance = 2000 + (cust["income_annual"] * 0.05) if has_privilege else 100 + (cust["income_annual"] * 0.01)
                self.accounts.append({ "account_id": f"ACC_{num_suffix}_1", "customer_id": cust_id, "account_type": "Club Lloyds Current Account" if has_privilege else "Classic Current Account", "balance": current_balance, "opened_date": "2018-02-10", "credit_limit": 2500 if has_privilege else 500, "product_id": None })
                
                if cust["income_annual"] % 3 != 0:
                    savings_balance = 15000 + (cust["income_annual"] * 0.4) if has_privilege else 400 + (cust["income_annual"] * 0.05)
                    self.accounts.append({ "account_id": f"ACC_{num_suffix}_2", "customer_id": cust_id, "account_type": "Club Lloyds Advantage Saver" if has_privilege else "Flexible Saver", "balance": savings_balance, "opened_date": "2019-04-15", "credit_limit": 0, "product_id": "PROD_005" if has_privilege else "PROD_001" })
                
                if has_privilege and (cust["income_annual"] % 4 == 0):
                    self.accounts.append({ "account_id": f"ACC_{num_suffix}_3", "customer_id": cust_id, "account_type": "Ready-Made Investments Balanced", "balance": 8000 + (cust["income_annual"] * 0.1), "opened_date": "2021-11-20", "credit_limit": 0, "product_id": "PROD_009" })

        # 4. Generate Transactions
        for cust in self.customers:
            self.generate_deterministic_transactions(cust["customer_id"])

    def get_transactions_for_customer(self, customer_id):
        return [t for t in self.transactions if t["customer_id"] == customer_id]

    def generate_deterministic_transactions(self, customer_id):
        cust = next((c for c in self.customers if c["customer_id"] == customer_id), None)
        if not cust: return []

        current_acc = next((a for a in self.accounts if a["customer_id"] == customer_id and "Current" in a["account_type"]), None)
        current_acc_id = current_acc["account_id"] if current_acc else "ACC_UNKNOWN"

        local_txns = []
        monthly_income = cust["income_annual"] / 12
        today = datetime.date.today()
        
        for month_offset in range(5, -1, -1):
            year = today.year - (1 if today.month - month_offset <= 0 else 0)
            month = (today.month - month_offset - 1) % 12 + 1
            
            # 1. SALARY
            local_txns.append({ "txn_id": f"TXN_{customer_id}_SAL_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 25).isoformat(), "amount": monthly_income, "category": "Salary", "merchant": "EMPLOYER PLC", "type": "CREDIT", "is_direct_debit": False })

            # 2. RENT / MORTGAGE
            rent_amount = -1800 if customer_id == "CUST_0099" else (-2500 if customer_id == "CUST_0150" else -750)
            local_txns.append({ "txn_id": f"TXN_{customer_id}_RENT_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 1).isoformat(), "amount": rent_amount, "category": "Bills", "merchant": "HALIFAX MORTGAGE" if customer_id == "CUST_0099" else "LONDINIUM LETTINGS", "type": "DEBIT", "is_direct_debit": True })

            # 3. UTILITIES
            util_amount = -280 if customer_id == "CUST_0099" else (-350 if customer_id == "CUST_0150" else -150)
            is_missed_dd = customer_id == "CUST_0042" and month_offset == 0
            if not is_missed_dd:
                local_txns.append({ "txn_id": f"TXN_{customer_id}_UTIL_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 3).isoformat(), "amount": util_amount, "category": "Bills", "merchant": "BRITISH GAS", "type": "DEBIT", "is_direct_debit": True })
            else:
                local_txns.append({ "txn_id": f"TXN_{customer_id}_MISSED_DD_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 3).isoformat(), "amount": 0, "category": "Bills", "merchant": "BRITISH GAS (DIRECT DEBIT FAILED - INSUFFICIENT FUNDS)", "type": "FAILED_DD", "is_direct_debit": True })

            # 4. GROCERIES
            local_txns.extend([
                { "txn_id": f"TXN_{customer_id}_GROC1_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 5).isoformat(), "amount": -180 if customer_id == "CUST_0099" else -60, "category": "Groceries", "merchant": "Waitrose" if customer_id == "CUST_0099" else "Tesco", "type": "DEBIT", "is_direct_debit": False },
                { "txn_id": f"TXN_{customer_id}_GROC2_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 15).isoformat(), "amount": -150 if customer_id == "CUST_0099" else -55, "category": "Groceries", "merchant": "Marks & Spencer" if customer_id == "CUST_0099" else "Sainsbury's", "type": "DEBIT", "is_direct_debit": False },
                { "txn_id": f"TXN_{customer_id}_GROC3_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 22).isoformat(), "amount": -160 if customer_id == "CUST_0099" else -45, "category": "Groceries", "merchant": "Waitrose" if customer_id == "CUST_0099" else "Lidl", "type": "DEBIT", "is_direct_debit": False }
            ])

            # 5. LEISURE & SHOPPING
            l1 = -120 if customer_id == "CUST_0042" else (-250 if customer_id == "CUST_0099" else -850)
            l2 = -180 if customer_id == "CUST_0042" else (-150 if customer_id == "CUST_0099" else -920)
            local_txns.extend([
                { "txn_id": f"TXN_{customer_id}_LEIS1_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 8).isoformat(), "amount": l1, "category": "Leisure", "merchant": "SELFIDGES" if customer_id == "CUST_0150" else "AMAZON", "type": "DEBIT", "is_direct_debit": False },
                { "txn_id": f"TXN_{customer_id}_LEIS2_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 18).isoformat(), "amount": l2, "category": "Shopping", "merchant": "GUCCI" if customer_id == "CUST_0150" else "ASOS", "type": "DEBIT", "is_direct_debit": False }
            ])

            # 6. DINING
            d1 = -80 if customer_id == "CUST_0042" else (-150 if customer_id == "CUST_0099" else -400)
            d2 = -75 if customer_id == "CUST_0042" else (-120 if customer_id == "CUST_0099" else -350)
            local_txns.extend([
                { "txn_id": f"TXN_{customer_id}_DIN1_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 12).isoformat(), "amount": d1, "category": "Dining", "merchant": "THE IVY" if customer_id == "CUST_0099" else "DELIVEROO", "type": "DEBIT", "is_direct_debit": False },
                { "txn_id": f"TXN_{customer_id}_DIN2_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 27).isoformat(), "amount": d2, "category": "Dining", "merchant": "LOCAL GASTROPUB" if customer_id == "CUST_0099" else "UBER EATS", "type": "DEBIT", "is_direct_debit": False }
            ])

            if customer_id == "CUST_0042" and month_offset in [0, 1]:
                local_txns.append({ "txn_id": f"TXN_{customer_id}_OD_FEE_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 28).isoformat(), "amount": -35.00, "category": "Charges", "merchant": "LLOYDS OVERDRAFT CHARGE", "type": "DEBIT", "is_direct_debit": False })

            if customer_id == "CUST_0150" and month_offset < 3:
                local_txns.append({ "txn_id": f"TXN_{customer_id}_CC_INTEREST_{month_offset}", "account_id": current_acc_id, "customer_id": customer_id, "date": datetime.date(year, month, 28).isoformat(), "amount": -185.00, "category": "Charges", "merchant": "LLOYDS CREDIT CARD INTEREST", "type": "DEBIT", "is_direct_debit": False })

        self.transactions.extend(local_txns)
        return local_txns

    def create_account(self, customer_id, account_type, balance, product_id):
        acc_id = f"ACC_{random.randint(100000, 999999)}"
        new_acc = { "account_id": acc_id, "customer_id": customer_id, "account_type": account_type, "balance": balance, "opened_date": datetime.date.today().isoformat(), "credit_limit": 0, "product_id": product_id }
        self.accounts.append(new_acc)
        return new_acc

    def insert_transaction(self, account_id, customer_id, amount, category, merchant, txn_type, is_direct_debit=False):
        txn_id = f"TXN_{random.randint(1000000, 9999999)}"
        new_txn = { "txn_id": txn_id, "account_id": account_id, "customer_id": customer_id, "date": datetime.date.today().isoformat(), "amount": amount, "category": category, "merchant": merchant, "type": txn_type, "is_direct_debit": is_direct_debit }
        self.transactions.append(new_txn)
        acc = next((a for a in self.accounts if a["account_id"] == account_id), None)
        if acc: acc["balance"] += amount
        return new_txn
