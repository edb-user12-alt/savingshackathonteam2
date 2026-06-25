/**
 * Lloyds Financial Wellbeing AI - Synthetic Database (BigQuery Simulation)
 * Contains 500+ synthetic customer records, accounts, transactions, products, and banners.
 * Supports standard querying, transactional operations, and deterministic state.
 */

class BigQuerySimulation {
  constructor() {
    this.customers = [];
    this.accounts = [];
    this.transactions = [];
    this.products_live = [];
    this.banners = [];
    
    this.initDatabase();
  }

  initDatabase() {
    console.log("Initializing Synthetic BigQuery Database (500+ customers)...");

    // 1. Initialize Live Products (grounded from lloydsbank.com/savings & lloydsbank.com/investing)
    this.products_live = [
      { product_id: "PROD_001", name: "Flexible Saver", category: "Savings", interest_rate_aer: "1.40%", min_deposit: 1, monthly_min: 0, term_months: 0, eligibility_tier: "NORMAL", fees: "No fees", product_url: "https://www.lloydsbank.com/savings/flexible-saver.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_002", name: "Standard Saver", category: "Savings", interest_rate_aer: "1.30%", min_deposit: 1, monthly_min: 0, term_months: 0, eligibility_tier: "NORMAL", fees: "No fees", product_url: "https://www.lloydsbank.com/savings/standard-saver.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_003", name: "Club Lloyds Monthly Saver", category: "Savings", interest_rate_aer: "6.25%", min_deposit: 25, monthly_min: 25, term_months: 12, eligibility_tier: "NORMAL", fees: "Club Lloyds account required", product_url: "https://www.lloydsbank.com/savings/club-lloyds-monthly-saver.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_004", name: "Cash ISA", category: "Savings", interest_rate_aer: "2.50%", min_deposit: 1, monthly_min: 0, term_months: 0, eligibility_tier: "NORMAL", fees: "Tax-free up to £20,000", product_url: "https://www.lloydsbank.com/savings/cash-isa.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_005", name: "Club Lloyds Advantage Saver", category: "Savings", interest_rate_aer: "2.75%", min_deposit: 1, monthly_min: 0, term_months: 0, eligibility_tier: "NORMAL", fees: "Up to 5 savings pots", product_url: "https://www.lloydsbank.com/savings/club-lloyds-advantage-saver.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_006", name: "Club Lloyds Advantage ISA Saver", category: "Savings", interest_rate_aer: "2.75%", min_deposit: 1, monthly_min: 0, term_months: 0, eligibility_tier: "NORMAL", fees: "Tax-free", product_url: "https://www.lloydsbank.com/savings/club-lloyds-advantage-isa-saver.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_007", name: "Ready-Made Investments Cautious", category: "Investments", interest_rate_aer: "Estimated 3.5%", min_deposit: 50, monthly_min: 50, term_months: 0, eligibility_tier: "NORMAL", fees: "£3/month fee", product_url: "https://www.lloydsbank.com/investing/ready-made-investments.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_008", name: "Fixed Rate Bond", category: "Savings", interest_rate_aer: "4.40%", min_deposit: 2000, monthly_min: 0, term_months: 12, eligibility_tier: "PRIVILEGED", fees: "Fixed term, no early access", product_url: "https://www.lloydsbank.com/savings/fixed-rate-bond.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_009", name: "Ready-Made Investments Balanced", category: "Investments", interest_rate_aer: "Estimated 5.8%", min_deposit: 50, monthly_min: 50, term_months: 0, eligibility_tier: "PRIVILEGED", fees: "0.24% annual account fee", product_url: "https://www.lloydsbank.com/investing/ready-made-investments.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_010", name: "Ready-Made Investments Adventurous", category: "Investments", interest_rate_aer: "Estimated 8.2%", min_deposit: 500, monthly_min: 50, term_months: 0, eligibility_tier: "PRIVILEGED", fees: "0.24% account fee + fund fees", product_url: "https://www.lloydsbank.com/investing/ready-made-investments.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_011", name: "Share Dealing ISA", category: "Investments", interest_rate_aer: "N/A", min_deposit: 100, monthly_min: 0, term_months: 0, eligibility_tier: "PRIVILEGED", fees: "£9.50 per trade, £40 annual fee", product_url: "https://www.lloydsbank.com/investing/share-dealing-isa.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_012", name: "Personal Pension (SIPP)", category: "Investments", interest_rate_aer: "Estimated 6.5%", min_deposit: 500, monthly_min: 50, term_months: 0, eligibility_tier: "PRIVILEGED", fees: "Tax relief up to 100% of earnings", product_url: "https://www.lloydsbank.com/investing/personal-pension.html", scraped_at: new Date().toISOString() },
      { product_id: "PROD_013", name: "Club Lloyds Private Banking", category: "Wealth", interest_rate_aer: "Negotiated", min_deposit: 250000, monthly_min: 0, term_months: 0, eligibility_tier: "PRIVILEGED", fees: "Bespoke pricing", product_url: "https://www.lloydsbank.com/private-banking.html", scraped_at: new Date().toISOString() }
    ];

    // 2. Generate 500+ Customers programmatically
    const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Elizabeth", "William", "Linda", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley", "Steven", "Dorothy", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna", "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa", "Edward", "Deborah"];
    const lastNames = ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright", "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Harris", "Clark", "Lewis", "Thomas", "Harrison", "Martin", "Patel", "Cooper", "Ward", "Turner", "Carter", "Phillips", "Mitchell", "Yates", "Webb", "Pearson", "Gray", "Mason", "Hills", "Simpson", "Marshall", "Collins", "Bennett", "Bailey", "Fox", "Cox", "Ellis", "Graham", "Chapman", "Shaw"];
    const lifeStages = ["Young Professional", "Established Family", "Mid-Career", "Retired", "Student", "Empty Nester"];
    
    // Explicit demo scenarios
    // Scenario 1: NORMAL + RED (CUST_0042)
    this.customers.push({
      customer_id: "CUST_0042",
      name: "Marcus Sterling",
      age: 29,
      life_stage: "Young Professional",
      tenure_years: 3,
      income_annual: 28000,
      income_band: "£20k - £30k",
      premier_flag: false,
      tier: "NORMAL"
    });

    // Scenario 2: PRIVILEGED + GREEN (CUST_0099)
    this.customers.push({
      customer_id: "CUST_0099",
      name: "Victoria Hargreaves",
      age: 42,
      life_stage: "Mid-Career Specialist",
      tenure_years: 12,
      income_annual: 95000,
      income_band: "£90k - £100k",
      premier_flag: true,
      tier: "PRIVILEGED"
    });

    // Scenario 3: PRIVILEGED + RED (CUST_0150)
    this.customers.push({
      customer_id: "CUST_0150",
      name: "Julian Finch",
      age: 36,
      life_stage: "High Spend Professional",
      tenure_years: 5,
      income_annual: 110000,
      income_band: "£100k+",
      premier_flag: false,
      tier: "PRIVILEGED"
    });

    // Generate remaining up to 505 customers
    for (let i = 1; i <= 505; i++) {
      const paddedId = "CUST_" + String(i).padStart(4, "0");
      if (paddedId === "CUST_0042" || paddedId === "CUST_0099" || paddedId === "CUST_0150") {
        continue; // Skip already defined
      }

      const seed = i;
      const firstName = firstNames[seed % firstNames.length];
      const lastName = lastNames[(seed * 7) % lastNames.length];
      const age = 18 + (seed % 65);
      const lifeStage = lifeStages[seed % lifeStages.length];
      const tenure = 1 + (seed % 20);
      
      // Determine income and tier
      let income_annual = 15000 + (seed * 373) % 120000;
      let tier = income_annual >= 50000 ? "PRIVILEGED" : "NORMAL";
      let income_band = "";
      if (income_annual < 25000) income_band = "< £25k";
      else if (income_annual < 50000) income_band = "£25k - £50k";
      else if (income_annual < 80000) income_band = "£50k - £80k";
      else income_band = "£80k+";

      this.customers.push({
        customer_id: paddedId,
        name: `${firstName} ${lastName}`,
        age,
        life_stage: lifeStage,
        tenure_years: tenure,
        income_annual,
        income_band,
        premier_flag: tier === "PRIVILEGED" && (seed % 3 === 0),
        tier
      });
    }

    // 3. Generate Accounts for all customers
    this.customers.forEach(cust => {
      const isCUST_0042 = cust.customer_id === "CUST_0042";
      const isCUST_0099 = cust.customer_id === "CUST_0099";
      const isCUST_0150 = cust.customer_id === "CUST_0150";

      if (isCUST_0042) {
        // Normal Red: Overdrawn Current, no savings
        this.accounts.push({
          account_id: "ACC_0042_1",
          customer_id: cust.customer_id,
          account_type: "Classic Current Account",
          balance: -150.00,
          opened_date: "2023-01-15",
          credit_limit: 500,
          product_id: null
        });
        this.accounts.push({
          account_id: "ACC_0042_2",
          customer_id: cust.customer_id,
          account_type: "Standard Saver",
          balance: 0.00,
          opened_date: "2023-06-10",
          credit_limit: 0,
          product_id: "PROD_002"
        });
      } else if (isCUST_0099) {
        // Privileged Green: Strong balances, premier
        this.accounts.push({
          account_id: "ACC_0099_1",
          customer_id: cust.customer_id,
          account_type: "Club Lloyds Current Account",
          balance: 12500.00,
          opened_date: "2014-03-22",
          credit_limit: 5000,
          product_id: null
        });
        this.accounts.push({
          account_id: "ACC_0099_2",
          customer_id: cust.customer_id,
          account_type: "Club Lloyds Advantage Saver",
          balance: 45000.00,
          opened_date: "2018-05-11",
          credit_limit: 0,
          product_id: "PROD_005"
        });
        this.accounts.push({
          account_id: "ACC_0099_3",
          customer_id: cust.customer_id,
          account_type: "Cash ISA",
          balance: 2000.00,
          opened_date: "2020-04-06",
          credit_limit: 0,
          product_id: "PROD_004"
        });
      } else if (isCUST_0150) {
        // Privileged Red: High income, but deep credit card debt and overdrawn current
        this.accounts.push({
          account_id: "ACC_0150_1",
          customer_id: cust.customer_id,
          account_type: "Choice Current Account",
          balance: -1250.00,
          opened_date: "2021-02-18",
          credit_limit: 2000,
          product_id: null
        });
        this.accounts.push({
          account_id: "ACC_0150_2",
          customer_id: cust.customer_id,
          account_type: "Standard Saver",
          balance: 150.00,
          opened_date: "2021-04-12",
          credit_limit: 0,
          product_id: "PROD_002"
        });
        this.accounts.push({
          account_id: "ACC_0150_3",
          customer_id: cust.customer_id,
          account_type: "Lloyds Bank Credit Card",
          balance: 9500.00, // debt
          opened_date: "2021-09-05",
          credit_limit: 10000,
          product_id: null
        });
      } else {
        // Standard generator
        const hasPrivilege = cust.tier === "PRIVILEGED";
        const currentBalance = hasPrivilege ? 2000 + (cust.income_annual * 0.05) : 100 + (cust.income_annual * 0.01);
        
        this.accounts.push({
          account_id: `ACC_${cust.customer_id.split('_')[1]}_1`,
          customer_id: cust.customer_id,
          account_type: hasPrivilege ? "Club Lloyds Current Account" : "Classic Current Account",
          balance: currentBalance,
          opened_date: `2018-02-10`,
          credit_limit: hasPrivilege ? 2500 : 500,
          product_id: null
        });

        const hasSavings = (cust.income_annual % 3 !== 0);
        if (hasSavings) {
          const savingsBalance = hasPrivilege ? 15000 + (cust.income_annual * 0.4) : 400 + (cust.income_annual * 0.05);
          this.accounts.push({
            account_id: `ACC_${cust.customer_id.split('_')[1]}_2`,
            customer_id: cust.customer_id,
            account_type: hasPrivilege ? "Club Lloyds Advantage Saver" : "Flexible Saver",
            balance: savingsBalance,
            opened_date: `2019-04-15`,
            credit_limit: 0,
            product_id: hasPrivilege ? "PROD_005" : "PROD_001"
          });
        }
        
        // Some investments for privileged green
        const hasInvestments = hasPrivilege && (cust.income_annual % 4 === 0);
        if (hasInvestments) {
          this.accounts.push({
            account_id: `ACC_${cust.customer_id.split('_')[1]}_3`,
            customer_id: cust.customer_id,
            account_type: "Ready-Made Investments Balanced",
            balance: 8000 + (cust.income_annual * 0.1),
            opened_date: `2021-11-20`,
            credit_limit: 0,
            product_id: "PROD_009"
          });
        }
      }
    });

    // 4. Generate Transactions (to back 6-month transaction charts deterministically)
    // We generate transactions for any requested customer dynamically and cache them, 
    // but we can pre-generate specific seed transactions for our demo scenarios to guarantee perfect data matching.
    console.log("Pre-populating core transactions for demo scenarios...");
    this.generateDeterministicTransactions("CUST_0042");
    this.generateDeterministicTransactions("CUST_0099");
    this.generateDeterministicTransactions("CUST_0150");
  }

