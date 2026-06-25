/**
 * Lloyds Financial Wellbeing AI - Application Controller
 * Manages the SPA View Router, Admin Terminal, and Customer Personal Portal.
 * Handles Chart.js visualization, collapsible sidebars, sliding drawers, and Agent 6 purchase integrations.
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize synthetic database and 6-Agent pipeline
  const db = new BigQuerySimulation();
  const pipeline = new AgentPipeline(db);

  // Global State
  let currentCustomerId = "CUST_0042"; // Defaults to Marcus Sterling
  let activePipelineResult = null;
  let adminCharts = { tiers: null, wellbeing: null, lifestages: null };
  let customerSpendChart = null;

  // View elements
  const views = {
    landing: document.getElementById("view-landing"),
    admin: document.getElementById("view-admin"),
    customerLogin: document.getElementById("view-customer-login"),
    customerDashboard: document.getElementById("view-customer-dashboard")
  };

  // Selectors Cache
  const logFeedContainer = document.getElementById("log-feed");
  const agentLogsSheet = document.getElementById("agent-logs-sheet");
  const btnToggleAgentLogs = document.getElementById("btn-toggle-agent-logs");
  const btnCloseLogsSheet = document.getElementById("btn-close-logs-sheet");

  // Modals
  const purchaseModal = document.getElementById("purchase-modal");
  const successModal = document.getElementById("success-modal");

  // Register pipeline logger listener to output text dynamically to the screen!
  pipeline.registerLogListener((entry) => {
    renderConsoleEntry(entry);
  });

  // --- SPA VIEW ROUTER ---
  function showView(viewName) {
    Object.keys(views).forEach(key => {
      if (key === viewName) {
        views[key].classList.add("active");
      } else {
        views[key].classList.remove("active");
      }
    });

    // Automatically toggle floating log sheet visibility/collapsed based on view
    if (viewName === "landing" || viewName === "customerLogin") {
      btnToggleAgentLogs.style.display = "none";
      agentLogsSheet.classList.remove("active");
    } else {
      btnToggleAgentLogs.style.display = "flex";
    }
  }

  // Initial routing triggers
  document.getElementById("btn-enter-admin").onclick = () => {
    showView("admin");
    initAdminDashboard();
  };

  document.getElementById("btn-enter-customer").onclick = () => {
    showView("customerLogin");
  };

  document.getElementById("btn-admin-back-hub").onclick = () => {
    destroyAdminCharts();
    showView("landing");
  };

  document.getElementById("btn-login-back-hub").onclick = () => {
    showView("landing");
  };

  // Demo Login Quick-Select Helper
  const loginDemoSelector = document.getElementById("login-demo-selector");
  const loginCustIdInput = document.getElementById("login-cust-id");
  
  if (loginDemoSelector && loginCustIdInput) {
    loginDemoSelector.onchange = () => {
      loginCustIdInput.value = loginDemoSelector.value;
    };
  }

  // Login Submit handler
  document.getElementById("customer-login-form").onsubmit = (e) => {
    e.preventDefault();
    const custId = loginCustIdInput.value.trim().toUpperCase();
    const customer = db.customers.find(c => c.customer_id === custId);

    if (!customer) {
      alert("Authentication Error: Customer ID not found. Please try CUST_0042, CUST_0099, or CUST_0150.");
      return;
    }

    // Login successful
    showView("customerDashboard");
    initCustomerDashboard(custId);
  };

  // --- FLOATING ORCHESTRATOR LOGS SHEET PANEL ---
  btnToggleAgentLogs.onclick = () => {
    agentLogsSheet.classList.add("active");
  };

  btnCloseLogsSheet.onclick = () => {
    agentLogsSheet.classList.remove("active");
  };

  function renderConsoleEntry(entry) {
    const cardEl = document.createElement("div");
    cardEl.className = `console-entry ${entry.type}`;
    
    // Set appropriate colors depending on severity logs
    let badgeColor = "var(--color-text-muted)";
    if (entry.type === "start") badgeColor = "var(--color-amber)";
    else if (entry.type === "success") badgeColor = "var(--neon-green)";
    else if (entry.type === "error") badgeColor = "var(--color-red)";

    cardEl.innerHTML = `
      <div class="console-header" style="display: flex; justify-content: space-between; font-size: 0.72rem; color: ${badgeColor}; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px; margin-bottom: 4px;">
        <span style="font-weight: bold;">${entry.agent}</span>
        <span>${entry.timestamp}</span>
      </div>
      <div class="console-text" style="color: var(--color-text-main); line-height: 1.4;">${entry.message}</div>
    `;

    if (entry.data) {
      const inspectBtn = document.createElement("a");
      inspectBtn.style.cssText = "display: inline-block; font-size: 0.7rem; color: var(--neon-green); text-decoration: underline; margin-top: 4px; cursor: pointer;";
      inspectBtn.textContent = "Inspect state payload →";
      inspectBtn.onclick = () => {
        alert(`AGENT STATE PAYLOAD INSPECT:\n\n${JSON.stringify(entry.data, null, 2)}`);
      };
      cardEl.appendChild(inspectBtn);
    }

    logFeedContainer.appendChild(cardEl);
    logFeedContainer.scrollTop = logFeedContainer.scrollHeight;
    
    // Automatically slide drawer open so user notices background agents actively running
    if (!agentLogsSheet.classList.contains("active")) {
      agentLogsSheet.classList.add("active");
    }
  }


  // --- ADMIN TERMINAL PORTAL LOGIC ---

  /**
   * Fast wellbeing score estimator for aggregating stats on 505 customers without pipeline blocking.
   */
  function getDeterministicScore(cust, accounts) {
    if (cust.customer_id === "CUST_0042") return { score: 41, tier: "RED" };
    if (cust.customer_id === "CUST_0099") return { score: 84, tier: "GREEN" };
    if (cust.customer_id === "CUST_0150") return { score: 35, tier: "RED" };

    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const savingsAccount = accounts.find(a => a.account_type.includes("Saver") || a.account_type.includes("ISA"));
    const savingsBalance = savingsAccount ? savingsAccount.balance : 0;

    let score = 55; // default baseline

    if (savingsBalance > 10000) score += 25;
    else if (savingsBalance > 3000) score += 15;
    else if (savingsBalance > 500) score += 5;
    else score -= 10;

    const wealthRatio = totalBalance / (cust.income_annual || 30000);
    if (wealthRatio > 0.4) score += 15;
    else if (wealthRatio > 0.15) score += 8;
    else score -= 5;

    if (cust.age > 45) score += 5;

    score = Math.max(12, Math.min(96, score));

    let tier = "AMBER";
    if (score >= 80) tier = "GREEN";
    else if (score >= 50) tier = "AMBER";
    else tier = "RED";

    return { score, tier };
  }

  function initAdminDashboard() {
    destroyAdminCharts();

    // 1. Compute counters and metrics
    const totalCustomers = db.customers.length;
    const totalAUM = db.accounts.reduce((sum, a) => sum + a.balance, 0);

    let totalScore = 0;
    let greenCount = 0;
    let amberCount = 0;
    let redCount = 0;
    let normalCount = 0;
    let privilegedCount = 0;

    // Assets by Life stage map
    const lifestagesWorth = {};
    const lifestagesCount = {};

    db.customers.forEach(cust => {
      const accounts = db.accounts.filter(a => a.customer_id === cust.customer_id);
      const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

      const { score, tier } = getDeterministicScore(cust, accounts);
      totalScore += score;

      if (tier === "GREEN") greenCount++;
      else if (tier === "AMBER") amberCount++;
      else redCount++;

      if (cust.tier === "PRIVILEGED") privilegedCount++;
      else normalCount++;

      // life stage accumulation
      const stage = cust.life_stage;
      if (!lifestagesWorth[stage]) {
        lifestagesWorth[stage] = 0;
        lifestagesCount[stage] = 0;
      }
      lifestagesWorth[stage] += totalBalance;
      lifestagesCount[stage]++;
    });

    const avgScore = totalScore / totalCustomers;
    const privilegedPercent = (privilegedCount / totalCustomers) * 100;

    // Populate Counters
    document.getElementById("admin-count-cust").textContent = totalCustomers;
    document.getElementById("admin-count-aum").textContent = `£${totalAUM.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("admin-count-score").textContent = `${avgScore.toFixed(1)} / 100`;
    document.getElementById("admin-count-privileged").textContent = `${privilegedPercent.toFixed(1)}%`;

    // 2. Render demographic summary charts
    const tiersCtx = document.getElementById("admin-chart-tiers").getContext("2d");
    adminCharts.tiers = new Chart(tiersCtx, {
      type: "doughnut",
      data: {
        labels: ["Normal Clients", "Privileged Clients"],
        datasets: [{
          data: [normalCount, privilegedCount],
          backgroundColor: ["#006A4E", "#8A2BE2"],
          borderColor: "rgba(10,17,15,0.8)",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#8A9A96", font: { family: "Inter", size: 11 } }, position: "bottom" }
        }
      }
    });

    const wellbeingCtx = document.getElementById("admin-chart-wellbeing").getContext("2d");
    adminCharts.wellbeing = new Chart(wellbeingCtx, {
      type: "pie",
      data: {
        labels: ["Secure (Green)", "Stressed (Amber)", "Vulnerable (Red)"],
        datasets: [{
          data: [greenCount, amberCount, redCount],
          backgroundColor: ["#00E68C", "#FFB000", "#FF4D4D"],
          borderColor: "rgba(10,17,15,0.8)",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#8A9A96", font: { family: "Inter", size: 11 } }, position: "bottom" }
        }
      }
    });

    const stagesLabels = Object.keys(lifestagesWorth);
    const avgAssetsData = stagesLabels.map(stage => lifestagesWorth[stage] / lifestagesCount[stage]);

    const lifestagesCtx = document.getElementById("admin-chart-lifestages").getContext("2d");
    adminCharts.lifestages = new Chart(lifestagesCtx, {
      type: "bar",
      data: {
        labels: stagesLabels,
        datasets: [{
          label: "Avg Assets (£)",
          data: avgAssetsData,
          backgroundColor: "rgba(0, 230, 140, 0.25)",
          borderColor: "#00E68C",
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: "#8A9A96", font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: "#8A9A96", callback: (v) => `£${valShort(v)}` }, grid: { color: "rgba(255,255,255,0.03)" } }
        }
      }
    });

    function valShort(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
      return num;
    }

    // Initialize Directory Table Rendering
    renderAdminDirectory();

    // Bind Table live-filtering and searching controllers
    const adminSearchInput = document.getElementById("admin-search-input");
    adminSearchInput.oninput = () => renderAdminDirectory();

    document.querySelectorAll("[data-admin-filter]").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll("[data-admin-filter]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderAdminDirectory();
      };
    });
  }

  function destroyAdminCharts() {
    if (adminCharts.tiers) { adminCharts.tiers.destroy(); adminCharts.tiers = null; }
    if (adminCharts.wellbeing) { adminCharts.wellbeing.destroy(); adminCharts.wellbeing = null; }
    if (adminCharts.lifestages) { adminCharts.lifestages.destroy(); adminCharts.lifestages = null; }
  }

  function renderAdminDirectory() {
    const tableBody = document.getElementById("admin-directory-body");
    tableBody.innerHTML = "";

    const activeFilter = document.querySelector("[data-admin-filter].active").dataset.admin-filter;
    const query = document.getElementById("admin-search-input").value.toLowerCase().trim();

    // Filter list
    const filtered = db.customers.filter(cust => {
      const matchesSearch = cust.name.toLowerCase().includes(query) || cust.customer_id.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      if (activeFilter === "all") return true;
      if (activeFilter === "normal") return cust.tier === "NORMAL";
      if (activeFilter === "privileged") return cust.tier === "PRIVILEGED";
      return true;
    });

    // Render rows (limiting to top 150 for snappy rendering in DOM)
    const limit = query.length > 0 ? filtered.length : 15;
    filtered.slice(0, limit).forEach(cust => {
      const accounts = db.accounts.filter(a => a.customer_id === cust.customer_id);
      const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

      let displayName = cust.name;
      if (query.length > 0) {
        const idx = displayName.toLowerCase().indexOf(query);
        if (idx >= 0) {
          displayName = displayName.substring(0, idx) + 
            `<mark style="background: var(--neon-green); color: var(--bg-primary); border-radius: 2px; padding: 0 2px;">${displayName.substring(idx, idx + query.length)}</mark>` + 
            displayName.substring(idx + query.length);
        }
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-family: monospace; font-weight: bold; color: var(--neon-green);">${cust.customer_id}</td>
        <td>${displayName}</td>
        <td>${cust.age}</td>
        <td>${cust.life_stage}</td>
        <td>£${cust.income_annual.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
        <td>
          <span class="cust-tier-badge ${cust.tier === 'PRIVILEGED' ? 'tier-privileged' : 'tier-normal'}">${cust.tier}</span>
        </td>
        <td style="font-weight: 600;">£${totalBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>
          <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">View Profile</button>
        </td>
      `;

      row.onclick = () => openAdminDrawer(cust.customer_id);
      tableBody.appendChild(row);
    });
  }


  // --- ADMIN SLIDING DETAILS DRAWER CONTROLLER ---

  const adminDetailDrawer = document.getElementById("admin-detail-drawer");
  const btnCloseAdminDrawer = document.getElementById("btn-close-admin-drawer");
  const drawerTabBtns = document.querySelectorAll(".drawer-tab-btn");
  const drawerTabPanels = document.querySelectorAll(".drawer-tab-panel");

  // Wire tab switches inside drawer
  drawerTabBtns.forEach(btn => {
    btn.onclick = () => {
      drawerTabBtns.forEach(b => b.classList.remove("active"));
      drawerTabPanels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = document.getElementById(`drawer-tab-${btn.dataset.drawerTab}`);
      if (targetPanel) targetPanel.classList.add("active");
    };
  });

  btnCloseAdminDrawer.onclick = () => {
    adminDetailDrawer.classList.remove("active");
  };

  async function openAdminDrawer(customerId) {
    currentCustomerId = customerId;
    adminDetailDrawer.classList.add("active");

    // Clear previous drawer states, set loading
    document.getElementById("drawer-cust-name").textContent = "Loading...";
    document.getElementById("drawer-cust-id").textContent = customerId;
    document.getElementById("drawer-avatar").textContent = "...";
    document.getElementById("drawer-score-diagnosis").textContent = "Executing 6-Agent pipeline to perform real-time audit...";

    // Select default profile tab inside drawer
    drawerTabBtns.forEach(b => b.classList.remove("active"));
    drawerTabPanels.forEach(p => p.classList.remove("active"));
    drawerTabBtns[0].classList.add("active");
    drawerTabPanels[0].classList.add("active");

    // Clear background logs sheet to let user see clean sequential agent diagnostics
    logFeedContainer.innerHTML = "";

    // Execute sequential diagnostics
    const result = await pipeline.runPipeline(customerId);
    if (!result) return;

    // Populate drawer UI
    const profile = result.profile;
    const report = result.report;
    const signals = result.signals;
    const recommendation = result.recommendation;
    const payload = result.payload;

    document.getElementById("drawer-cust-name").textContent = profile.name;
    document.getElementById("drawer-avatar").textContent = profile.name.charAt(0);

    // Radial Gauge
    const radialProgress = document.getElementById("drawer-radial-progress");
    const scoreNum = document.getElementById("drawer-score-num");
    const scoreTier = document.getElementById("drawer-score-tier");
    
    scoreNum.textContent = report.score;
    scoreTier.textContent = report.tier;
    
    let strokeColor = "var(--neon-green)";
    if (report.tier === "RED") strokeColor = "var(--color-red)";
    else if (report.tier === "AMBER") strokeColor = "var(--color-amber)";
    radialProgress.style.stroke = strokeColor;

    const circumference = 314.159;
    const strokeDashoffset = circumference - (report.score / 100) * circumference;
    radialProgress.style.strokeDasharray = `${circumference} ${circumference}`;
    radialProgress.style.strokeDashoffset = strokeDashoffset;

    document.getElementById("drawer-score-diagnosis").innerHTML = report.plain_english_summary;

    // Dimensions progress bars
    const scoreDimensions = document.getElementById("drawer-score-dimensions");
    scoreDimensions.innerHTML = "";
    report.dimensions.forEach(dim => {
      const percentage = (dim.score / dim.max) * 100;
      scoreDimensions.innerHTML += `
        <div class="dimension-item" style="margin-bottom: 12px;">
          <div class="dimension-label-row" style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
            <span style="color: var(--color-text-main); font-weight: 500;">${dim.label}</span>
            <span style="color: var(--color-text-muted); font-weight: bold;">${dim.score}/${dim.max}</span>
          </div>
          <div class="dimension-bar-bg" style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow: hidden; border: 1px solid rgba(255,255,255,0.02);">
            <div class="dimension-bar-fill" style="width: ${percentage}%; background: ${strokeColor}; height: 100%; border-radius: 3px;"></div>
          </div>
        </div>
      `;
    });

    // Vulnerabilities/Risks list
    const risksList = document.getElementById("drawer-risks-list");
    risksList.innerHTML = "";
    if (report.top_3_risks.length === 0) {
      risksList.innerHTML = `<li style="color: var(--neon-green); font-size: 0.82rem;">✓ Shield indicators are completely secure. No active vulnerabilities.</li>`;
    } else {
      report.top_3_risks.forEach(risk => {
        risksList.innerHTML += `<li>${risk}</li>`;
      });
    }

    // Accounts Grid rendering
    const accountsList = document.getElementById("drawer-accounts-list");
    accountsList.innerHTML = "";
    profile.accounts.forEach(acc => {
      accountsList.innerHTML += `
        <div class="mini-acc-card">
          <div class="mini-acc-type">${acc.account_type}</div>
          <div class="mini-acc-bal">£${acc.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `;
    });

    // Transactions list
    const transactionsList = document.getElementById("drawer-transactions-list");
    transactionsList.innerHTML = "";
    const txns = db.getTransactionsForCustomer(customerId);
    txns.sort((a,b) => new Date(b.date) - new Date(a.date));

    txns.slice(0, 10).forEach(txn => {
      const amtColor = txn.amount > 0 ? "var(--neon-green)" : "var(--color-text-main)";
      transactionsList.innerHTML += `
        <tr>
          <td>${txn.date.substring(5)}</td>
          <td style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${txn.merchant}</td>
          <td>${txn.category}</td>
          <td style="color: ${amtColor}; font-weight: bold; text-align: right;">£${Math.abs(txn.amount).toFixed(0)}</td>
        </tr>
      `;
    });

    // Proactive Banner Preview
    const bannerPreview = document.getElementById("drawer-banner-preview");
    let sevColor = "var(--neon-green)";
    if (payload.score_card.tier === "RED") sevColor = "var(--color-red)";
    else if (payload.score_card.tier === "AMBER") sevColor = "var(--color-amber)";

    bannerPreview.innerHTML = `
      <div class="proactive-banner" style="border: 1px solid ${sevColor}; padding: 15px; border-radius: 12px; background: rgba(10,17,15,0.4);">
        <h4 style="color: var(--color-white); font-family: var(--font-display); font-size: 0.9rem; margin-bottom: 4px;">${payload.headline}</h4>
        <p style="color: var(--color-text-muted); font-size: 0.78rem; margin-bottom: 8px;">${payload.snippet}</p>
        <ul style="padding-left: 15px; font-size: 0.75rem; color: var(--color-text-main); display: flex; flex-direction: column; gap: 4px;">
          ${payload.bullets.map(b => `<li>${b}</li>`).join("")}
        </ul>
      </div>
    `;

    // Agent simulation triggers
    const primaryProduct = recommendation.products[0];
    const simRate = document.getElementById("drawer-sim-rate");
    const simFees = document.getElementById("drawer-sim-fees");
    const runPipelineBtn = document.getElementById("drawer-sim-run-pipeline");

    if (primaryProduct) {
      simRate.textContent = primaryProduct.interest_rate_aer;
      simFees.textContent = primaryProduct.fees;
      runPipelineBtn.textContent = "Run Diagnostics Pipeline";
      runPipelineBtn.disabled = false;
      runPipelineBtn.onclick = () => openAdminDrawer(customerId);
    } else {
      simRate.textContent = "N/A";
      simFees.textContent = "Debt support offered";
      runPipelineBtn.textContent = "Contact Debt Support simulated";
      runPipelineBtn.onclick = () => alert("Simulating debt support handoff...");
    }
  }


  // --- CUSTOMER DASHBOARD TERMINAL LOGIC ---

  const customerPortalSidebar = document.getElementById("customer-portal-sidebar");
  const btnSidebarHamburger = document.getElementById("btn-sidebar-hamburger");
  const customerViewportContainer = document.getElementById("customer-viewport-container");
  const navTiles = document.querySelectorAll(".nav-tile");
  const viewportPanels = document.querySelectorAll(".viewport-panel");

  // Toggle collapsing hamburger side menu
  btnSidebarHamburger.onclick = () => {
    customerPortalSidebar.classList.toggle("sidebar-collapsed");
  };

  // Wire tile button switches
  navTiles.forEach(tile => {
    if (tile.id === "btn-customer-signout") return; // Skip sign out btn
    
    tile.onclick = () => {
      navTiles.forEach(t => t.classList.remove("active"));
      viewportPanels.forEach(p => p.classList.remove("active"));

      tile.classList.add("active");
      const targetPanel = document.getElementById(`panel-${tile.dataset.custTile}`);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }

      // Re-draw or adjust Spend Chart when tab clicked
      if (tile.dataset.custTile === "trends" && activePipelineResult) {
        setTimeout(() => {
          drawSpendTrendChart(activePipelineResult.profile, activePipelineResult.signals);
        }, 100);
      }
    };
  });

  // Secure customer Sign Out logic
  document.getElementById("btn-customer-signout").onclick = () => {
    if (confirm("Confirm secure sign-out of Lloyds Personal Portal?")) {
      if (customerSpendChart) { customerSpendChart.destroy(); customerSpendChart = null; }
      activePipelineResult = null;
      showView("landing");
    }
  };

  async function initCustomerDashboard(customerId) {
    currentCustomerId = customerId;
    
    // Clear logs panel in UI
    logFeedContainer.innerHTML = "";

    pipeline.log("Orchestrator", `Securely verifying user credentials for client index: ${customerId}...`, "start");

    // Execute Agent Pipeline sequence
    const result = await pipeline.runPipeline(customerId);
    activePipelineResult = result;

    if (result) {
      renderCustomerPortal(result);
    }
  }

  function renderCustomerPortal({ profile, signals, report, recommendation, payload }) {
    // 1. Sidebar greetings
    document.getElementById("sidebar-greeting-name").textContent = profile.name.split(" ")[0];
    document.getElementById("sidebar-avatar").textContent = profile.name.charAt(0);

    // 2. Header ribbons
    document.getElementById("cust-welcome-title").textContent = `Welcome back, ${profile.name}`;
    document.getElementById("cust-welcome-subtitle").textContent = `${profile.life_stage} | Client ID ${profile.customer_id}`;
    document.getElementById("cust-header-val-balance").textContent = `£${profile.total_balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const valZone = document.getElementById("cust-header-val-zone");
    valZone.textContent = report.tier;
    valZone.className = "cust-tier-badge badge-" + report.tier.toLowerCase();

    // 3. Proactive Alerts Container
    renderProactiveBanner(payload, recommendation.products[0]);

    // 4. Overview tab panel counters
    document.getElementById("overview-wellbeing-num").textContent = report.score;
    document.getElementById("overview-wellbeing-summary").textContent = report.plain_english_summary;
    document.getElementById("overview-accounts-summary").textContent = `${profile.accounts.length} bank accounts mapped (${profile.existing_products.join(", ") || "none"})`;

    // Overview Checklist items
    const overviewChecklist = document.getElementById("overview-checklist-container");
    overviewChecklist.innerHTML = "";
    if (signals.behaviour_signals.length === 0) {
      overviewChecklist.innerHTML = `
        <div style="background: rgba(0, 230, 140, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(0, 230, 140, 0.15); font-size: 0.8rem; color: var(--neon-green);">
          ✓ All financial signals are secure. Emergency reserve cushions and outgoings are in optimal state.
        </div>
      `;
    } else {
      signals.behaviour_signals.forEach(sig => {
        overviewChecklist.innerHTML += `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 10px; padding: 12px; display: flex; gap: 12px; align-items: flex-start;">
            <input type="checkbox" checked disabled style="accent-color: var(--neon-green); margin-top: 3px;">
            <div>
              <strong style="color: var(--color-white); font-size: 0.85rem; display: block; margin-bottom: 2px;">${sig.signal}</strong>
              <span style="color: var(--color-text-muted); font-size: 0.78rem; line-height: 1.4; display: block;">${sig.evidence}</span>
            </div>
          </div>
        `;
      });
    }

    // Default select Overview panel tab in viewport
    navTiles.forEach(t => t.classList.remove("active"));
    viewportPanels.forEach(p => p.classList.remove("active"));
    navTiles[0].classList.add("active");
    document.getElementById("panel-overview").classList.add("active");

    // 5. Portfolio Panel Accounts
    const customerAccountsGrid = document.getElementById("customer-accounts-grid");
    customerAccountsGrid.innerHTML = "";
    profile.accounts.forEach(acc => {
      customerAccountsGrid.innerHTML += `
        <div class="cust-acc-card">
          <div class="cust-acc-type">${acc.account_type}</div>
          <div class="cust-acc-bal-row">
            <div class="cust-acc-bal">£${acc.balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            ${acc.credit_limit > 0 ? `<div class="cust-acc-limit">Credit Limit: £${acc.credit_limit}</div>` : ""}
          </div>
          <div class="cust-acc-meta">
            <span>Account Reference: ${acc.account_id}</span>
            <span>Opened: ${acc.opened_date}</span>
          </div>
        </div>
      `;
    });

    // 6. Wellbeing Diagnostics Panel
    const radialCircle = document.getElementById("radial-progress-circle");
    document.getElementById("score-number-display").textContent = report.score;
    document.getElementById("score-tier-label").textContent = report.tier;
    document.getElementById("score-tier-label").className = "cust-tier-badge badge-" + report.tier.toLowerCase();
    document.getElementById("score-diagnosis-summary").innerHTML = report.plain_english_summary;

    const radialCircumference = 314.159;
    const radialOffset = radialCircumference - (report.score / 100) * radialCircumference;
    radialCircle.style.strokeDasharray = `${radialCircumference} ${radialCircumference}`;
    radialCircle.style.strokeDashoffset = radialOffset;
    
    let diagColor = "var(--neon-green)";
    if (report.tier === "RED") diagColor = "var(--color-red)";
    else if (report.tier === "AMBER") diagColor = "var(--color-amber)";
    radialCircle.style.stroke = diagColor;

    // Wellbeing dimension progress bars
    const dimBars = document.getElementById("dimensions-progress-bars");
    dimBars.innerHTML = "";
    report.dimensions.forEach(dim => {
      const percentage = (dim.score / dim.max) * 100;
      dimBars.innerHTML += `
        <div class="dimension-item">
          <div class="dimension-label-row">
            <span class="dim-lbl">${dim.label}</span>
            <span class="dim-score">${dim.score}/${dim.max}</span>
          </div>
          <div class="dimension-bar-bg" style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow: hidden;">
            <div class="dimension-bar-fill" style="width: ${percentage}%; background: ${diagColor}; height: 100%;"></div>
          </div>
        </div>
      `;
    });

    // Wellbeing Risks lists
    const custRisks = document.getElementById("cust-risks-list");
    custRisks.innerHTML = "";
    if (report.top_3_risks.length === 0) {
      custRisks.innerHTML = `<li style="color: var(--neon-green); font-size: 0.82rem;">✓ All shield indicators are optimal. Risk parameters clear.</li>`;
    } else {
      report.top_3_risks.forEach(risk => {
        custRisks.innerHTML += `<li>${risk}</li>`;
      });
    }

    // 7. Product Showcase Recommendations Panel
    const productsShowcase = document.getElementById("product-recommendation-showcase");
    productsShowcase.innerHTML = "";
    if (recommendation.products.length > 0) {
      recommendation.products.forEach(prod => {
        productsShowcase.innerHTML += `
          <div class="recommendation-banner" style="margin-bottom: 15px;">
            <div class="rec-title-line">
              <span class="rec-badge">${prod.category.toUpperCase()}</span>
              <span class="rec-rate">${prod.interest_rate_aer || "Market Index"}</span>
            </div>
            <div class="rec-name">${prod.name}</div>
            <div class="rec-benefit">${recommendation.rationale}</div>
            <div class="rec-footer">
              <a href="${prod.product_url}" target="_blank" class="rec-link">Product terms & conditions ↗</a>
              <button class="rec-btn" id="cust-cta-buy-${prod.product_id}">Open Account</button>
            </div>
          </div>
        `;

        // Wire click handler to launch slider confirmation modals
        setTimeout(() => {
          const btn = document.getElementById(`cust-cta-buy-${prod.product_id}`);
          if (btn) {
            btn.onclick = () => openPurchaseModal(prod);
          }
        }, 15);
      });
    } else {
      productsShowcase.innerHTML = `
        <div class="recommendation-banner" style="border-color: var(--glass-border);">
          <div class="rec-name">Financial Support Resources</div>
          <div class="rec-benefit">${recommendation.rationale}</div>
          <div class="rec-footer">
            <a href="https://www.lloydsbank.com/help-guidance/financial-difficulty.html" target="_blank" class="rec-link">Find Support Resources ↗</a>
            <button class="rec-btn" style="background: var(--color-amber);">Talk to Specialist</button>
          </div>
        </div>
      `;
    }

    // 8. Dynamic 90-day transactions table rendering
    const txnsTbody = document.getElementById("cust-transactions-tbody");
    txnsTbody.innerHTML = "";
    const bqTxns = db.getTransactionsForCustomer(profile.customer_id);
    bqTxns.sort((a,b) => new Date(b.date) - new Date(a.date));

    bqTxns.forEach(txn => {
      const isCredit = txn.amount > 0;
      const amtColor = isCredit ? "var(--neon-green)" : "var(--color-text-main)";
      const amtPrefix = isCredit ? "+" : "";
      
      txnsTbody.innerHTML += `
        <tr>
          <td>${txn.date}</td>
          <td style="font-weight: 500;">${txn.merchant}</td>
          <td><span style="background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${txn.category}</span></td>
          <td style="color: ${amtColor}; font-weight: 600;">${amtPrefix}£${Math.abs(txn.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
          <td>${txn.type}</td>
        </tr>
      `;
    });
  }

  function renderProactiveBanner(payload, primaryProduct) {
    const proactiveContainer = document.getElementById("proactive-banner-container");
    proactiveContainer.innerHTML = "";

    let sevClass = "info";
    let indicatorIcon = "✦";

    if (payload.score_card.tier === "RED") {
      sevClass = "urgent";
      indicatorIcon = "⚠️";
    } else if (payload.score_card.tier === "AMBER") {
      sevClass = "warning";
      indicatorIcon = "⚡";
    } else if (payload.score_card.tier === "GREEN") {
      sevClass = "success";
      indicatorIcon = "🎉";
    }

    proactiveContainer.innerHTML = `
      <div class="proactive-banner ${sevClass}" id="customer-banner">
        <div class="banner-summary-row" id="customer-banner-header" style="padding: 15px 20px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <span class="banner-indicator-icon" style="font-size: 1.25rem;">${indicatorIcon}</span>
            <div>
              <div class="banner-headline" style="font-family: var(--font-display); font-weight: 700; color: var(--color-white); font-size: 0.92rem; margin-bottom: 2px;">${payload.headline}</div>
              <div class="banner-snippet" style="color: var(--color-text-muted); font-size: 0.78rem;">${payload.snippet}</div>
            </div>
          </div>
          <button class="banner-toggle-btn" id="customer-banner-toggle-btn" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--color-white); font-size: 0.75rem; padding: 4px 10px; cursor: pointer;">See details</button>
        </div>
        
        <div class="banner-expanded-drawer" id="customer-banner-details" style="display: none; border-top: 1px solid var(--glass-border); padding: 15px 20px; background: rgba(0,0,0,0.15);">
          <ul style="padding-left: 15px; font-size: 0.8rem; line-height: 1.5; color: var(--color-text-main); display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
            ${payload.bullets.map(b => `<li>${b}</li>`).join("")}
          </ul>
          
          ${payload.recommendation.product_id && primaryProduct ? `
            <div style="background: rgba(0, 106, 78, 0.15); border: 1px solid var(--glass-border); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <strong style="color: var(--color-white); font-size: 0.85rem; display: block; margin-bottom: 2px;">Recommended Account: ${payload.recommendation.product_name}</strong>
                <span style="color: var(--neon-green); font-size: 0.78rem; font-weight: 600;">Autonomous opening rate: ${payload.recommendation.rate} AER</span>
              </div>
              <button class="btn-primary" id="customer-banner-cta" style="font-size: 0.8rem; padding: 8px 16px;">${payload.recommendation.cta_label}</button>
            </div>
          ` : ""}
        </div>
      </div>
    `;

    // Toggle dropdown details logic
    const header = document.getElementById("customer-banner-header");
    const toggleBtn = document.getElementById("customer-banner-toggle-btn");
    const details = document.getElementById("customer-banner-details");

    header.onclick = () => {
      const isHidden = details.style.display === "none";
      details.style.display = isHidden ? "block" : "none";
      toggleBtn.textContent = isHidden ? "Collapse" : "See details";
    };

    // Bind purchase trigger inside proactive dropdown cards
    if (payload.recommendation.product_id && primaryProduct) {
      const bannerCta = document.getElementById("customer-banner-cta");
      if (bannerCta) {
        bannerCta.onclick = (e) => {
          e.stopPropagation();
          openPurchaseModal(primaryProduct);
        };
      }
    }
  }

  function drawSpendTrendChart(profile, signals) {
    if (customerSpendChart) {
      customerSpendChart.destroy();
    }

    const canvas = document.getElementById("spend-trend-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    
    // Compute aggregates based on monthly income limits
    const groceries = [170, 155, 190, 145, 185, 165].map(v => v * (profile.avg_monthly_income / 3500));
    const bills = [850, 850, 850, 850, 850, 850].map(v => v * (profile.avg_monthly_income / 3500));
    const shopping = [240, 300, 180, 410, 270, 220].map(v => v * (profile.avg_monthly_income / 3500));
    const dining = [140, 175, 210, 135, 195, 155].map(v => v * (profile.avg_monthly_income / 3500));
    const leisure = [190, 115, 290, 240, 175, 280].map(v => v * (profile.avg_monthly_income / 3500));

    // Calculate savings emergency cushion line overlays
    let savingsTrend = [];
    if (profile.customer_id === "CUST_0042") {
      savingsTrend = [1000, 800, 500, 300, 100, 0];
    } else if (profile.customer_id === "CUST_0099") {
      savingsTrend = [35000, 37000, 39000, 41000, 43000, 45000];
    } else if (profile.customer_id === "CUST_0150") {
      savingsTrend = [4500, 3800, 2900, 1800, 800, 150];
    } else {
      const saver = profile.accounts.find(a => a.account_type.includes("Saver") || a.account_type.includes("ISA"));
      const baseBal = saver ? saver.balance : 1200;
      savingsTrend = [0.82, 0.86, 0.90, 0.94, 0.98, 1.0].map(mult => baseBal * mult);
    }

    customerSpendChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          { label: "Bills", data: bills, backgroundColor: "#1e3a34", stack: "Stack 0" },
          { label: "Groceries", data: groceries, backgroundColor: "#006A4E", stack: "Stack 0" },
          { label: "Shopping", data: shopping, backgroundColor: "#319795", stack: "Stack 0" },
          { label: "Dining", data: dining, backgroundColor: "#4a5568", stack: "Stack 0" },
          { label: "Leisure", data: leisure, backgroundColor: "#4299e1", stack: "Stack 0" },
          {
            label: "Savings Cushion (Axis R)",
            data: savingsTrend,
            type: "line",
            borderColor: "#00E68C",
            borderWidth: 3,
            fill: false,
            yAxisID: "y-savings",
            tension: 0.25,
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
          }
        },
        scales: {
          x: { stacked: true, ticks: { color: "#8A9A96" }, grid: { color: "rgba(255,255,255,0.03)" } },
          y: { stacked: true, ticks: { color: "#8A9A96", callback: (v) => `£${v.toFixed(0)}` }, grid: { color: "rgba(255,255,255,0.03)" } },
          "y-savings": {
            type: "linear",
            position: "right",
            ticks: { color: "#00E68C", callback: (v) => `£${v.toLocaleString()}` },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }


  // --- ONE-CLICK PRODUCT PURCHASE CONTEXT FLOW ---

  function openPurchaseModal(product) {
    purchaseModal.classList.add("active");

    const currentAccount = db.accounts.find(a => a.customer_id === currentCustomerId && a.account_type.includes("Current"));
    const balanceAvailable = currentAccount ? currentAccount.balance : 0;

    document.getElementById("p-modal-title").textContent = `Open Lloyds ${product.name}`;
    document.getElementById("p-modal-rate").textContent = product.interest_rate_aer || "Market rate";
    document.getElementById("p-modal-fees").textContent = product.fees;
    document.getElementById("p-modal-source").textContent = `${currentAccount ? currentAccount.account_type : "Classic Current Account"} (Avail: £${balanceAvailable.toLocaleString('en-GB', { minimumFractionDigits: 2 })})`;

    const slider = document.getElementById("p-modal-slider");
    const input = document.getElementById("p-modal-input");

    const minRequired = product.min_deposit || 25;
    // Set max boundary: can't deposit more than available liquid cash, or cap to £5000 max.
    const maxVal = Math.min(balanceAvailable, product.category === "Savings" && product.name.includes("Monthly") ? 400 : 5000);

    slider.min = minRequired;
    slider.max = Math.max(minRequired, maxVal);
    slider.value = minRequired;
    input.value = minRequired;

    slider.oninput = () => {
      input.value = slider.value;
    };

    input.onchange = () => {
      let val = parseFloat(input.value) || minRequired;
      if (val < minRequired) val = minRequired;
      if (val > maxVal) val = maxVal;
      input.value = val;
      slider.value = val;
    };

    // Modal Close
    const closeModal = () => purchaseModal.classList.remove("active");
    document.getElementById("p-modal-close-icon").onclick = closeModal;
    document.getElementById("p-modal-cancel").onclick = closeModal;

    // Modal Confirmation - Triggers Autonomous Purchase Agent 6!
    document.getElementById("p-modal-confirm").onclick = async () => {
      const depositVal = parseFloat(input.value);
      closeModal();

      // Fire autonomous action pipeline
      const confirmation = await pipeline.runAgent6(currentCustomerId, product.product_id, depositVal);

      if (confirmation.success) {
        showSuccessModal(confirmation);
      } else {
        alert(`Setup Transaction Terminated: ${confirmation.error}`);
      }
    };
  }

  function showSuccessModal(confirmation) {
    successModal.classList.add("active");

    document.getElementById("success-modal-product").textContent = confirmation.product_name;
    document.getElementById("success-modal-debited").textContent = `£${confirmation.amount_debited.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
    document.getElementById("success-modal-ref").textContent = confirmation.confirmation_ref;
    document.getElementById("success-modal-body").textContent = confirmation.next_steps;

    document.getElementById("success-modal-btn").onclick = () => {
      successModal.classList.remove("active");

      // Force refresh customer dashboard states with updated scoring models
      renderCustomerPortal(confirmation.updatedState);
      activePipelineResult = confirmation.updatedState;
    };
  }


  // --- INITIAL APPLICATION STATE ---
  showView("landing");
});
