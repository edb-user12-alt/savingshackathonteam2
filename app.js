/**
 * Lloyds Financial Wellbeing AI - Application Controller (v3)
 */

let currentCustomerId = "CUST_0042";
let activePipelineResult = null;
let adminCharts = { tiers: null, wellbeing: null, lifestages: null };
let customerSpendChart = null;

// Admin State
let adminPage = 1;
const adminPageSize = 10;
let adminFilter = "all";
let adminSearchQuery = "";
let adminChartFilter = null; // { category: 'tier'|'wellbeing', value: string }

const views = {};

function showView(viewName) {
  console.log("Switching to view:", viewName);
  Object.keys(views).forEach(key => {
    if (views[key]) {
      if (key === viewName) {
        views[key].style.display = "block";
        views[key].classList.add("active");
      } else {
        views[key].style.display = "none";
        views[key].classList.remove("active");
      }
    }
  });

  // Reset scroll
  window.scrollTo(0, 0);

  // Sidebar/Log sheet resets
  const logBtn = document.getElementById("btn-toggle-agent-logs");
  const logSheet = document.getElementById("agent-logs-sheet");
  if (viewName === "landing" || viewName === "customerLogin" || viewName === "adminLogin") {
    if (logBtn) logBtn.style.display = "none";
    if (logSheet) logSheet.style.display = "none";
    if (logSheet) logSheet.style.right = "-400px";
  } else {
    if (logBtn) logBtn.style.display = "flex";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const db = new BigQuerySimulation();
  await db.sync();
  
  const pipeline = new AgentPipeline(db);

  // Map Views
  views.landing = document.getElementById("view-landing");
  views.adminLogin = document.getElementById("view-admin-login");
  views.admin = document.getElementById("view-admin");
  views.customerLogin = document.getElementById("view-customer-login");
  views.customerDashboard = document.getElementById("view-customer-dashboard");

  // --- EVENT BINDING ---
  async function pushDataToBigQuery() {
    const btn = document.getElementById('admin-nav-push-bq');
    if (btn) btn.disabled = true;
    
    showToast("Preparing data for BigQuery...");
    
    const data = {
      customers: db.customers,
      accounts: db.accounts,
      transactions: db.transactions
    };

    try {
      const response = await fetch('/api/push-to-bq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      if (response.ok) {
        showToast("Success! Data pushed to lloyds_financial_wellbeing.", "success");
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to push to BigQuery: " + err.message, "error");
    } finally {
      if (btn) btn.disabled = false;
      document.getElementById("admin-sidebar").classList.remove("active");
    }
  };

  function showToast(message, type = "info") {
    console.log(`TOAST [${type}]: ${message}`);
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; 
      background: ${type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#006a4d')};
      color: white; padding: 12px 24px; border-radius: 8px; z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif;
      transition: all 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) {
      el.onclick = (e) => {
        console.log(`Button Clicked: ${id}`);
        fn(e);
      };
    } else {
      console.warn(`Element not found for binding: ${id}`);
    }
  };

  // Landing
  bind("btn-enter-admin", () => showView("adminLogin"));
  bind("btn-enter-customer", () => showView("customerLogin"));

  // Cancel Buttons
  bind("btn-admin-login-cancel", () => showView("landing"));
  bind("btn-customer-login-cancel", () => showView("landing"));

  // Admin Login
  const adminForm = document.getElementById("admin-login-form");
  if (adminForm) {
    adminForm.onsubmit = (e) => {
      e.preventDefault();
      const user = document.getElementById("admin-user").value;
      const pass = document.getElementById("admin-pass").value;
      console.log("Admin Login Attempt:", user);
      if (user === "admin" && pass === "Lloyds@133") {
        showView("admin");
        initAdminDashboard();
      } else {
        alert("Invalid admin credentials.");
      }
    };
  }

  // Admin Dashboard Controls
  bind("btn-admin-logout", () => {
    destroyAdminCharts();
    showView("landing");
  });

  const adminSearch = document.getElementById("admin-search-input");
  if (adminSearch) {
    adminSearch.oninput = (e) => {
      adminSearchQuery = e.target.value.toLowerCase().trim();
      adminPage = 1;
      renderAdminDirectory();
    };
  }

  document.querySelectorAll("[data-admin-filter]").forEach(btn => {
    btn.onclick = () => {
      console.log("Admin Filter Clicked:", btn.getAttribute("data-admin-filter"));
      document.querySelectorAll("[data-admin-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      adminFilter = btn.getAttribute("data-admin-filter");
      adminPage = 1;
      renderAdminDirectory();
    };
  });

  bind("btn-admin-prev", () => {
    if (adminPage > 1) { adminPage--; renderAdminDirectory(); }
  });
  bind("btn-admin-next", () => {
    const total = getFilteredCustomers().length;
    if (adminPage * adminPageSize < total) { adminPage++; renderAdminDirectory(); }
  });

  // Customer Login
  const loginDemoSelector = document.getElementById("login-demo-selector");
  const loginCustIdInput = document.getElementById("login-cust-id");
  if (loginDemoSelector && loginCustIdInput) {
    loginDemoSelector.onchange = () => loginCustIdInput.value = loginDemoSelector.value;
  }

  const customerForm = document.getElementById("customer-login-form");
  if (customerForm) {
    customerForm.onsubmit = (e) => {
      e.preventDefault();
      const custIdInput = document.getElementById("login-cust-id");
      const custId = custIdInput.value.trim().toUpperCase();
      console.log("Customer Login Attempt:", custId);
      const customer = db.customers.find(c => c.customer_id === custId);
      if (!customer) { alert("Customer not found."); return; }
      showView("customerDashboard");
      initCustomerDashboard(custId);
    };
  }

  // Admin Hamburger Toggle
  bind("btn-admin-hamburger", () => {
    document.getElementById("admin-sidebar").classList.add("active");
  });
  bind("btn-admin-sidebar-close", () => {
    document.getElementById("admin-sidebar").classList.remove("active");
  });

  // Admin Nav Switches
  bind("admin-nav-analytics", () => {
    document.getElementById("admin-sidebar").classList.remove("active");
    // Analytics is already the default view in admin
  });
  bind("admin-nav-directory", () => {
    document.getElementById("admin-sidebar").classList.remove("active");
    document.querySelector(".admin-directory-section").scrollIntoView({ behavior: 'smooth' });
  });

  // BigQuery Push
  bind("admin-nav-push-bq", () => {
    pushDataToBigQuery();
  });

  // Sidebar Toggles
  bind("btn-sidebar-hamburger", () => {
    const sidebar = document.getElementById("customer-portal-sidebar");
    if (sidebar) sidebar.classList.toggle("sidebar-collapsed");
  });

  // Logs sheet
  bind("btn-toggle-agent-logs", () => {
    const sheet = document.getElementById("agent-logs-sheet");
    if (sheet) sheet.style.right = "0";
  });
  bind("btn-close-logs-sheet", () => {
    const sheet = document.getElementById("agent-logs-sheet");
    if (sheet) sheet.style.right = "-400px";
  });

  pipeline.registerLogListener((entry) => {
    const feed = document.getElementById("log-feed");
    const line = document.createElement("div");
    line.style.marginBottom = "10px";
    line.style.padding = "10px";
    line.style.borderLeft = `3px solid ${entry.type === 'error' ? 'red' : '#10b981'}`;
    line.style.background = "white";
    line.innerHTML = `<strong>[${entry.agent}]</strong>: ${entry.message}`;
    feed.appendChild(line);
    feed.scrollTop = feed.scrollHeight;
  });

  // --- ADMIN LOGIC ---

  function getDeterministicScore(cust, accounts) {
    if (cust.customer_id === "CUST_0042") return { score: 41, tier: "RED" };
    if (cust.customer_id === "CUST_0099") return { score: 84, tier: "GREEN" };
    if (cust.customer_id === "CUST_0150") return { score: 35, tier: "RED" };
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const savings = accounts.find(a => a.account_type.includes("Saver") || a.account_type.includes("ISA"))?.balance || 0;
    let score = 55;
    if (savings > 20000) score += 30;
    else if (savings > 5000) score += 15;
    else if (savings > 1000) score += 5;
    
    if (totalBalance < 100) score -= 20;
    const ratio = totalBalance / (cust.income_annual || 30000);
    if (ratio > 0.5) score += 15;
    score = Math.max(10, Math.min(95, score));
    return { score, tier: score >= 80 ? "GREEN" : (score >= 45 ? "AMBER" : "RED") };
  }

  function initAdminDashboard() {
    destroyAdminCharts();
    const totalCust = db.customers.length;
    const totalAUM = db.accounts.reduce((sum, a) => sum + a.balance, 0);
    let totalScore = 0;
    let counts = { GREEN: 0, AMBER: 0, RED: 0, NORMAL: 0, PRIVILEGED: 0 };
    const stages = {};

    db.customers.forEach(c => {
      const accs = db.accounts.filter(a => a.customer_id === c.customer_id);
      const { score, tier } = getDeterministicScore(c, accs);
      totalScore += score;
      counts[tier]++;
      counts[c.tier]++;
      const stage = c.life_stage;
      if (!stages[stage]) stages[stage] = { total: 0, count: 0 };
      stages[stage].total += accs.reduce((sum, a) => sum + a.balance, 0);
      stages[stage].count++;
    });

    document.getElementById("admin-count-cust").textContent = totalCust;
    document.getElementById("admin-count-aum").textContent = `£${(totalAUM / 1000000).toFixed(1)}M`;
    document.getElementById("admin-count-score").textContent = (totalScore / totalCust).toFixed(1);
    document.getElementById("admin-count-privileged").textContent = `${(counts.PRIVILEGED / totalCust * 100).toFixed(1)}%`;

    // Charts
    const ctxTiers = document.getElementById("admin-chart-tiers").getContext("2d");
    adminCharts.tiers = new Chart(ctxTiers, {
      type: "doughnut",
      data: { labels: ["Normal", "Privileged"], datasets: [{ data: [counts.NORMAL, counts.PRIVILEGED], backgroundColor: ["#006a4d", "#002e3b"] }] },
      options: { 
        onClick: (e, items) => {
          if (items.length > 0) {
            const index = items[0].index;
            const label = index === 1 ? "PRIVILEGED" : "NORMAL";
            toggleChartFilter('tier', label);
          }
        }
      }
    });

    const ctxWell = document.getElementById("admin-chart-wellbeing").getContext("2d");
    adminCharts.wellbeing = new Chart(ctxWell, {
      type: "pie",
      data: { labels: ["Green", "Amber", "Red"], datasets: [{ data: [counts.GREEN, counts.AMBER, counts.RED], backgroundColor: ["#10b981", "#f59e0b", "#ef4444"] }] },
      options: {
        onClick: (e, items) => {
          if (items.length > 0) {
            const index = items[0].index;
            const label = ["GREEN", "AMBER", "RED"][index];
            toggleChartFilter('wellbeing', label);
          }
        }
      }
    });

    const ctxStage = document.getElementById("admin-chart-lifestages").getContext("2d");
    const stageLabels = Object.keys(stages);
    const stageData = stageLabels.map(s => stages[s].total / stages[s].count);
    adminCharts.lifestages = new Chart(ctxStage, {
      type: "bar",
      data: { labels: stageLabels, datasets: [{ label: "Avg Assets", data: stageData, backgroundColor: "#006a4d" }] }
    });

    renderAdminDirectory();
  }

  function toggleChartFilter(category, value) {
    if (adminChartFilter && adminChartFilter.category === category && adminChartFilter.value === value) {
      adminChartFilter = null;
    } else {
      adminChartFilter = { category, value };
    }
    adminPage = 1;
    renderAdminDirectory();
  }

  function getFilteredCustomers() {
    return db.customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(adminSearchQuery) || c.customer_id.toLowerCase().includes(adminSearchQuery);
      if (!matchesSearch) return false;
      if (adminFilter !== "all" && c.tier !== adminFilter.toUpperCase()) return false;
      if (adminChartFilter) {
        if (adminChartFilter.category === "tier" && c.tier !== adminChartFilter.value) return false;
        if (adminChartFilter.category === "wellbeing") {
          const accs = db.accounts.filter(a => a.customer_id === c.customer_id);
          const { tier } = getDeterministicScore(c, accs);
          if (tier !== adminChartFilter.value) return false;
        }
      }
      return true;
    });
  }

  function renderAdminDirectory() {
    const tableBody = document.getElementById("admin-directory-body");
    tableBody.innerHTML = "";
    const filtered = getFilteredCustomers();
    const total = filtered.length;
    const start = (adminPage - 1) * adminPageSize;
    const end = Math.min(start + adminPageSize, total);
    
    document.getElementById("admin-page-info").textContent = `Page ${adminPage} of ${Math.ceil(total / adminPageSize) || 1}`;

    filtered.slice(start, end).forEach(cust => {
      const accs = db.accounts.filter(a => a.customer_id === cust.customer_id);
      const balance = accs.reduce((sum, a) => sum + a.balance, 0);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${cust.customer_id}</td>
        <td>${cust.name}</td>
        <td>${cust.life_stage}</td>
        <td>${cust.tier}</td>
        <td>£${balance.toLocaleString()}</td>
        <td><button class="btn-secondary" style="padding: 2px 10px; font-size: 0.75rem;">View Profile</button></td>
      `;
      tr.onclick = () => openAdminDrawer(cust.customer_id);
      tableBody.appendChild(tr);
    });
  }

  function destroyAdminCharts() {
    Object.keys(adminCharts).forEach(k => { if (adminCharts[k]) { adminCharts[k].destroy(); adminCharts[k] = null; } });
  }

  // --- DRAWER LOGIC ---

  async function openAdminDrawer(custId) {
    currentCustomerId = custId;
    document.getElementById("admin-detail-drawer").classList.add("active");
    const cust = db.customers.find(c => c.customer_id === custId);
    document.getElementById("drawer-cust-name").textContent = cust.name;
    document.getElementById("drawer-cust-id").textContent = custId;
    document.getElementById("drawer-avatar").textContent = cust.name.charAt(0);
    
    document.getElementById("drawer-content").innerHTML = "<p>Analyzing customer wellbeing...</p>";
    const result = await pipeline.runPipeline(custId);
    
    const { report, profile } = result;
    document.getElementById("drawer-content").innerHTML = `
      <div>
        <h4>Wellbeing Score: ${report.score}</h4>
        <p style="margin: 10px 0; font-size: 0.9rem;">${report.plain_english_summary}</p>
        <h5>Dimensions</h5>
        ${report.dimensions.map(d => `<div style="margin: 5px 0;">${d.label}: ${d.score}/${d.max}</div>`).join("")}
      </div>
      <div>
        <h4>Accounts</h4>
        ${profile.accounts.map(a => `<div style="padding: 10px; border: 1px solid #eee; margin-bottom: 5px;">${a.account_type}: £${a.balance.toLocaleString()}</div>`).join("")}
      </div>
    `;
  }
  document.getElementById("btn-close-admin-drawer").onclick = () => {
    document.getElementById("admin-detail-drawer").classList.remove("active");
  };

  // --- CUSTOMER LOGIC ---

  async function initCustomerDashboard(custId) {
    currentCustomerId = custId;
    const result = await pipeline.runPipeline(custId);
    activePipelineResult = result;
    renderCustomerPortal(result);
  }

  function renderCustomerPortal({ profile, report, recommendation, payload }) {
    document.getElementById("sidebar-greeting-name").textContent = profile.name.split(" ")[0];
    document.getElementById("sidebar-avatar").textContent = profile.name.charAt(0);
    document.getElementById("cust-welcome-title").textContent = `Welcome back, ${profile.name.split(" ")[0]}`;
    document.getElementById("cust-header-val-balance").textContent = `£${profile.total_balance.toLocaleString()}`;
    document.getElementById("cust-header-val-zone").textContent = report.tier;
    
    document.getElementById("overview-wellbeing-num").textContent = report.score;
    document.getElementById("overview-wellbeing-summary").textContent = report.plain_english_summary;
    
    renderProactiveBanner(payload, recommendation.products[0]);
    
    const accGrid = document.getElementById("customer-accounts-grid");
    accGrid.innerHTML = "";
    profile.accounts.forEach(a => {
      accGrid.innerHTML += `<div class="dashboard-card"><strong>${a.account_type}</strong><div style="font-size: 1.5rem; margin-top: 10px;">£${a.balance.toLocaleString()}</div></div>`;
    });

    const dimBars = document.getElementById("dimensions-progress-bars");
    dimBars.innerHTML = report.dimensions.map(d => `
      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;"><span>${d.label}</span><span>${d.score}/${d.max}</span></div>
        <div style="height: 6px; background: #eee; border-radius: 3px; overflow: hidden; margin-top: 5px;">
          <div style="height: 100%; background: var(--lloyds-green); width: ${d.score/d.max*100}%"></div>
        </div>
      </div>
    `).join("");

    const prodShowcase = document.getElementById("product-recommendation-showcase");
    prodShowcase.innerHTML = recommendation.products.map(p => `
      <div class="dashboard-card">
        <h3>${p.name}</h3>
        <p style="color: var(--lloyds-green); font-weight: 700;">${p.interest_rate_aer}</p>
        <p style="font-size: 0.85rem; margin: 10px 0;">${recommendation.rationale}</p>
        <button class="btn-primary" onclick="window.openPurchaseModal('${p.product_id}')">Open Account</button>
      </div>
    `).join("");

    setTimeout(() => drawSpendTrendChart(profile), 100);
  }

  function renderProactiveBanner(payload, product) {
    const container = document.getElementById("proactive-banner-container");
    container.innerHTML = `
      <div class="proactive-banner">
        <div class="banner-summary-row" id="banner-header">
           <div style="display: flex; gap: 15px; align-items: center;">
              <span style="font-size: 1.5rem;">✦</span>
              <div>
                 <strong>${payload.headline}</strong>
                 <p style="font-size: 0.8rem; color: #666;">${payload.snippet}</p>
              </div>
           </div>
           <button class="btn-secondary" style="font-size: 0.75rem;">See details</button>
        </div>
        <div class="banner-expanded-drawer" id="banner-details">
           <ul style="margin-bottom: 20px;">${payload.bullets.map(b => `<li>${b}</li>`).join("")}</ul>
           ${product ? `<button class="btn-primary" onclick="window.openPurchaseModal('${product.product_id}')">${payload.recommendation.cta_label}</button>` : ""}
        </div>
      </div>
    `;
    const header = document.getElementById("banner-header");
    header.onclick = () => {
      const details = document.getElementById("banner-details");
      details.style.display = details.style.display === "block" ? "none" : "block";
    };
  }

  window.openPurchaseModal = (prodId) => {
    const product = db.products_live.find(p => p.product_id === prodId);
    document.getElementById("p-modal-title").textContent = `Open ${product.name}`;
    document.getElementById("p-modal-rate").textContent = product.interest_rate_aer;
    document.getElementById("p-modal-fees").textContent = product.fees;
    document.getElementById("purchase-modal").classList.add("active");
    
    const slider = document.getElementById("p-modal-slider");
    const input = document.getElementById("p-modal-input");
    const apiKey = document.getElementById("p-modal-api-key");
    const confirmBtn = document.getElementById("p-modal-confirm");

    slider.min = 25; slider.max = 500; slider.value = 100;
    input.value = 100; apiKey.value = "";
    confirmBtn.disabled = true;

    slider.oninput = () => input.value = slider.value;
    apiKey.oninput = () => confirmBtn.disabled = apiKey.value.trim().length === 0;

    confirmBtn.onclick = async () => {
      document.getElementById("purchase-modal").classList.remove("active");
      const confirmation = await pipeline.runAgent6(currentCustomerId, prodId, parseFloat(input.value));
      if (confirmation.success) {
        document.getElementById("success-modal-body").textContent = `Your ${product.name} has been opened with a deposit of £${input.value}.`;
        document.getElementById("success-modal").classList.add("active");
        renderCustomerPortal(confirmation.updatedState);
      }
    };
  };

  document.getElementById("p-modal-cancel").onclick = () => document.getElementById("purchase-modal").classList.remove("active");
  document.getElementById("success-modal-btn").onclick = () => document.getElementById("success-modal").classList.remove("active");

  function drawSpendTrendChart(profile) {
    const ctx = document.getElementById("spend-trend-canvas").getContext("2d");
    if (customerSpendChart) customerSpendChart.destroy();
    customerSpendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [{ label: "Balance History", data: [5000, 5200, 4800, 5500, 6000, profile.total_balance], borderColor: "#006a4d", tension: 0.3 }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // Initial View
  showView("landing");
  
  // Wire tiles
  document.querySelectorAll(".nav-tile").forEach(t => {
    if (t.id === "btn-customer-signout") {
      t.onclick = () => { if (confirm("Sign out?")) showView("landing"); };
      return;
    }
    t.onclick = () => {
      const tileType = t.getAttribute("data-cust-tile");
      if (!tileType) return;
      
      document.querySelectorAll(".nav-tile").forEach(n => n.classList.remove("active"));
      t.classList.add("active");
      
      document.querySelectorAll(".viewport-panel").forEach(p => p.classList.remove("active"));
      const targetPanel = document.getElementById(`panel-${tileType}`);
      if (targetPanel) targetPanel.classList.add("active");
    };
  });
});