  // Returns transactions for a customer, generating them on-the-fly and caching them if needed
  getTransactionsForCustomer(customer_id) {
    const cached = this.transactions.filter(t => t.customer_id === customer_id);
    if (cached.length > 0) {
      return cached;
    }
    return this.generateDeterministicTransactions(customer_id);
  }

  generateDeterministicTransactions(customer_id) {
    const cust = this.customers.find(c => c.customer_id === customer_id);
    if (!cust) return [];

    const accounts = this.accounts.filter(a => a.customer_id === customer_id);
    const currentAccount = this.accounts.find(a => a.customer_id === customer_id && a.account_type.includes("Current"));
    const currentAccountId = currentAccount ? currentAccount.account_id : "ACC_UNKNOWN";

    const localTransactions = [];
    const monthlyIncome = cust.income_annual / 12;
    const isCUST_0042 = customer_id === "CUST_0042";
    const isCUST_0099 = customer_id === "CUST_0099";
    const isCUST_0150 = customer_id === "CUST_0150";

    // Set timeline: 6 months (180 days)
    const today = new Date();
    
    // Monthly salary credit, rent/mortgage, utilities, direct debits, groceries, leisure
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const year = today.getFullYear() - (today.getMonth() - monthOffset < 0 ? 1 : 0);
      const month = (today.getMonth() - monthOffset + 12) % 12;
      
      const salaryDate = new Date(year, month, 25);
      const rentDate = new Date(year, month, 1);
      const utilityDate = new Date(year, month, 3);
      const groceryDate1 = new Date(year, month, 5);
      const groceryDate2 = new Date(year, month, 15);
      const groceryDate3 = new Date(year, month, 22);
      const leisureDate1 = new Date(year, month, 8);
      const leisureDate2 = new Date(year, month, 18);
      const diningDate1 = new Date(year, month, 12);
      const diningDate2 = new Date(year, month, 27);
      
      // Salary
      let salaryAmount = monthlyIncome;
      // Normal Red Scenario has a missed DD and overdraft events
      if (isCUST_0042 && monthOffset === 1) {
        // Lower salary or higher expense causing overdraft
      }

      // 1. SALARY
      localTransactions.push({
        txn_id: `TXN_${customer_id}_SAL_${monthOffset}`,
        account_id: currentAccountId,
        customer_id: customer_id,
        date: salaryDate.toISOString().split('T')[0],
        amount: salaryAmount,
        category: "Salary",
        merchant: "EMPLOYER PLC",
        type: "CREDIT",
        is_direct_debit: false
      });

      // 2. RENT / MORTGAGE
      let rentAmount = isCUST_0099 ? -1800 : (isCUST_0150 ? -2500 : -750);
      localTransactions.push({
        txn_id: `TXN_${customer_id}_RENT_${monthOffset}`,
        account_id: currentAccountId,
        customer_id: customer_id,
        date: rentDate.toISOString().split('T')[0],
        amount: rentAmount,
        category: "Bills",
        merchant: isCUST_0099 ? "HALIFAX MORTGAGE" : "LONDINIUM LETTINGS",
        type: "DEBIT",
        is_direct_debit: true
      });

      // 3. UTILITIES
      let utilAmount = isCUST_0099 ? -280 : (isCUST_0150 ? -350 : -150);
      // Missed DD simulation for CUST_0042 (missed utility in last 30 days, monthOffset === 0)
      const isMissedDD = isCUST_0042 && monthOffset === 0;
      if (!isMissedDD) {
        localTransactions.push({
          txn_id: `TXN_${customer_id}_UTIL_${monthOffset}`,
          account_id: currentAccountId,
          customer_id: customer_id,
          date: utilityDate.toISOString().split('T')[0],
          amount: utilAmount,
          category: "Bills",
          merchant: "BRITISH GAS",
          type: "DEBIT",
          is_direct_debit: true
        });
      } else {
        // Log a failed direct debit / missed DD
        localTransactions.push({
          txn_id: `TXN_${customer_id}_MISSED_DD_${monthOffset}`,
          account_id: currentAccountId,
          customer_id: customer_id,
          date: utilityDate.toISOString().split('T')[0],
          amount: 0,
          category: "Bills",
          merchant: "BRITISH GAS (DIRECT DEBIT FAILED - INSUFFICIENT FUNDS)",
          type: "FAILED_DD",
          is_direct_debit: true
        });
      }

      // 4. GROCERIES
      localTransactions.push(
        { txn_id: `TXN_${customer_id}_GROC1_${monthOffset}`, account_id: currentAccountId, customer_id, date: groceryDate1.toISOString().split('T')[0], amount: isCUST_0099 ? -180 : -60, category: "Groceries", merchant: isCUST_0099 ? "Waitrose" : "Tesco", type: "DEBIT", is_direct_debit: false },
        { txn_id: `TXN_${customer_id}_GROC2_${monthOffset}`, account_id: currentAccountId, customer_id, date: groceryDate2.toISOString().split('T')[0], amount: isCUST_0099 ? -150 : -55, category: "Groceries", merchant: isCUST_0099 ? "Marks & Spencer" : "Sainsbury's", type: "DEBIT", is_direct_debit: false },
        { txn_id: `TXN_${customer_id}_GROC3_${monthOffset}`, account_id: currentAccountId, customer_id, date: groceryDate3.toISOString().split('T')[0], amount: isCUST_0099 ? -160 : -45, category: "Groceries", merchant: isCUST_0099 ? "Waitrose" : "Lidl", type: "DEBIT", is_direct_debit: false }
      );

      // 5. LEISURE & SHOPPING
      let leisure1 = isCUST_0042 ? -120 : (isCUST_0099 ? -250 : -850);
      let leisure2 = isCUST_0042 ? -180 : (isCUST_0099 ? -150 : -920);
      localTransactions.push(
        { txn_id: `TXN_${customer_id}_LEIS1_${monthOffset}`, account_id: currentAccountId, customer_id, date: leisureDate1.toISOString().split('T')[0], amount: leisure1, category: "Leisure", merchant: isCUST_0150 ? "SELFIDGES" : "AMAZON", type: "DEBIT", is_direct_debit: false },
        { txn_id: `TXN_${customer_id}_LEIS2_${monthOffset}`, account_id: currentAccountId, customer_id, date: leisureDate2.toISOString().split('T')[0], amount: leisure2, category: "Shopping", merchant: isCUST_0150 ? "GUCCI" : "ASOS", type: "DEBIT", is_direct_debit: false }
      );

      // 6. DINING
      let dining1 = isCUST_0042 ? -80 : (isCUST_0099 ? -150 : -400);
      let dining2 = isCUST_0042 ? -75 : (isCUST_0099 ? -120 : -350);
      localTransactions.push(
        { txn_id: `TXN_${customer_id}_DIN1_${monthOffset}`, account_id: currentAccountId, customer_id, date: diningDate1.toISOString().split('T')[0], amount: dining1, category: "Dining", merchant: isCUST_0099 ? "THE IVY" : "DELIVEROO", type: "DEBIT", is_direct_debit: false },
        { txn_id: `TXN_${customer_id}_DIN2_${monthOffset}`, account_id: currentAccountId, customer_id, date: diningDate2.toISOString().split('T')[0], amount: dining2, category: "Dining", merchant: isCUST_0099 ? "LOCAL GASTROPUB" : "UBER EATS", type: "DEBIT", is_direct_debit: false }
      );

      // Overdraft fees for RED scenarios
      if (isCUST_0042 && (monthOffset === 0 || monthOffset === 1)) {
        localTransactions.push({
          txn_id: `TXN_${customer_id}_OD_FEE_${monthOffset}`,
          account_id: currentAccountId,
          customer_id: customer_id,
          date: new Date(year, month, 28).toISOString().split('T')[0],
          amount: -35.00,
          category: "Charges",
          merchant: "LLOYDS OVERDRAFT CHARGE",
          type: "DEBIT",
          is_direct_debit: false
        });
      }

      if (isCUST_0150 && monthOffset < 3) {
        localTransactions.push({
          txn_id: `TXN_${customer_id}_CC_INTEREST_${monthOffset}`,
          account_id: currentAccountId,
          customer_id: customer_id,
          date: new Date(year, month, 28).toISOString().split('T')[0],
          amount: -185.00,
          category: "Charges",
          merchant: "LLOYDS CREDIT CARD INTEREST",
          type: "DEBIT",
          is_direct_debit: false
        });
      }
    }

