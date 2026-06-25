/**
 * Lloyds Financial Wellbeing AI - Application Controller
 * Connects BigQuery simulation, 6-Agent pipeline, and the UI layout.
 * Leverages Chart.js for spend trending and handles modals/state.
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Mock Database and Agent Pipeline
  const db = new BigQuerySimulation();
  const pipeline = new AgentPipeline(db);

  // Application Global State
  let currentCustomerId = "CUST_0042"; // Starts with Marcus (Normal, Red)
  let activePipelineResult = null;
  let activeBqTab = "customers";
  let spendChart = null;

  // Cache selectors
  const searchInput = document.getElementById("search-input");
  const filterPills = document.querySelectorAll(".filter-pill");
  const customerListContainer = document.getElementById("customer-list-container");
  const logFeedContainer = document.getElementById("log-feed");
  const bqTabs = document.querySelectorAll(".bq-tab-btn");
  const bqTableBody = document.getElementById("bq-table-body");
  const bqTableHeaders = document.getElementById("bq-table-headers");

  // Modals
  const purchaseModal = document.getElementById("purchase-modal");
  const successModal = document.getElementById("success-modal");

  // Register pipeline logger listener to output text dynamically to the screen!
  pipeline.registerLogListener((entry) => {
    renderConsoleEntry(entry);
  });

  // Init App
  initializeSidebar();
  loadCustomer(currentCustomerId);

  // --- CONTROLLER FUNCTIONS ---

  /**
   * Load and execute the agent pipeline for a customer
   */
  async function loadCustomer(customer_id) {
    currentCustomerId = customer_id;
    
    // Clear console panel in UI
    logFeedContainer.innerHTML = "";
    
    // Highlight selected customer card
    document.querySelectorAll(".customer-card").forEach(card => {
      if (card.dataset.id === customer_id) {
        card.classList.add("active");
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        card.classList.remove("active");
      }
    });

    // Run Agents 1-5 Pipeline
    const result = await pipeline.runPipeline(customer_id);
    activePipelineResult = result;

    if (result) {
      renderDashboard(result);
      renderBigQueryView();
      runProactiveMonitor(result);
    }
  }

  /**
   * Render Dashboard Panels
   */
  function renderDashboard({ profile, signals, report, recommendation, payload }) {
    // 1. Header Bar
    document.getElementById("cust-header-name").textContent = profile.name;
    document.getElementById("cust-header-age").textContent = `${profile.age} yrs | ${profile.life_stage}`;
    
    const tierBadge = document.getElementById("cust-header-tier");
    tierBadge.textContent = profile.tier;
    tierBadge.className = "cust-tier-badge " + (profile.tier === "PRIVILEGED" ? "tier-privileged" : "tier-normal");

    // Premier Eligibility Badge
    const premierPrompt = document.getElementById("premier-eligible-prompt");
    if (profile.premier_eligible) {
      premierPrompt.innerHTML = "✦ Lloyds Premier Eligible";
      premierPrompt.style.display = "inline-block";
    } else {
      premierPrompt.style.display = "none";
    }

    document.getElementById("header-val-balance").textContent = `£${profile.total_balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("header-val-income").textContent = `£${profile.income_annual.toLocaleString('en-GB', { maximumFractionDigits: 0 })}/yr`;
    document.getElementById("header-val-tenure").textContent = `${profile.tenure_years} yrs`;

    // 2. Proactive Banner Strip
    renderProactiveBanner(payload, recommendation.products[0]);

    // 3. Wellbeing Score radial gauge and indicators
    const card = document.getElementById("wellbeing-card");
    card.className = "dashboard-card wellbeing-report-card tier-" + report.tier.toLowerCase();

    // Radial Progress Calculation
    const progressCircle = document.getElementById("radial-progress-circle");
    const scoreNum = document.getElementById("score-number-display");
    const scoreTierLbl = document.getElementById("score-tier-label");
    const scoreDiagnosis = document.getElementById("score-diagnosis-summary");

    scoreNum.textContent = report.score;
    scoreTierLbl.textContent = report.tier;
    scoreDiagnosis.innerHTML = report.plain_english_summary;

    // SVG Circumference calculation (r = 50, C = 2 * PI * r = 314.15)
    const circumference = 314.159;
    const strokeDashoffset = circumference - (report.score / 100) * circumference;
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = strokeDashoffset;

    // Dimension progress bars
    const barsContainer = document.getElementById("dimensions-progress-bars");
    barsContainer.innerHTML = "";
    report.dimensions.forEach(dim => {
      const percentage = (dim.score / dim.max) * 100;
      barsContainer.innerHTML += `
        <div class="dimension-item">
          <div class="dimension-label-row">
            <span class="dim-lbl">${dim.label}</span>
            <span class="dim-score">${dim.score}/${dim.max}</span>
          </div>
          <div class="dimension-bar-bg">
            <div class="dimension-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    });

    // 4. Financial Signals Panel (Agent 2 signals)
    const signalsListContainer = document.getElementById("signals-list-container");
    signalsListContainer.innerHTML = "";
    const top3Signals = signals.behaviour_signals.slice(0, 3);
    
    if (top3Signals.length === 0) {
      signalsListContainer.innerHTML = `
        <div class="signal-card sig-low">
          <div class="signal-icon-box">✓</div>
          <div class="signal-details">
            <div class="signal-header-row">
              <span class="signal-title">All clear</span>
              <span class="signal-sev-pill sev-low">LOW</span>
            </div>
            <div class="signal-evidence">No immediate financial anomalies or alerts.</div>
          </div>
        </div>
      `;
    } else {
      top3Signals.forEach(sig => {
        const sevClass = "sig-" + sig.severity.toLowerCase();
        const pillClass = "sev-" + sig.severity.toLowerCase();
        let icon = "✓";
        if (sig.severity === "HIGH") icon = "⚠️";
        else if (sig.severity === "MEDIUM") icon = "✦";

        signalsListContainer.innerHTML += `
          <div class="signal-card ${sevClass}">
            <div class="signal-icon-box">${icon}</div>
            <div class="signal-details">
              <div class="signal-header-row">
                <span class="signal-title">${sig.signal}</span>
                <span class="signal-sev-pill ${pillClass}">${sig.severity}</span>
              </div>
              <div class="signal-evidence">${sig.evidence}</div>
            </div>
          </div>
        `;
      });
    }

    // 5. Product Recommendation Card
    const recShowcase = document.getElementById("product-recommendation-showcase");
    recShowcase.innerHTML = "";
    
    if (recommendation.products.length > 0) {
      recommendation.products.forEach(prod => {
        recShowcase.innerHTML += `
          <div class="recommendation-banner">
            <div class="rec-title-line">
              <span class="rec-badge">${prod.category.toUpperCase()}</span>
              <span class="rec-rate">${prod.interest_rate_aer || "Market Yield"}</span>
            </div>
            <div class="rec-name">${prod.name}</div>
            <div class="rec-benefit">${recommendation.rationale}</div>
            <div class="rec-footer">
              <a href="${prod.product_url}" target="_blank" class="rec-link">Product terms & conditions ↗</a>
              <button class="rec-btn" id="cta-buy-${prod.product_id}">Open Account</button>
            </div>
          </div>
        `;

        // Wire button events after inserting into DOM
        setTimeout(() => {
          const btn = document.getElementById(`cta-buy-${prod.product_id}`);
          if (btn) {
            btn.onclick = () => openPurchaseModal(prod);
          }
        }, 10);
      });
    } else {
      recShowcase.innerHTML = `
        <div class="recommendation-banner" style="border-color: var(--glass-border);">
          <div class="rec-name">Debt Consolidation Advice</div>
          <div class="rec-benefit">${recommendation.rationale}</div>
          <div class="rec-footer">
            <a href="https://www.lloydsbank.com/help-guidance/financial-difficulty.html" target="_blank" class="rec-link">Find Support Resources ↗</a>
            <button class="rec-btn" style="background: var(--color-amber);">Contact Support</button>
          </div>
        </div>
      `;
    }

    // 6. Draw Spends Trending Charts
    drawSpendTrendChart(profile, signals);
  }

  /**
   * Render Proactive Intervention Banners
   */
  function renderProactiveBanner(payload, primaryProduct) {
    const bannerContainer = document.getElementById("proactive-banner-container");
    bannerContainer.innerHTML = "";

    let severityClass = "info";
    let indicatorIcon = "✦";

    if (payload.score_card.tier === "RED") {
      severityClass = "urgent";
      indicatorIcon = "⚠️";
    } else if (payload.score_card.tier === "AMBER") {
      severityClass = "warning";
      indicatorIcon = "⚡";
    } else if (payload.score_card.tier === "GREEN") {
      severityClass = "success";
      indicatorIcon = "🎉";
    }

    const bannerHtml = `
      <div class="proactive-banner ${severityClass}" id="main-banner">
        <div class="banner-summary-row" id="banner-header">
          <span class="banner-indicator-icon">${indicatorIcon}</span>
          <div class="banner-meta-col">
            <div class="banner-headline">${payload.headline}</div>
            <div class="banner-snippet">${payload.snippet}</div>
          </div>
          <button class="banner-toggle-btn" id="banner-toggle-cta">See details</button>
        </div>
        
        <div class="banner-expanded-drawer" id="banner-details">
          <div class="drawer-inner">
            <ul class="insight-bullets-list">
              ${payload.bullets.map(b => `<li>${b}</li>`).join("")}
            </ul>
            
            ${payload.recommendation.product_id ? `
              <div class="banner-action-area">
                <div class="action-text">
                  <h4>Recommended Account: ${payload.recommendation.product_name}</h4>
                  <p>Target AER: ${payload.recommendation.rate}. Fully autonomous setup in 1-click.</p>
                </div>
                <button class="banner-cta-button" id="banner-cta-purchase">${payload.recommendation.cta_label}</button>
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    `;

    bannerContainer.innerHTML = bannerHtml;

    // Toggle logic for banner details
    const bannerHeader = document.getElementById("banner-header");
    const bannerToggleCta = document.getElementById("banner-toggle-cta");
    const bannerDetails = document.getElementById("banner-details");
    
    function toggleDrawer() {
      const isExpanded = bannerDetails.classList.toggle("expanded");
      bannerToggleCta.textContent = isExpanded ? "Collapse" : "See details";
    }

    bannerHeader.onclick = toggleDrawer;

    // Bind purchase CTA
    if (payload.recommendation.product_id && primaryProduct) {
      document.getElementById("banner-cta-purchase").onclick = (e) => {
        e.stopPropagation();
        openPurchaseModal(primaryProduct);
      };
    }
  }

  /**
   * Run Proactive Monitor Triggers (Background checks on customer load)
   */
  function runProactiveMonitor({ profile, signals, report }) {
    pipeline.log("Proactive Monitor", "Running event-driven background analysis engines...", "start");

    // Trigger 1: Savings balance decay
    if (signals.savings_delta_mom < -10) {
      pipeline.log("Proactive Monitor", `TRIGGER FIRED: savings_delta_mom < -10% (${signals.savings_delta_mom.toFixed(1)}%). Urgent warning prepared.`, "error");
    }

    // Trigger 2: Overdraft occurrences
    if (signals.overdraft_events_count > 1) {
      pipeline.log("Proactive Monitor", `TRIGGER FIRED: overdraft_events_count > 1 in last 90 days. Proactive debt clearance banners updated.`, "error");
    }

    // Trigger 4: Unused ISA + Green Wellbeing + Tax Year end approaching
    const hasUnusedIsa = !profile.existing_products.some(p => p.includes("ISA")) && report.tier === "GREEN";
    if (hasUnusedIsa) {
      pipeline.log("Proactive Monitor", `TRIGGER FIRED: Unused ISA allowances detected. Yield optimized ISA wrapper recommendations prepared.`, "success");
    }

    // Trigger 5: Privileged + No Investments sitting on cash
    const isUnderinvested = profile.tier === "PRIVILEGED" && !profile.existing_products.some(p => p.includes("Investments"));
    if (isUnderinvested) {
      pipeline.log("Proactive Monitor", "TRIGGER FIRED: Privileged Client with high checking liquid capital and zero index portfolio holdings. High-growth capital market banners prepared.", "success");
    }
  }

  /**
   * Draw Category stacked bar chart with overlay line savings path (Chart.js)
   */
  function drawSpendTrendChart(profile, signals) {
    if (spendChart) {
      spendChart.destroy();
    }

    const ctx = document.getElementById("spend-trend-canvas").getContext("2d");

    // Generate last 6 months labels
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    
    // Simulate realistic historical aggregates backing the chart
    const groceriesData = [180, 160, 200, 150, 190, 170].map(v => v * (profile.avg_monthly_income / 3500));
    const billsData = [800, 800, 800, 800, 800, 800].map(v => v * (profile.avg_monthly_income / 3500));
    const shoppingData = [250, 310, 190, 420, 280, 230].map(v => v * (profile.avg_monthly_income / 3500));
    const diningData = [150, 180, 220, 140, 200, 160].map(v => v * (profile.avg_monthly_income / 3500));
    const leisureData = [200, 120, 300, 250, 180, 290].map(v => v * (profile.avg_monthly_income / 3500));

    // Savings trend lines (Marcus Standard Saver at £0 decaying, Victoria Advantage Saver increasing)
    let savingsTrend = [1000, 800, 500, 300, 100, 0];
    if (profile.customer_id === "CUST_0099") {
      savingsTrend = [35000, 37000, 39000, 41000, 43000, 45000];
    } else if (profile.customer_id === "CUST_0150") {
      savingsTrend = [4500, 3800, 2900, 1800, 800, 150];
    } else {
      // Semi-random deterministic trend
      const savingsAcc = profile.accounts.find(a => a.account_type.includes("Saver"));
      const baseBal = savingsAcc ? savingsAcc.balance : 500;
      savingsTrend = [0.8, 0.85, 0.92, 0.95, 0.98, 1.0].map(mult => baseBal * mult);
    }

    spendChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          { label: "Bills", data: billsData, backgroundColor: "#1e3a34", stack: "Stack 0" },
          { label: "Groceries", data: groceriesData, backgroundColor: "#006A4E", stack: "Stack 0" },
          { label: "Shopping", data: shoppingData, backgroundColor: "#319795", stack: "Stack 0" },
          { label: "Dining", data: diningData, backgroundColor: "#4a5568", stack: "Stack 0" },
          { label: "Leisure", data: leisureData, backgroundColor: "#4299e1", stack: "Stack 0" },
          {
            label: "Savings Cushion (Axis R)",
            data: savingsTrend,
            type: "line",
            borderColor: "#00E68C",
            borderWidth: 3,
            fill: false,
            yAxisID: "y-savings",
            tension: 0.3,
            pointBackgroundColor: "#00E68C",
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#8A9A96", font: { family: "Inter", size: 10 } },
            position: "top"
          },
          tooltip: {
            mode: "index",
            intersect: false
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#8A9A96" },
            grid: { color: "rgba(255,255,255,0.03)" }
          },
          y: {
            stacked: true,
            ticks: { color: "#8A9A96", callback: (val) => `£${val}` },
            grid: { color: "rgba(255,255,255,0.03)" },
            title: { display: true, text: "Monthly Outgoings", color: "#8A9A96" }
          },
          "y-savings": {
            type: "linear",
            position: "right",
            ticks: { color: "#00E68C", callback: (val) => `£${val}` },
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Savings Balance", color: "#00E68C" }
          }
        }
      }
    });
  }

  /**
   * Sidebar search and list rendering
   */
  function initializeSidebar() {
    // Generate side customer entries
    renderCustomerList();

    // Bind search
    searchInput.oninput = () => {
      renderCustomerList();
    };

    // Filter pills
    filterPills.forEach(pill => {
      pill.onclick = () => {
        filterPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        renderCustomerList();
      };
    });
  }

  function renderCustomerList() {
    customerListContainer.innerHTML = "";
    const filterVal = document.querySelector(".filter-pill.active").dataset.filter;
    const query = searchInput.value.toLowerCase().trim();

    // Filter database
    const filtered = db.customers.filter(cust => {
      // Name/ID search filter
      const matchesSearch = cust.name.toLowerCase().includes(query) || cust.customer_id.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      // Pill filter
      if (filterVal === "all") return true;
      if (filterVal === "normal") return cust.tier === "NORMAL";
      if (filterVal === "privileged") return cust.tier === "PRIVILEGED";
      return true;
    });

    filtered.forEach(cust => {
      const accounts = db.accounts.filter(a => a.customer_id === cust.customer_id);
      const savingsAcc = accounts.find(a => a.account_type.includes("Saver"));
      const balance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

      const card = document.createElement("div");
      card.className = "customer-card";
      card.dataset.id = cust.customer_id;
      if (cust.customer_id === currentCustomerId) card.classList.add("active");

      // Highlight logic
      let displayName = cust.name;
      if (query.length > 0) {
        const index = displayName.toLowerCase().indexOf(query);
        if (index >= 0) {
          displayName = displayName.substring(0, index) + 
            `<mark style="background: var(--neon-green); color: var(--bg-primary); border-radius: 2px; padding: 0 2px;">${displayName.substring(index, index + query.length)}</mark>` + 
            displayName.substring(index + query.length);
        }
      }

      card.innerHTML = `
        <div class="cust-name">${displayName}</div>
        <div class="cust-meta">
          <span>${cust.customer_id} | Age ${cust.age}</span>
          <span class="cust-tier-badge ${cust.tier === "PRIVILEGED" ? "tier-privileged" : "tier-normal"}">${cust.tier}</span>
        </div>
      `;

      card.onclick = () => {
        loadCustomer(cust.customer_id);
      };

      customerListContainer.appendChild(card);
    });
  }

  /**
   * Interactive Agent Handoff Terminal Output Logger
   */
  function renderConsoleEntry(entry) {
    const cardEl = document.createElement("div");
    cardEl.className = `console-entry ${entry.type}`;
    
    cardEl.innerHTML = `
      <div class="console-header">
        <span>${entry.agent}</span>
        <span class="console-time">${entry.timestamp}</span>
      </div>
      <div class="console-text">${entry.message}</div>
    `;

    if (entry.data) {
      const bqInspectLink = document.createElement("a");
      bqInspectLink.className = "console-meta-btn";
      bqInspectLink.textContent = "Inspect agent state payload →";
      bqInspectLink.onclick = () => {
        alert(`AGENT STATE OBJECT INSPECTOR:\n\n${JSON.stringify(entry.data, null, 2)}`);
      };
      cardEl.appendChild(bqInspectLink);
    }

    logFeedContainer.appendChild(cardEl);
    logFeedContainer.scrollTop = logFeedContainer.scrollHeight;
  }

  /**
   * Render Interactive BigQuery Spreadsheet simulation
   */
  function renderBigQueryView() {
    bqTableHeaders.innerHTML = "";
    bqTableBody.innerHTML = "";

    const headers = {
      customers: ["customer_id", "name", "age", "life_stage", "tenure_years", "income_annual", "income_band", "premier_flag", "tier"],
      accounts: ["account_id", "customer_id", "account_type", "balance", "opened_date", "credit_limit", "product_id"],
      transactions: ["txn_id", "account_id", "customer_id", "date", "amount", "category", "merchant", "type", "is_direct_debit"],
      products_live: ["product_id", "name", "category", "interest_rate_aer", "min_deposit", "monthly_min", "term_months", "eligibility_tier", "fees"],
      banners: ["banner_id", "customer_id", "trigger_type", "severity", "headline", "snippet"]
    };

    const activeHeaders = headers[activeBqTab];
    activeHeaders.forEach(h => {
      bqTableHeaders.innerHTML += `<th>${h}</th>`;
    });

    let data = [];
    if (activeBqTab === "customers") {
      data = db.customers;
    } else if (activeBqTab === "accounts") {
      data = db.accounts;
    } else if (activeBqTab === "transactions") {
      data = db.getTransactionsForCustomer(currentCustomerId);
    } else if (activeBqTab === "products_live") {
      data = db.products_live;
    } else if (activeBqTab === "banners") {
      // Synthesize active banners triggered in simulation
      data = [
        { banner_id: "B_01", customer_id: currentCustomerId, trigger_type: "savings_decay", severity: "urgent", headline: activePipelineResult?.payload.headline, snippet: activePipelineResult?.payload.snippet }
      ];
    }

    data.slice(0, 15).forEach(row => {
      let rowHtml = "<tr>";
      activeHeaders.forEach(col => {
        let val = row[col];
        if (val === null || val === undefined) val = "NULL";
        else if (typeof val === "number" && (col.includes("balance") || col.includes("amount") || col.includes("income_annual"))) {
          val = `£${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (typeof val === "boolean") {
          val = val ? "TRUE" : "FALSE";
        }
        rowHtml += `<td>${val}</td>`;
      });
      rowHtml += "</tr>";
      bqTableBody.innerHTML += rowHtml;
    });
  }

  bqTabs.forEach(tab => {
    tab.onclick = () => {
      bqTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeBqTab = tab.dataset.table;
      renderBigQueryView();
    };
  });

  /**
   * Autonomous Purchase Modal & Process
   */
  function openPurchaseModal(product) {
    purchaseModal.classList.add("active");

    const currentAccount = db.accounts.find(a => a.customer_id === currentCustomerId && a.account_type.includes("Current"));
    const balanceAvailable = currentAccount ? currentAccount.balance : 0;

    document.getElementById("p-modal-title").textContent = `Open Lloyds ${product.name}`;
    document.getElementById("p-modal-rate").textContent = product.interest_rate_aer;
    document.getElementById("p-modal-fees").textContent = product.fees;
    document.getElementById("p-modal-source").textContent = `${currentAccount ? currentAccount.account_type : "Classic Current Account"} (Bal: £${balanceAvailable.toLocaleString('en-GB', { minimumFractionDigits: 2 })})`;

    // Setup Initial Deposit Slider
    const depositSlider = document.getElementById("p-modal-slider");
    const depositInput = document.getElementById("p-modal-input");
    
    const minDeposit = product.min_deposit || 25;
    const maxVal = Math.min(balanceAvailable, product.category === "Savings" && product.name.includes("Monthly") ? 400 : 5000);
    
    // Safety guardrail for slider mins
    depositSlider.min = minDeposit;
    depositSlider.max = Math.max(minDeposit, maxVal);
    depositSlider.value = minDeposit;
    depositInput.value = minDeposit;

    depositSlider.oninput = () => {
      depositInput.value = depositSlider.value;
    };

    depositInput.onchange = () => {
      let val = parseFloat(depositInput.value) || minDeposit;
      if (val < minDeposit) val = minDeposit;
      if (val > maxVal) val = maxVal;
      depositInput.value = val;
      depositSlider.value = val;
    };

    // Close button
    document.getElementById("p-modal-close").onclick = closePurchaseModal;
    document.getElementById("p-modal-cancel").onclick = closePurchaseModal;

    // Confirm button (Triggers Agent 6)
    document.getElementById("p-modal-confirm").onclick = async () => {
      const depositAmount = parseFloat(depositInput.value);
      closePurchaseModal();

      // Trigger Purchase Agent (Agent 6)
      const confirmation = await pipeline.runAgent6(currentCustomerId, product.product_id, depositAmount);
      
      if (confirmation.success) {
        showSuccessModal(confirmation);
      } else {
        alert(`Purchase Error: ${confirmation.error}`);
      }
    };
  }

  function closePurchaseModal() {
    purchaseModal.classList.remove("active");
  }

  function showSuccessModal(confirmation) {
    successModal.classList.add("active");
    
    document.getElementById("success-modal-product").textContent = confirmation.product_name;
    document.getElementById("success-modal-debited").textContent = `£${confirmation.amount_debited.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
    document.getElementById("success-modal-ref").textContent = confirmation.confirmation_ref;
    document.getElementById("success-modal-body").textContent = confirmation.next_steps;

    document.getElementById("success-modal-btn").onclick = () => {
      successModal.classList.remove("active");
      
      // Force reload the newly updated customer state
      renderDashboard(confirmation.updatedState);
      renderBigQueryView();
    };
  }
});
