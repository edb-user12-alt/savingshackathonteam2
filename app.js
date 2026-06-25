/**
 * Lloyds Financial Wellbeing AI - Application Controller
 */

class BigQuerySimulation {
  constructor() {
    this.customers = [];
    this.accounts = [];
    this.products_live = [];
    this.isLoaded = false;
  }

  async sync() {
    console.log("Syncing with Python BigQuery Simulator...");
    try {
      const response = await fetch('/api/db');
      if (!response.ok) throw new Error("Database sync failed.");
      const data = await response.json();
      
      // 1. Raw response logging for diagnostic tracking (Requirement 1)
      console.log("Raw BigQuery Response Data:", data);
      if (data) {
        if (data.customers) {
          console.log(`Raw Customers count: ${data.customers.length}`);
          if (data.customers.length > 0) {
            console.log("Raw Customer Sample:", data.customers[0]);
          }
        }
        if (data.accounts) {
          console.log(`Raw Accounts count: ${data.accounts.length}`);
          if (data.accounts.length > 0) {
            console.log("Raw Account Sample:", data.accounts[0]);
          }
        }
      }

      // 2. Robust parsing and field mapping of BigQuery records
      this.customers = (data.customers || []).map(c => ({
        ...c,
        customer_id: c.customer_id || "UNKNOWN",
        name: c.name || "Unknown",
        age: parseInt(c.age, 10) || 0,
        life_stage: c.life_stage || "Unknown",
        tenure_years: parseInt(c.tenure_years, 10) || 0,
        income_annual: parseFloat(c.income_annual) || 0,
        income_band: c.income_band || "N/A",
        premier_flag: c.premier_flag === "true" || c.premier_flag === true,
        tier: (c.tier || "NORMAL").toUpperCase().trim()
      }));

      this.accounts = (data.accounts || []).map(a => ({
        ...a,
        customer_id: a.customer_id || "UNKNOWN",
        account_id: a.account_id || "UNKNOWN",
        account_type: a.account_type || "Unknown Account",
        balance: parseFloat(a.balance) || 0.0,
        credit_limit: parseFloat(a.credit_limit) || 0.0,
        product_id: a.product_id || ""
      }));

      this.products_live = data.products_live || [];
      this.isLoaded = true;
      console.log("Database Sync Complete. Cast records loaded:", this.customers.length);
    } catch (err) {
      console.error("Sync Error:", err);
      throw err; // Propagate error so page load can show error state
    }
  }
}

class AgentPipeline {
  constructor(db) {
    this.db = db;
    this.activityLog = [];
    this.onLogCallback = null;
  }

  registerLogListener(callback) {
    this.onLogCallback = callback;
  }

  log(agentName, message, type = "info", data = null) {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      agent: agentName,
      message,
      type,
      data: data ? JSON.parse(JSON.stringify(data)) : null
    };
    this.activityLog.push(entry);
    if (this.onLogCallback) {
      this.onLogCallback(entry);
    }
  }

  clearLog() { this.activityLog = []; }

  async runPipeline(customer_id) {
    this.clearLog();
    this.log("Orchestrator", `Forwarding wellbeing request for ${customer_id} to Python Agent Cluster...`, "start");
    try {
      const response = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id })
      });
      if (!response.ok) throw new Error("Backend Agent Pipeline failed.");
      const result = await response.json();
      if (result.logs) {
        result.logs.forEach(l => this.log(l.agent, l.message, l.type, l.data));
      }
      this.log("Orchestrator", "Python Backend Pipeline complete. Data synced.", "success");
      return result;
    } catch (err) {
      this.log("Orchestrator", `Connection Error: ${err.message}`, "error");
      return null;
    }
  }

  async runAgent6(customer_id, product_id, initial_deposit) {
    this.log("Orchestrator", `Authorizing autonomous purchase via Python Purchase Agent...`, "start");
    try {
      const response = await fetch('/api/pipeline/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id, product_id, initial_deposit })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Purchase failed.");
      }
      const result = await response.json();
      if (result.updated_state && result.updated_state.logs) {
        result.updated_state.logs.forEach(l => this.log(l.agent, l.message, l.type, l.data));
      }
      this.log("Orchestrator", "Purchase finalized by Agent 6 on Backend.", "success");
      return { success: true, updatedState: result.updated_state };
    } catch (err) {
      this.log("Orchestrator", `Purchase Failed: ${err.message}`, "error");
      return { success: false, error: err.message };
    }
  }
}