    // Merge into database transactions and return
    this.transactions.push(...localTransactions);
    return localTransactions;
  }

  // Create account (Agent 6 purchase)
  createAccount(customer_id, account_type, balance, product_id) {
    const account_id = "ACC_" + String(Math.floor(100000 + Math.random() * 900000));
    const newAccount = {
      account_id,
      customer_id,
      account_type,
      balance,
      opened_date: new Date().toISOString().split('T')[0],
      credit_limit: 0,
      product_id
    };
    this.accounts.push(newAccount);
    return newAccount;
  }

  // Add transaction (Agent 6 purchase debit)
  insertTransaction(account_id, customer_id, amount, category, merchant, type, is_direct_debit = false) {
    const txn_id = "TXN_" + String(Math.floor(1000000 + Math.random() * 9000000));
    const newTxn = {
      txn_id,
      account_id,
      customer_id,
      date: new Date().toISOString().split('T')[0],
      amount,
      category,
      merchant,
      type,
      is_direct_debit
    };
    this.transactions.push(newTxn);
    
    // Update account balance
    const acc = this.accounts.find(a => a.account_id === account_id);
    if (acc) {
      acc.balance += amount; // amount is negative for DEBIT, positive for CREDIT
    }
    return newTxn;
  }
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BigQuerySimulation };
} else {
  window.BigQuerySimulation = BigQuerySimulation;
}
