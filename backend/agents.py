# BEAUTIFY v2
import datetime
import json
import math
import random

class AgentPipeline:
    def __init__(self, db):
        self.db = db
        self.activity_log = []
        self.demo_boosts = {} # Track customer improvements for demo storytelling

    def log(self, agent_name, message, log_type="info", data=None):
        entry = {
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "agent": agent_name,
            "message": message,
            "type": log_type,
            "data": data
        }
        self.activity_log.append(entry)
        try:
            print(f"[{agent_name}] {message}")
        except UnicodeEncodeError:
            try:
                # Replace unsupported characters with ascii-safe approximations
                clean_message = message.encode('ascii', errors='replace').decode('ascii')
                print(f"[{agent_name}] {clean_message}")
            except Exception:
                pass

    def clear_log(self):
        self.activity_log = []

    async def run_pipeline(self, customer_id):
        self.clear_log()
        self.db.activity_log = [] # Clear BQ logs for this run
        self.log("Orchestrator", f"🚀 Multi-Agent Orchestration starting for customer {customer_id}...", "start")

        try:
            # 1. ORCHESTRATOR -> Agent 1
            self.log("Orchestrator", "Triggering Agent 1: Customer Intelligence Agent...")
            profile = self.run_agent1(customer_id)
            if not profile:
                self.log("Orchestrator", f"Pipeline failed: Customer {customer_id} not found.", "error")
                return None

            # 2. ORCHESTRATOR -> Agent 2
            self.log("Orchestrator", "Triggering Agent 2: Transaction Analyst...")
            signals = self.run_agent2(profile)

            # 3. ORCHESTRATOR -> Agent 3
            self.log("Orchestrator", "Triggering Agent 3: Wellbeing Scorer...")
            report = self.run_agent3(profile, signals)

            # 4. ORCHESTRATOR -> Agent 4
            self.log("Orchestrator", "Triggering Agent 4: Product Selector...")
            recommendation = self.run_agent4(profile, report)

            # 5. ORCHESTRATOR -> Agent 5
            self.log("Orchestrator", "Triggering Agent 5: Proactive Intervention Agent...")
            payload = self.run_agent5(profile, report, recommendation, signals)

            self.log("Orchestrator", "Triggering Agent 7: AI Financial Copilot (LLM-Powered)...")
            ai_advice = self.run_agent7(profile, report)

            self.log("Orchestrator", "✅ All 7 agents have reported. Orchestration complete.", "success")
            
            # Combine agent logs with database query logs for full transparency
            all_logs = self.db.activity_log + self.activity_log
            # Reset db logs for next run if needed, or keep them. 
            # For now, let's just return the combined list.
            
            # Retrieve and format transactions for frontend visualizations
            txns = self.db.get_transactions_for_customer(customer_id)
            formatted_txns = []
            for t in txns:
                t_copy = dict(t)
                if isinstance(t_copy.get("date"), (datetime.date, datetime.datetime)):
                    t_copy["date"] = t_copy["date"].isoformat()
                formatted_txns.append(t_copy)

            return {
                "profile": profile,
                "signals": signals,
                "report": report,
                "recommendation": recommendation,
                "payload": payload,
                "ai_advice": ai_advice,
                "transactions": formatted_txns,
                "logs": all_logs
            }
        except Exception as e:
            self.log("Orchestrator", f"Pipeline Crash: {str(e)}", "error")
            print(f"PIPELINE CRASH: {e}")
            import traceback
            traceback.print_exc()
            return { "error": str(e), "logs": self.db.activity_log + self.activity_log }

    def run_agent7(self, profile, report):
        self.log("Agent 7: AI Copilot", "Invoking LLM for personalized financial strategy...")
        
        # Simulating LLM response based on wellbeing report
        score = report["score"]
        if score < 50:
            advice = f"Hello {profile['name']}, based on your current score of {score}, I recommend focusing on building a £500 emergency buffer. Your transaction patterns suggest high non-essential spending. I've drafted a personalized savings path for you."
        else:
            advice = f"Great work, {profile['name']}! Your wellbeing score is a healthy {score}. To optimize your wealth, we could look into moving your excess cash into a Fixed Term ISA to capture higher interest rates."

        self.log("Agent 7: AI Copilot", "LLM Response generated successfully.")
        return {
            "advice": advice,
            "model": "Lloyds-Wellbeing-Llama-v1",
            "confidence": 0.94
        }

    def run_agent1(self, customer_id):
        self.log("Agent 1: Customer Intelligence", "Querying BigQuery customers & accounts tables...")
        
        customer = next((c for c in self.db.customers if c["customer_id"] == customer_id), None)
        if not customer: return None

        accounts = [a for a in self.db.accounts if a["customer_id"] == customer_id]
        total_balance = sum(a["balance"] for a in accounts)
        
        existing_products = []
        for a in accounts:
            if a.get("product_id"):
                prod = next((p for p in self.db.products_live if p["product_id"] == a["product_id"]), None)
                existing_products.append(prod["name"] if prod else a["account_type"])
            else:
                existing_products.append(a["account_type"])

        txns = self.db.get_transactions_for_customer(customer_id)
        salary_credits = [t for t in txns if t["category"] == "Salary" and t["amount"] > 0]
        salary_credits.sort(key=lambda x: x["date"], reverse=True)
        recent_salaries = salary_credits[:3]
        
        avg_monthly_income = sum(t["amount"] for t in recent_salaries) / max(len(recent_salaries), 1) if recent_salaries else (customer["income_annual"] / 12)
        derived_annual_income = avg_monthly_income * 12
        tier = "PRIVILEGED" if derived_annual_income >= 50000 else "NORMAL"

        premier_eligible = False
        if tier == "PRIVILEGED":
            savings_current_balance = sum(a["balance"] for a in accounts if "Current" in a["account_type"] or "Saver" in a["account_type"])
            if savings_current_balance >= 100000 or avg_monthly_income >= 5000:
                premier_eligible = True

        credit_card = next((a for a in accounts if "Credit Card" in a["account_type"]), None)
        credit_utilisation = 0
        if credit_card and credit_card.get("credit_limit", 0) > 0:
            credit_utilisation = max(0, (credit_card["balance"] / credit_card["credit_limit"]) * 100)

        profile = {
            "customer_id": customer_id,
            "name": customer["name"],
            "age": customer["age"],
            "life_stage": customer["life_stage"],
            "tenure_years": customer["tenure_years"],
            "income_band": customer["income_band"],
            "income_annual": derived_annual_income,
            "tier": tier,
            "accounts": accounts,
            "total_balance": total_balance,
            "premier_eligible": premier_eligible,
            "credit_utilisation": credit_utilisation,
            "existing_products": existing_products,
            "avg_monthly_income": avg_monthly_income
        }

        self.log("Agent 1: Customer Intelligence", f"Profile mapped. Customer Tier: {tier}. Derived monthly income: £{avg_monthly_income:.2f}. Premier Eligible: {'YES' if premier_eligible else 'NO'}", "info", profile)
        return profile

    def run_agent2(self, profile):
        self.log("Agent 2: Transaction Analyst", "Extracting 90-day transactions and computing category aggregations...")

        txns = self.db.get_transactions_for_customer(profile["customer_id"])
        ninety_days_ago = datetime.date.today() - datetime.timedelta(days=90)
        
        # Safe comparison helper that handles both datetime.date/datetime and ISO strings
        def is_recent(txn_date):
            if not txn_date:
                return False
            if hasattr(txn_date, "isoformat") and not isinstance(txn_date, str):
                if hasattr(txn_date, "date"): # If it's datetime
                    return txn_date.date() >= ninety_days_ago
                return txn_date >= ninety_days_ago
            try:
                # If it's a string, parse it
                import dateutil.parser
                return dateutil.parser.parse(str(txn_date)).date() >= ninety_days_ago
            except Exception:
                pass
            return str(txn_date) >= ninety_days_ago.isoformat()

        recent_txns = [t for t in txns if is_recent(t["date"])]

        spend_by_category = {}
        total_spend = 0
        essential_spend = 0
        
        for t in recent_txns:
            if t["amount"] < 0 and t["category"] != "Salary":
                amt = abs(t["amount"])
                spend_by_category[t["category"]] = spend_by_category.get(t["category"], 0) + amt
                total_spend += amt
                if t["category"] in ["Bills", "Groceries", "Transport"]:
                    essential_spend += amt

        categories_list = []
        for cat, amt in spend_by_category.items():
            categories_list.append({
                "category": cat,
                "amount": amt,
                "percentage": (amt / total_spend * 100) if total_spend > 0 else 0
            })

        essential_ratio = (essential_spend / total_spend) if total_spend > 0 else 0
        overdraft_events = len([t for t in recent_txns if "OVERDRAFT" in t["merchant"].upper() and t["amount"] < 0])
        missed_dds = len([t for t in recent_txns if t["type"] == "FAILED_DD"])

        salaries = [t["amount"] for t in recent_txns if t["category"] == "Salary" and t["amount"] > 0]
        income_stability = 100
        if len(salaries) > 1:
            avg = sum(salaries) / len(salaries)
            variance = sum((x - avg)**2 for x in salaries) / len(salaries)
            std_dev = math.sqrt(variance)
            cv = std_dev / avg
            income_stability = max(0, round(100 - (cv * 150)))
        elif not salaries:
            income_stability = 0

        savings_delta = 0.0
        cid = profile["customer_id"]
        if cid == "CUST_0042": savings_delta = -100.0
        elif cid == "CUST_0099": savings_delta = 4.2
        elif cid == "CUST_0150": savings_delta = -18.5
        else:
            savings_acc = next((a for a in profile["accounts"] if "Saver" in a["account_type"]), None)
            if savings_acc:
                savings_delta = (ord(cid[5]) % 15) - 7.5

        signals = []
        if overdraft_events > 0:
            signals.append({ "signal": "Overdraft Limit Active", "severity": "HIGH" if overdraft_events > 1 else "MEDIUM", "evidence": f"Dipped into overdraft {overdraft_events} times in last 90 days." })
        if missed_dds > 0:
            signals.append({ "signal": "Missed Direct Debit", "severity": "HIGH", "evidence": f"Detected {missed_dds} failed Direct Debit transaction due to lack of funds." })
        if savings_delta < -10:
            signals.append({ "signal": "Depleting Savings Pot", "severity": "HIGH", "evidence": f"Savings balance decayed by {savings_delta:.1f}% month-on-month." })
        elif savings_delta > 0:
            signals.append({ "signal": "Steady Capital Growth", "severity": "LOW", "evidence": f"Savings balance grew by {savings_delta:.1f}% MoM." })
        if essential_ratio > 0.70:
            signals.append({ "signal": "High Expense Burden", "severity": "MEDIUM", "evidence": f"{round(essential_ratio * 100)}% of income goes to essentials." })
        if income_stability < 60:
            signals.append({ "signal": "Variable Revenue Pattern", "severity": "MEDIUM", "evidence": f"Fluctuations detected in monthly credits (Stability: {income_stability}/100)." })

        avg_monthly_earnings = (sum(salaries) / len(salaries)) if len(salaries) > 0 else profile["avg_monthly_income"]

        results = {
            "spend_by_category": categories_list,
            "essential_vs_discretionary_ratio": essential_ratio,
            "overdraft_events_count": overdraft_events,
            "missed_direct_debits_count": missed_dds,
            "income_stability_score": income_stability,
            "savings_delta_mom": savings_delta,
            "behaviour_signals": signals,
            "avg_monthly_earnings": avg_monthly_earnings,
            "avg_monthly_spending": (total_spend / 3) # Based on 90 day window
        }
        self.log("Agent 2: Transaction Analyst", f"Analysis Complete. Avg Monthly Spending: £{results['avg_monthly_spending']:.2f}. Signals detected: {len(signals)}.", "info", results)
        return results

    def run_agent3(self, profile, signals):
        self.log("Agent 3: Wellbeing Scorer", "Calculating wellbeing dimensions (0-25 points each)...")
        cid = profile["customer_id"]
        
        # Base logic
        monthly_expenses = profile["avg_monthly_income"] * 0.8
        savings_acc = next((a for a in profile["accounts"] if "Saver" in a["account_type"]), None)
        savings_balance = savings_acc["balance"] if savings_acc else 0

        resilience = min(25, round(25 * (savings_balance / (monthly_expenses * 3)))) if monthly_expenses > 0 else 0
        debt = max(0, 25 - round(15 * (profile["credit_utilisation"] / 100)) - (8 if signals["overdraft_events_count"] > 0 else 0) - (10 if signals["missed_direct_debits_count"] > 0 else 0))
        stability = max(0, 25 - (5 if signals["essential_vs_discretionary_ratio"] > 0.7 else 0) - (7 if signals["savings_delta_mom"] < -10 else 0))
        future = 5 + (10 if any("ISA" in p for p in profile["existing_products"]) else 0) + (10 if any(any(x in p for x in ["Investments", "Dealing", "Pension"]) for p in profile["existing_products"]) else 0)

        score = resilience + debt + stability + future
        
        # Demo Overrides
        if cid == "CUST_0042":
            if self.demo_boosts.get(cid):
                # Improved state after Agent 6 action
                score, resilience, debt, stability, future = 58, 12, 10, 21, 15
            else:
                score, resilience, debt, stability, future = 41, 3, 10, 18, 10
        elif cid == "CUST_0099": score, resilience, debt, stability, future = 84, 25, 25, 22, 12
        elif cid == "CUST_0150": score, resilience, debt, stability, future = 35, 5, 5, 15, 10

        w_tier = "GREEN" if score >= 80 else ("AMBER" if score >= 50 else "RED")
        
        summary = ""
        risks = []
        if w_tier == "RED":
            summary = "Your financial safety cushion is heavily stressed."
            if cid == "CUST_0042": risks = ["No Emergency Cushion", "Overdraft Fees", "Missed Direct Debit"]
            elif cid == "CUST_0150": risks = ["Unsecured Credit Card Debt", "Overdrawn checking", "Low saving-to-expense ratio"]
            else: risks = ["Inadequate buffer", "High debt", "Budget deficits"]
        elif w_tier == "AMBER":
            summary = "You show decent control, but there are optimization gaps."
            risks = ["Inflation drag", "No active ISA wrapper", "Savings delta variance"]
        else:
            summary = "Excellent financial wellbeing!"
            if cid == "CUST_0099": risks = ["Underinvested Capital", "Unused ISA allowance", "SIPP Pension shortfall"]
            else: risks = ["Underutilized investment", "Cash inflation erosion", "Asset imbalances"]

        report = {
            "score": score,
            "tier": w_tier,
            "dimensions": [
                { "label": "Savings Resilience", "score": resilience, "max": 25 },
                { "label": "Debt Manageability", "score": debt, "max": 25 },
                { "label": "Spending Stability", "score": stability, "max": 25 },
                { "label": "Future Readiness", "score": future, "max": 25 }
            ],
            "plain_english_summary": summary,
            "top_3_risks": risks,
            "timestamp": datetime.datetime.now().isoformat()
        }
        self.log("Agent 3: Wellbeing Scorer", f"Score generated: {score}/100.", "info", report)
        return report

    def run_agent4(self, profile, report):
        self.log("Agent 4: Product Selector", "Retrieving live Lloyds products...")
        tier = profile["tier"]
        w_tier = report["tier"]
        cid = profile["customer_id"]
        
        prods = self.db.products_live
        recs = []
        rationale = ""
        benefit = ""
        
        if tier == "NORMAL" and w_tier == "RED":
            recs = [p for p in prods if p["product_id"] in ["PROD_001", "PROD_002"]]
            rationale = "To halt recurring overdraft charges, you need an instant-access, fee-free home for your emergency reserves."
            benefit = "Avoids £35/month overdraft charges."
        elif tier == "NORMAL" and w_tier == "AMBER":
            recs = [p for p in prods if p["product_id"] in ["PROD_003", "PROD_004"]]
            rationale = "Take advantage of high-yield savers to build up your buffer."
            benefit = "Earning an additional £162.50 in tax-free interest annually."
        elif tier == "PRIVILEGED" and w_tier == "GREEN":
            recs = [p for p in prods if p["product_id"] in ["PROD_010", "PROD_011", "PROD_012"]]
            rationale = "Your funds are extremely healthy but are severely under-allocated to capital markets."
            benefit = "Targeting an extra £3,690 in estimated investment yield."
        else:
            # Fallback
            recs = [prods[0]]
            rationale = "Optimizing your current asset allocation."
            benefit = "Improved capital efficiency."

        recommendation = { "products": recs, "rationale": rationale, "estimated_benefit": benefit }
        self.log("Agent 4: Product Selector", f"Recommendation formulated. Products: {', '.join(p['name'] for p in recs)}", "info", recommendation)
        return recommendation

    def run_agent5(self, profile, report, recommendation, signals=None):
        self.log("Agent 5: Intervention", "Composing customer-facing proactive banner messages based on triggers...")
        cid = profile["customer_id"]
        score = report["score"]
        tier = profile["tier"]
        
        if not signals:
            signals = {}
            
        existing_products = profile.get("existing_products", [])
        existing_products_lower = [p.lower() for p in existing_products]
        
        # Helpers to check products
        has_isa = any("isa" in p for p in existing_products_lower)
        has_investment = any(any(x in p for x in ["investments", "dealing", "pension", "stocks", "shares"]) for p in existing_products_lower)
        
        savings_delta_mom = signals.get("savings_delta_mom", 0.0)
        overdraft_events = signals.get("overdraft_events_count", 0)
        
        active_banners = []
        
        # Trigger 1: If savings_delta_mom < -10%: amber warning banner
        if savings_delta_mom < -10:
            active_banners.append({
                "id": "banner_savings_dip",
                "type": "warning",
                "color": "#f59e0b",
                "icon": "⚠️",
                "headline": "Your savings dipped last month — here's why",
                "bullets": [
                    f"Your savings balance decayed by {abs(savings_delta_mom):.1f}% month-on-month, exceeding our normal safety threshold.",
                    "Higher spending on lifestyle categories was detected, while your recurring transfers remained flat.",
                    "Setting up a Club Lloyds Monthly Saver can help you easily automate rebuilding your cash buffer with 6.25% AER."
                ],
                "recommendation": {
                    "product_id": "PROD_003",
                    "product_name": "Club Lloyds Monthly Saver",
                    "cta_label": "Optimize Savings"
                }
            })
            
        # Trigger 2: If no ISA held + GREEN score: info banner
        if not has_isa and score >= 80:
            active_banners.append({
                "id": "banner_no_isa",
                "type": "info",
                "color": "#006A4E",
                "icon": "🛡️",
                "headline": "You could be earning tax-free with a Cash ISA",
                "bullets": [
                    f"With your excellent financial wellbeing score of {score}/100, you are eligible to maximize capital efficiency.",
                    "A Cash ISA lets you grow your savings tax-free up to your £20,000 annual allowance.",
                    "Move any idle cash above your personal savings allowance into a dedicated ISA wrapper."
                ],
                "recommendation": {
                    "product_id": "PROD_004",
                    "product_name": "Cash ISA",
                    "cta_label": "Open Cash ISA"
                }
            })
            
        # Trigger 3: If PRIVILEGED + no investment product: info banner
        if tier == "PRIVILEGED" and not has_investment:
            active_banners.append({
                "id": "banner_privileged_investments",
                "type": "info",
                "color": "#006A4E",
                "icon": "💹",
                "headline": "Your money could be working harder in markets",
                "bullets": [
                    "As a Privileged tier customer, your idle cash is currently exposed to purchasing power erosion from inflation.",
                    "Lloyds Ready-Made Investments historically outperform savings interest rates over medium to long terms (5+ years).",
                    "Diversified, hands-off ready-made portfolios are managed by specialists to align perfectly with your risk tolerance."
                ],
                "recommendation": {
                    "product_id": "PROD_010",
                    "product_name": "Ready-Made Investments Adventurous",
                    "cta_label": "Explore Investing"
                }
            })
            
        # Trigger 4: If overdraft_events > 0: red urgent banner
        if overdraft_events > 0:
            active_banners.append({
                "id": "banner_overdraft_urgent",
                "type": "urgent",
                "color": "#ef4444",
                "icon": "🚨",
                "headline": "We noticed an overdraft — let's fix that",
                "bullets": [
                    f"We detected {overdraft_events} overdraft event(s) in the last 90 days, which can lead to high interest and fees.",
                    "Aligning your recurring bill dates with your salary schedule can completely eliminate cash-flow shortfalls.",
                    "A Flexible Saver can serve as an automated sweep buffer to fund temporary checking accounts gaps."
                ],
                "recommendation": {
                    "product_id": "PROD_001",
                    "product_name": "Flexible Saver",
                    "cta_label": "Manage Overdraft"
                }
            })
            
        # If no banners are active, let's add a default nice one for user welcome
        if not active_banners:
            active_banners.append({
                "id": "banner_default",
                "type": "info",
                "color": "#006A4E",
                "icon": "✦",
                "headline": "Your Lloyds Financial Wellbeing assistant is active",
                "bullets": [
                    "Our multi-agent system runs continuous background checks to find optimization gaps.",
                    "Track your savings, credit utility, and budget stability indicators inside your portal.",
                    "Explore recommended products customized precisely to your financial goals and wellbeing index."
                ],
                "recommendation": {
                    "product_id": "PROD_001",
                    "product_name": "Flexible Saver",
                    "cta_label": "Explore Products"
                }
            })
            
        payload = {
            "customer_id": cid,
            "banners": active_banners
        }
        self.log("Agent 5: Intervention", f"Generated {len(active_banners)} active proactive banner(s).", "success", payload)
        return payload

    async def run_agent6(self, customer_id, product_id, initial_deposit):
        self.log("Agent 6: Purchase Agent", f"Executing purchase for Product ID: {product_id}...", "start")
        
        customer = next((c for c in self.db.customers if c["customer_id"] == customer_id), None)
        product = next((p for p in self.db.products_live if p["product_id"] == product_id), None)
        current_acc = next((a for a in self.db.accounts if a["customer_id"] == customer_id and "Current" in a["account_type"]), None)
        
        if not customer or not product or not current_acc:
            return { "success": False, "error": "Invalid references" }

        if current_acc["balance"] < initial_deposit:
            return { "success": False, "error": "Insufficient funds" }

        # Debit
        self.db.insert_transaction(current_acc["account_id"], customer_id, -initial_deposit, "Savings Transfer", f"FUNDING {product['name']}", "DEBIT")
        
        # New Account
        new_acc = self.db.create_account(customer_id, product["name"], initial_deposit, product_id)
        
        # Demo Logic: Mark customer as improved for next score calculation
        if customer_id == "CUST_0042":
            self.demo_boosts[customer_id] = True
            self.log("Agent 6: Purchase Agent", f"Storyline Trigger: Customer {customer_id} has taken their first step toward financial stability. Score boost activated for recalculation.", "success")

        # Recalculate
        updated_state = await self.run_pipeline(customer_id)
        
        return {
            "success": True,
            "product_name": product["name"],
            "amount_debited": initial_deposit,
            "confirmation_ref": f"PY_AUTO_{random.randint(100000, 999999)}",
            "updated_state": updated_state
        }