// Session Management
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const session = {
  get: () => {
    const s = localStorage.getItem("lloyds_session");
    if (!s) return null;
    const data = JSON.parse(s);
    if (Date.now() - data.timestamp > SESSION_TIMEOUT) {
      localStorage.removeItem("lloyds_session");
      return null;
    }
    return data;
  },
  set: (role, id) => {
    localStorage.setItem("lloyds_session", JSON.stringify({ role, id, timestamp: Date.now() }));
  },
  clear: () => {
    localStorage.removeItem("lloyds_session");
  }
};

let currentCustomerId = "CUST_0042";
let activePipelineResult = null;
let adminCharts = { tiers: null, wellbeing: null, lifestages: null };
let customerSpendChart = null;
let customerBreakdownChart = null;
let pipeline = null; // To be initialized in DOMContentLoaded

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
  // Map Views FIRST so they are available for showView
  views.landing = document.getElementById("view-landing");
  views.adminLogin = document.getElementById("view-admin-login");
  views.admin = document.getElementById("view-admin");
  views.customerLogin = document.getElementById("view-customer-login");
  views.customerDashboard = document.getElementById("view-customer-dashboard");

  const db = new BigQuerySimulation();
  pipeline = new AgentPipeline(db);

  const handleRouting = () => {
    const path = window.location.pathname;
    const activeSession = session.get();

    if (activeSession) {
      if (activeSession.role === "admin") {
        showView("admin");
        if (db.isLoaded) {
          initAdminDashboard();
        } else {
          renderAdminLoaders();
        }
        return;
      } else if (activeSession.role === "customer") {
        showView("customerDashboard");
        if (db.isLoaded) {
          initCustomerDashboard(activeSession.id);
        } else {
          // If customer views are loaded before DB sync, it will trigger dashboard on complete
          console.log("Customer session active, waiting for BigQuery sync...");
        }
        return;
      }
    }

    if (path === '/admin') {
      showView('adminLogin');
    } else if (path === '/customer') {
      showView('customerLogin');
    } else {
      showView('landing');
    }
  };

  // Run initial routing to display login views or loaders immediately
  handleRouting();

  // Handle back/forward buttons
  window.onpopstate = handleRouting;

  // Run database sync asynchronously
  try {
    await db.sync();
    // Re-trigger routing now that the database has successfully loaded
    const activeSession = session.get();
    if (activeSession) {
      if (activeSession.role === "admin") {
        initAdminDashboard();
      } else if (activeSession.role === "customer") {
        initCustomerDashboard(activeSession.id);
      }
    }
  } catch (err) {
    console.error("Failed to sync BigQuery data on load:", err);
    const activeSession = session.get();
    if (activeSession && activeSession.role === "admin") {
      renderAdminErrorState(err.message || "Failed to load database schema from BigQuery.");
    } else {
      showToast("BigQuery connection error: " + err.message, "error");
    }
  }

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
  bind("btn-enter-admin", () => {
    window.history.pushState({}, "", "/admin");
    handleRouting();
  });
  bind("btn-enter-customer", () => {
    window.history.pushState({}, "", "/customer");
    handleRouting();
  });

  // Cancel Buttons
  bind("btn-admin-login-cancel", () => {
    window.history.pushState({}, "", "/");
    handleRouting();
  });
  bind("btn-customer-login-cancel", () => {
    window.history.pushState({}, "", "/");
    handleRouting();
  });

  // Admin Login
  const adminForm = document.getElementById("admin-login-form");
  if (adminForm) {
    adminForm.onsubmit = (e) => {
      e.preventDefault();
      const user = document.getElementById("admin-user").value;
      const pass = document.getElementById("admin-pass").value;
      console.log("Admin Login Attempt:", user);
      if (user === "admin" && pass === "Lloyds@133") {
        session.set("admin", "admin");
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
    session.clear();
    window.location.href = "/admin"; // Force reload to clear all states
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
      session.set("customer", custId);
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

  bind("btn-customer-signout", () => {
    session.clear();
    window.location.href = "/customer"; // Force reload to clear all states
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

  if (pipeline) {
    pipeline.registerLogListener((entry) => {
      const feed = document.getElementById("log-feed");
      if (!feed) return;
      const line = document.createElement("div");
      line.style.marginBottom = "10px";
      line.style.padding = "10px";
      line.style.borderLeft = `3px solid ${entry.type === 'error' ? 'red' : (entry.type === 'success' ? '#10b981' : '#006a4d')}`;
      line.style.background = "white";
      line.style.borderRadius = "4px";
      line.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
      line.innerHTML = `<div style="font-size: 0.7rem; color: #64748b;">${entry.timestamp} - ${entry.agent}</div><div>${entry.message}</div>`;
      feed.appendChild(line);
      feed.scrollTop = feed.scrollHeight;
    });
  }

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

  function renderAdminLoaders() {
    console.log("Rendering Admin View Loaders...");
    // Show spinner in metrics
    document.getElementById("admin-count-cust").innerHTML = '<span style="font-size: 1rem; opacity: 0.6;">...</span>';
    document.getElementById("admin-count-aum").innerHTML = '<span style="font-size: 1rem; opacity: 0.6;">...</span>';
    document.getElementById("admin-count-score").innerHTML = '<span style="font-size: 1rem; opacity: 0.6;">...</span>';
    document.getElementById("admin-count-privileged").innerHTML = '<span style="font-size: 1rem; opacity: 0.6;">...</span>';

    // Show loaders in chart cards
    const gridDivs = document.querySelectorAll(".admin-charts-grid > div");
    if (gridDivs.length >= 3) {
      gridDivs[0].innerHTML = `
        <h4>Customer Tiering</h4>
        <div class="spinner-container">
          <div class="spinner"></div>
          <p style="font-size: 0.8rem; opacity: 0.8;">Loading tiers...</p>
        </div>
      `;
      gridDivs[1].innerHTML = `
        <h4>Wellbeing Clusters</h4>
        <div class="spinner-container">
          <div class="spinner"></div>
          <p style="font-size: 0.8rem; opacity: 0.8;">Loading wellbeing clusters...</p>
        </div>
      `;
      gridDivs[2].innerHTML = `
        <h4>Assets by Life Stage</h4>
        <div class="spinner-container">
          <div class="spinner"></div>
          <p style="font-size: 0.8rem; opacity: 0.8;">Loading assets...</p>
        </div>
      `;
    }

    // Show spinner in table
    const tableBody = document.getElementById("admin-directory-body");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="spinner-container">
              <div class="spinner"></div>
              <p>Fetching records from BigQuery...</p>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function renderAdminErrorState(errorMessage) {
    console.warn("Rendering Admin Error State:", errorMessage);
    // Reset metrics to empty/error representation
    document.getElementById("admin-count-cust").textContent = "N/A";
    document.getElementById("admin-count-aum").textContent = "£0.00";
    document.getElementById("admin-count-score").textContent = "0.0";
    document.getElementById("admin-count-privileged").textContent = "0.0%";

    // Replace charts with error states
    const gridDivs = document.querySelectorAll(".admin-charts-grid > div");
    if (gridDivs.length >= 3) {
      gridDivs[0].innerHTML = `
        <h4>Customer Tiering</h4>
        <div class="error-container">
          <h4>Data Unavailable</h4>
          <p>${errorMessage || "BigQuery query returned empty or failed."}</p>
        </div>
      `;
      gridDivs[1].innerHTML = `
        <h4>Wellbeing Clusters</h4>
        <div class="error-container">
          <h4>Data Unavailable</h4>
          <p>${errorMessage || "BigQuery query returned empty or failed."}</p>
        </div>
      `;
      gridDivs[2].innerHTML = `
        <h4>Assets by Life Stage</h4>
        <div class="error-container">
          <h4>Data Unavailable</h4>
          <p>${errorMessage || "BigQuery query returned empty or failed."}</p>
        </div>
      `;
    }

    // Show error in table
    const tableBody = document.getElementById("admin-directory-body");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="error-container" style="margin: 20px auto; max-width: 500px;">
              <h4>Failed to Load Customer Base</h4>
              <p>${errorMessage || "Could not retrieve records from BigQuery. Please refresh or check connection."}</p>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function initAdminDashboard() {
    destroyAdminCharts();
    const totalCust = db.customers.length;
    const totalAUM = db.accounts.reduce((sum, a) => sum + a.balance, 0);

    if (totalCust === 0) {
      renderAdminErrorState("No customer records found in BigQuery.");
      return;
    }

    let totalScore = 0;
    let counts = { GREEN: 0, AMBER: 0, RED: 0, NORMAL: 0, PRIVILEGED: 0 };
    const stages = {};

    db.customers.forEach(c => {
      const accs = db.accounts.filter(a => a.customer_id === c.customer_id);
      const { score, tier } = getDeterministicScore(c, accs);
      totalScore += score;
      if (counts[tier] !== undefined) counts[tier]++;
      
      const cTier = (c.tier || "NORMAL").toUpperCase().trim();
      if (counts[cTier] !== undefined) counts[cTier]++;
      
      const stage = c.life_stage || "Unknown";
      if (!stages[stage]) stages[stage] = { total: 0, count: 0 };
      stages[stage].total += accs.reduce((sum, a) => sum + a.balance, 0);
      stages[stage].count++;
    });

    document.getElementById("admin-count-cust").textContent = totalCust;
    document.getElementById("admin-count-aum").textContent = `£${(totalAUM / 1000000).toFixed(2)}M`;
    document.getElementById("admin-count-score").textContent = (totalScore / totalCust).toFixed(1);
    document.getElementById("admin-count-privileged").textContent = `${((counts.PRIVILEGED || 0) / totalCust * 100).toFixed(1)}%`;

    // Recreate canvases in the chart cards (in case they were replaced by loaders/errors)
    const gridDivs = document.querySelectorAll(".admin-charts-grid > div");
    if (gridDivs.length >= 3) {
      gridDivs[0].innerHTML = `
        <h4>Customer Tiering</h4>
        <canvas id="admin-chart-tiers"></canvas>
        <p style="font-size: 0.7rem; color: #6b7280; text-align: center; margin-top: 10px;">Click segment to filter table</p>
      `;
      gridDivs[1].innerHTML = `
        <h4>Wellbeing Clusters</h4>
        <canvas id="admin-chart-wellbeing"></canvas>
        <p style="font-size: 0.7rem; color: #6b7280; text-align: center; margin-top: 10px;">Click segment to filter table</p>
      `;
      gridDivs[2].innerHTML = `
        <h4>Assets by Life Stage</h4>
        <canvas id="admin-chart-lifestages"></canvas>
      `;
    }

    // Initialize Tiers Chart
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

    // Initialize Wellbeing Chart
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

    // Initialize Lifestages Chart
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
      const nameStr = (c.name || "Unknown").toLowerCase();
      const idStr = (c.customer_id || "UNKNOWN").toLowerCase();
      const matchesSearch = nameStr.includes(adminSearchQuery) || idStr.includes(adminSearchQuery);
      if (!matchesSearch) return false;
      
      const cTier = (c.tier || "NORMAL").toUpperCase().trim();
      if (adminFilter !== "all" && cTier !== adminFilter.toUpperCase()) return false;
      
      if (adminChartFilter) {
        if (adminChartFilter.category === "tier" && cTier !== adminChartFilter.value) return false;
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
    if (!tableBody) return;
    tableBody.innerHTML = "";
    
    const filtered = getFilteredCustomers();
    const total = filtered.length;
    
    if (total === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--color-text-muted);">
            No customers found matching the search criteria or active filters.
          </td>
        </tr>
      `;
      document.getElementById("admin-page-info").textContent = "Page 1 of 1";
      return;
    }

    const start = (adminPage - 1) * adminPageSize;
    const end = Math.min(start + adminPageSize, total);
    
    document.getElementById("admin-page-info").textContent = `Page ${adminPage} of ${Math.ceil(total / adminPageSize) || 1}`;

    filtered.slice(start, end).forEach(cust => {
      const accs = db.accounts.filter(a => a.customer_id === cust.customer_id);
      const balance = accs.reduce((sum, a) => sum + a.balance, 0);
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      
      const nameVal = cust.name || "Unknown";
      const stageVal = cust.life_stage || "Unknown";
      const tierVal = cust.tier || "NORMAL";
      
      tr.innerHTML = `
        <td>${cust.customer_id}</td>
        <td><strong>${nameVal}</strong></td>
        <td>${stageVal}</td>
        <td><span class="status-pill status-${tierVal === 'PRIVILEGED' ? 'green' : 'normal'}" style="font-size: 0.75rem; padding: 2px 8px;">${tierVal}</span></td>
        <td style="font-weight: 600; color: var(--lloyds-green-dark);">£${balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td><button class="btn-secondary" style="padding: 4px 12px; font-size: 0.75rem; border-radius: 4px;">Analyze</button></td>
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
    
    // Reset viewport to overview
    document.querySelectorAll(".nav-tile").forEach(n => n.classList.remove("active"));
    const overviewTile = document.querySelector('[data-cust-tile="overview"]');
    if (overviewTile) overviewTile.classList.add("active");
    
    document.querySelectorAll(".viewport-panel").forEach(p => p.classList.remove("active"));
    const overviewPanel = document.getElementById("panel-overview");
    if (overviewPanel) overviewPanel.classList.add("active");

    const result = await pipeline.runPipeline(custId);
    activePipelineResult = result;
    renderCustomerPortal(result);
  }

  function renderCustomerPortal(result) {
    if (!result) return;
    const { profile, report, signals, recommendation, ai_advice, payload } = result;
    
    // Dynamic Wellbeing Tier and Colors based on Score
    const score = report.score;
    const derivedTier = score >= 80 ? "GREEN" : (score >= 50 ? "AMBER" : "RED");
    const statusColor = score >= 80 ? "#10b981" : (score >= 50 ? "#f59e0b" : "#ef4444");

    // Header Score
    const scoreVal = document.getElementById("header-score-value");
    const scoreLabel = document.getElementById("header-score-label");
    if (scoreVal) scoreVal.textContent = score;
    if (scoreLabel) {
      scoreLabel.textContent = derivedTier;
      scoreLabel.className = `status-pill status-${derivedTier.toLowerCase()}`;
    }

    // AI Advisor Card (LLM Integration)
    const aiBox = document.getElementById("ai-advisor-advice");
    if (aiBox && ai_advice) {
       aiBox.innerHTML = `
         <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 15px; border-radius: 12px; border-left: 4px solid #0ea5e9;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #0369a1; font-weight: 600;">
               <span>✨</span> AI Financial Copilot
            </div>
            <p style="font-size: 0.95rem; line-height: 1.5; color: #1e293b;">${ai_advice.advice}</p>
            <div style="margin-top: 8px; font-size: 0.7rem; color: #64748b; font-style: italic;">
               Powered by ${ai_advice.model} • Confidence: ${(ai_advice.confidence * 100).toFixed(0)}%
            </div>
         </div>
       `;
    }
    document.getElementById("sidebar-greeting-name").textContent = profile.name.split(" ")[0];
    document.getElementById("sidebar-avatar").textContent = profile.name.charAt(0);
    document.getElementById("cust-welcome-title").textContent = `Welcome back, ${profile.name.split(" ")[0]}`;
    
    // Dynamic Balance Formatting
    document.getElementById("cust-header-val-balance").textContent = profile.total_balance.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
    
    // Dynamic Status Badge
    const zoneElem = document.getElementById("cust-header-val-zone");
    if (zoneElem) {
      zoneElem.textContent = derivedTier;
      zoneElem.style.color = statusColor;
    }
    
    // Dynamic Earnings & Spending Metrics
    if (signals) {
      document.getElementById("cust-header-val-earnings").textContent = signals.avg_monthly_earnings.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
      document.getElementById("cust-header-val-spending").textContent = signals.avg_monthly_spending.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
    }
    
    // Dynamic Score Colors
    const overviewScore = document.getElementById("overview-wellbeing-num");
    if (overviewScore) {
      overviewScore.textContent = score;
      overviewScore.style.color = statusColor;
    }
    document.getElementById("overview-wellbeing-summary").textContent = report.plain_english_summary;
    
    renderProactiveBanner(payload, recommendation.products[0]);
    
    const accGrid = document.getElementById("customer-accounts-grid");
    accGrid.innerHTML = "";
    profile.accounts.forEach(a => {
      accGrid.innerHTML += `<div class="dashboard-card"><strong>${a.account_type}</strong><div style="font-size: 1.5rem; margin-top: 10px;">${a.balance.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}</div></div>`;
    });

    const dimBars = document.getElementById("dimensions-progress-bars");
    dimBars.innerHTML = report.dimensions.map(d => `
      <div style="margin-bottom: 15px;">
         <div style="display: flex; justify-content: space-between; font-size: 0.8rem;"><span>${d.label}</span><span>${d.score}/${d.max}</span></div>
         <div style="height: 6px; background: #eee; border-radius: 3px; overflow: hidden; margin-top: 5px;">
           <div style="height: 100%; background: ${statusColor}; width: ${d.score/d.max*100}%"></div>
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

    // Render spend breakdown & trend charts
    setTimeout(() => {
      drawSpendBreakdownChart(result.transactions);
      drawSpendTrendChart(profile, result.transactions);
    }, 100);
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

  const categoryColors = {
    "Groceries": "#006a4d", // Lloyds Green
    "Dining": "#0284c7",    // Sky Blue
    "Bills": "#f59e0b",     // Amber
    "Leisure": "#8b5cf6",   // Purple
    "Shopping": "#ec4899",  // Pink
    "Charges": "#ef4444",   // Red
    "Transport": "#14b8a6", // Teal/Cyan
    "Savings": "#10b981",   // Emerald
    "Other": "#6b7280"      // Gray
  };

  function getLast6Months() {
    const months = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let year = 2026;
    let month = 5; // 0-indexed June 2026
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      if (m < 0) {
        m += 12;
        y -= 1;
      }
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = monthNames[m];
      months.push({ key, label });
    }
    return months;
  }

  function drawSpendTrendChart(profile, transactions) {
    const canvas = document.getElementById("spend-trend-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (customerSpendChart) customerSpendChart.destroy();

    const months = getLast6Months();
    const debitCategories = new Set();
    const dataByMonthAndCategory = {};

    months.forEach(m => {
      dataByMonthAndCategory[m.key] = {};
    });

    if (transactions) {
      transactions.forEach(t => {
        if (!t.date || typeof t.date !== "string") return;
        const monthKey = t.date.substring(0, 7);
        if (!dataByMonthAndCategory[monthKey]) return; // Outside our 6-month window

        const amount = parseFloat(t.amount);
        const cat = t.category || "Other";
        if (amount < 0 && cat !== "Salary" && cat !== "Savings") {
          debitCategories.add(cat);
          const val = Math.abs(amount);
          dataByMonthAndCategory[monthKey][cat] = (dataByMonthAndCategory[monthKey][cat] || 0) + val;
        }
      });
    }

    const categoriesArray = Array.from(debitCategories);
    const datasets = categoriesArray.map(cat => {
      const color = categoryColors[cat] || categoryColors["Other"];
      const data = months.map(m => Math.round(dataByMonthAndCategory[m.key][cat] || 0));
      return {
        label: cat,
        data: data,
        backgroundColor: color,
        borderWidth: 0,
        borderRadius: 4
      };
    });

    customerSpendChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: months.map(m => m.label),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, usePointStyle: true, pointStyle: "circle" }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: £${context.raw.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: value => "£" + value } }
        }
      }
    });
  }

  function drawSpendBreakdownChart(transactions) {
    const canvas = document.getElementById("spend-breakdown-pie-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (customerBreakdownChart) customerBreakdownChart.destroy();

    const targetMonth = "2026-06";
    const categorySums = {};
    let totalSpending = 0;

    if (transactions) {
      transactions.forEach(t => {
        if (!t.date || typeof t.date !== "string") return;
        const monthKey = t.date.substring(0, 7);
        if (monthKey !== targetMonth) return;

        const amount = parseFloat(t.amount);
        const cat = t.category || "Other";
        if (amount < 0 && cat !== "Salary" && cat !== "Savings") {
          const val = Math.abs(amount);
          categorySums[cat] = (categorySums[cat] || 0) + val;
          totalSpending += val;
        }
      });
    }

    const categories = Object.keys(categorySums).sort((a, b) => categorySums[b] - categorySums[a]);
    const dataValues = categories.map(cat => Math.round(categorySums[cat]));
    const backgroundColors = categories.map(cat => categoryColors[cat] || categoryColors["Other"]);

    customerBreakdownChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: categories,
        datasets: [{
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const pct = totalSpending > 0 ? ((context.raw / totalSpending) * 100).toFixed(0) : 0;
                return `${context.label}: £${context.raw.toLocaleString("en-GB")} (${pct}%)`;
              }
            }
          }
        },
        cutout: "70%"
      }
    });

    const listContainer = document.getElementById("spend-breakdown-list");
    if (listContainer) {
      listContainer.innerHTML = "";
      if (categories.length === 0) {
        listContainer.innerHTML = `<p style="color: var(--color-text-muted); font-size: 0.9rem;">No transactions this month.</p>`;
        return;
      }

      listContainer.innerHTML = categories.map(cat => {
        const amt = categorySums[cat];
        const pct = totalSpending > 0 ? (amt / totalSpending * 100) : 0;
        const color = categoryColors[cat] || categoryColors["Other"];
        return `
          <div style="margin-bottom: 8px;">
             <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                   <span style="width: 10px; height: 10px; background: ${color}; border-radius: 50%;"></span>
                   <span style="font-weight: 600;">${cat}</span>
                </div>
                <div style="color: #475569;">
                   <strong>£${amt.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                   <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 4px;">(${pct.toFixed(0)}%)</span>
                </div>
             </div>
             <div style="height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; background: ${color}; width: ${pct}%"></div>
             </div>
          </div>
        `;
      }).join("");
    }
  }

  // Initial View handled by handleRouting()
  console.log("App Initialized. Setting up navigation...");
  
  // Wire tiles
  const navTiles = document.querySelectorAll(".nav-tile");
  console.log(`Found ${navTiles.length} navigation tiles.`);
  
  navTiles.forEach(t => {
    if (t.id === "btn-customer-signout") {
      t.onclick = () => { 
        console.log("Sign out clicked");
        if (confirm("Sign out?")) {
          session.clear();
          window.history.pushState({}, "", "/");
          handleRouting();
        }
      };
      return;
    }
    t.onclick = (e) => {
      const tileType = t.getAttribute("data-cust-tile");
      console.log(`Nav Tile Clicked: ${tileType || t.id}`);
      if (!tileType) return;
      
      document.querySelectorAll(".nav-tile").forEach(n => n.classList.remove("active"));
      t.classList.add("active");
      
      const panels = document.querySelectorAll(".viewport-panel");
      panels.forEach(p => p.classList.remove("active"));

      const targetPanel = document.getElementById(`panel-${tileType}`);
      if (targetPanel) {
        console.log(`Activating panel: panel-${tileType}`);
        targetPanel.classList.add("active");
      } else {
        console.error(`Target panel not found: panel-${tileType}`);
      }

      // Redraw charts when switching to their panels to avoid zero-size rendering bugs
      if (tileType === "trends" && activePipelineResult) {
        setTimeout(() => {
          drawSpendTrendChart(activePipelineResult.profile, activePipelineResult.transactions);
        }, 50);
      } else if (tileType === "wellbeing" && activePipelineResult) {
        setTimeout(() => {
          drawSpendBreakdownChart(activePipelineResult.transactions);
        }, 50);
      }

      // Close mobile sidebar if open (collapsed state)
      const sidebar = document.getElementById("customer-portal-sidebar");
      if (sidebar) {
        sidebar.classList.add("sidebar-collapsed");
      }
    };
  });
});
