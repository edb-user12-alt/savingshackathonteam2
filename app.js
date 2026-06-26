/* BEAUTIFY v2 */
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
    setLogsPulsing(true);
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
      setLogsPulsing(false);
      return result;
    } catch (err) {
      this.log("Orchestrator", `Connection Error: ${err.message}`, "error");
      setLogsPulsing(false);
      return null;
    }
  }

  async runAgent6(customer_id, product_id, initial_deposit) {
    this.log("Orchestrator", `Authorizing autonomous purchase via Python Purchase Agent...`, "start");
    setLogsPulsing(true);
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
      setLogsPulsing(false);
      return { success: true, updatedState: result.updated_state, confirmation_ref: result.confirmation_ref };
    } catch (err) {
      this.log("Orchestrator", `Purchase Failed: ${err.message}`, "error");
      setLogsPulsing(false);
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
let demoConfig = { DEMO_MODE: true, ORCHESTRATOR_KEY: "LLOYDS-AGENT-6-SECURE" };
let pipeline = null; // To be initialized in DOMContentLoaded

// Admin State
let adminPage = 1;
const adminPageSize = 10;
let adminFilter = "all";
let adminSearchQuery = "";
let adminChartFilter = null; // { category: 'tier'|'wellbeing', value: string }

// Active log filters
let activeAdminLogFilter = "all";
let activeSheetLogFilter = "all";

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
    if (logSheet) logSheet.style.display = "";
  }
}

// Utility to set pulsing indicators
function setLogsPulsing(isRunning) {
  const dots = document.querySelectorAll(".pulse-dot, .pulsing-log-dot");
  dots.forEach(dot => {
    if (isRunning) {
      dot.style.display = "inline-block";
    } else {
      dot.style.display = "none";
    }
  });
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

  // Register logger pipeline listener immediately to avoid race conditions
  if (pipeline) {
    pipeline.registerLogListener((entry) => {
      const agentInfo = getAgentStyleInfo(entry.agent);
      const timestamp = entry.timestamp || new Date().toLocaleTimeString();
      
      const logHtml = `
        <div class="log-card-row" data-agent="${agentInfo.label}">
           <span class="log-time">${timestamp}</span>
           <span class="log-agent-pill" style="background-color: ${agentInfo.color}">${agentInfo.label}</span>
           <span class="log-desc">${entry.message}</span>
        </div>
      `;

      // Append to global sliding sheet
      const sheetFeed = document.getElementById("log-feed");
      if (sheetFeed) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = logHtml.trim();
        sheetFeed.appendChild(tempDiv.firstElementChild || tempDiv.firstChild);
        sheetFeed.scrollTop = sheetFeed.scrollHeight;
      }

      // Append to Admin Dashboard logs tab
      const adminFeedPanel = document.getElementById("admin-log-feed");
      if (adminFeedPanel) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = logHtml.trim();
        adminFeedPanel.appendChild(tempDiv.firstElementChild || tempDiv.firstChild);
        adminFeedPanel.scrollTop = adminFeedPanel.scrollHeight;
      }

      applyLogFilters();
    });
  }

  // Load backend configurations
  try {
    const configResp = await fetch('/api/config');
    if (configResp.ok) {
      demoConfig = await configResp.json();
      console.log("Backend Configurations Loaded:", demoConfig);
    }
  } catch (err) {
    console.error("Failed to load backend configurations, using defaults:", err);
  }

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
    }
  }

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

  // Admin Avatar Dropdown Toggle
  const avatarBtn = document.getElementById("admin-avatar-btn");
  const dropdownMenu = document.getElementById("admin-dropdown");
  if (avatarBtn && dropdownMenu) {
    avatarBtn.onclick = (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("active");
    };
    
    // Close on click outside
    document.addEventListener("click", () => {
      dropdownMenu.classList.remove("active");
    });
  }

  // Admin Tabs Navigation
  const adminTabs = [
    { btnId: "tab-admin-overview", panelId: "admin-panel-overview" },
    { btnId: "tab-admin-customers", panelId: "admin-panel-customers" },
    { btnId: "tab-admin-logs", panelId: "admin-panel-logs" }
  ];

  adminTabs.forEach(tab => {
    bind(tab.btnId, () => {
      adminTabs.forEach(t => {
        const btn = document.getElementById(t.btnId);
        const panel = document.getElementById(t.panelId);
        if (btn) btn.classList.remove("active");
        if (panel) {
          panel.classList.remove("active");
          panel.style.display = "none";
        }
      });
      const activeBtn = document.getElementById(tab.btnId);
      const activePanel = document.getElementById(tab.panelId);
      if (activeBtn) activeBtn.classList.add("active");
      if (activePanel) {
        activePanel.classList.add("active");
        activePanel.style.display = "block";
      }

      // Context switches
      if (tab.btnId === "tab-admin-customers") {
        renderAdminDirectory();
      } else if (tab.btnId === "tab-admin-overview" && db.isLoaded) {
        initAdminDashboard();
      }
    });
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

  const adminPageInput = document.getElementById("admin-page-input");
  if (adminPageInput) {
    adminPageInput.onchange = (e) => {
      let val = parseInt(e.target.value, 10);
      const total = getFilteredCustomers().length;
      const maxPage = Math.ceil(total / adminPageSize) || 1;
      if (isNaN(val) || val < 1) val = 1;
      if (val > maxPage) val = maxPage;
      adminPage = val;
      adminPageInput.value = val;
      renderAdminDirectory();
    };
  }

  // Customer Login
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

  // BigQuery Push
  bind("admin-nav-push-bq", () => {
    pushDataToBigQuery();
  });

  // Sidebar Toggles
  bind("btn-sidebar-hamburger", () => {
    const sidebar = document.getElementById("customer-portal-sidebar");
    if (sidebar) sidebar.classList.toggle("sidebar-collapsed");
  });

  // Logs sheet toggle
  bind("btn-toggle-agent-logs", () => {
    const sheet = document.getElementById("agent-logs-sheet");
    if (sheet) sheet.style.right = "0";
  });
  bind("btn-close-logs-sheet", () => {
    const sheet = document.getElementById("agent-logs-sheet");
    if (sheet) sheet.style.right = "-400px";
  });

  // Clear log feed on fresh startup
  const feed = document.getElementById("log-feed");
  if (feed) feed.innerHTML = "";
  const adminFeed = document.getElementById("admin-log-feed");
  if (adminFeed) adminFeed.innerHTML = "";

  // Wire up Log Filter Dropdown inside Sheet
  const sheetFilterSelect = document.getElementById("sheet-log-filter");
  if (sheetFilterSelect) {
    sheetFilterSelect.onchange = (e) => {
      activeSheetLogFilter = e.target.value;
      applyLogFilters();
    };
  }

  // Wire up Log Filter Pills inside Admin Log Tab
  const adminLogPills = document.querySelectorAll("#admin-logs-filter-container .logs-filter-pill");
  adminLogPills.forEach(pill => {
    pill.onclick = () => {
      adminLogPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeAdminLogFilter = pill.getAttribute("data-log-filter");
      applyLogFilters();
    };
  });

  // Helper to resolve agent specific styles
  function getAgentStyleInfo(agentName) {
    const name = (agentName || "").toLowerCase();
    if (name.includes("intelligence") || name.includes("agent 1")) {
      return { label: "Customer Intelligence", color: "#0d9488" }; // teal
    }
    if (name.includes("analyst") || name.includes("agent 2")) {
      return { label: "Transaction Analyst", color: "#2563eb" }; // blue
    }
    if (name.includes("scorer") || name.includes("wellbeing") || name.includes("agent 3")) {
      return { label: "Wellbeing Scorer", color: "#d97706" }; // amber
    }
    if (name.includes("selector") || name.includes("agent 4")) {
      return { label: "Product Selector", color: "#7c3aed" }; // purple
    }
    if (name.includes("intervention") || name.includes("agent 5")) {
      return { label: "Intervention Agent", color: "#16a34a" }; // green
    }
    if (name.includes("purchase") || name.includes("agent 6")) {
      return { label: "Purchase Agent", color: "#f43f5e" }; // coral/red
    }
    return { label: agentName || "Orchestrator", color: "#006a4d" }; // lloyds green
  }

  function applyLogFilters() {
    // Filter admin-log-feed
    const adminFeed = document.getElementById("admin-log-feed");
    if (adminFeed) {
      const rows = adminFeed.querySelectorAll(".log-card-row");
      rows.forEach(r => {
        const agent = r.getAttribute("data-agent");
        if (activeAdminLogFilter === "all" || agent === activeAdminLogFilter) {
          r.style.display = "flex";
        } else {
          r.style.display = "none";
        }
      });
    }

    // Filter sheet-log-feed
    const sheetFeed = document.getElementById("log-feed");
    if (sheetFeed) {
      const rows = sheetFeed.querySelectorAll(".log-card-row");
      rows.forEach(r => {
        const agent = r.getAttribute("data-agent");
        if (activeSheetLogFilter === "all" || agent === activeSheetLogFilter) {
          r.style.display = "flex";
        } else {
          r.style.display = "none";
        }
      });
    }
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
    document.getElementById("admin-count-cust").innerHTML = '<span class="loading-pulse">...</span>';
    document.getElementById("admin-count-aum").innerHTML = '<span class="loading-pulse">...</span>';
    document.getElementById("admin-count-score").innerHTML = '<span class="loading-pulse">...</span>';
    document.getElementById("admin-count-privileged").innerHTML = '<span class="loading-pulse">...</span>';

    // Show loaders in chart cards
    const gridDivs = document.querySelectorAll(".admin-charts-grid > div");
    gridDivs.forEach(div => {
      div.innerHTML = `
        <div class="skeleton-chart-card">
           <div class="skeleton-header"></div>
           <div class="skeleton-chart-circle"></div>
        </div>
      `;
    });

    // Show spinner in table
    const tableBody = document.getElementById("admin-directory-body");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="spinner-container" style="text-align:center; padding: 40px;">
              <div class="spinner" style="border: 3px solid var(--lloyds-green-light); border-top-color: var(--lloyds-green); border-radius: 50%; width: 24px; height: 24px; display: inline-block; animation: spin 0.8s linear infinite;"></div>
              <p style="margin-top: 10px; font-size: 0.85rem; color: var(--color-text-muted);">Fetching records from BigQuery...</p>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function renderAdminErrorState(errorMessage) {
    console.warn("Rendering Admin Error State:", errorMessage);
    document.getElementById("admin-count-cust").textContent = "N/A";
    document.getElementById("admin-count-aum").textContent = "£0.00";
    document.getElementById("admin-count-score").textContent = "0.0";
    document.getElementById("admin-count-privileged").textContent = "0.0%";

    const gridDivs = document.querySelectorAll(".admin-charts-grid > div");
    gridDivs.forEach(div => {
      div.innerHTML = `
        <div class="error-container" style="text-align: center; padding: 20px;">
          <h4 style="font-size: 0.9rem; color: var(--score-red);">Data Unavailable</h4>
          <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 5px;">${errorMessage || "Failed to load database schemas."}</p>
        </div>
      `;
    });

    const tableBody = document.getElementById("admin-directory-body");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="error-container" style="margin: 20px auto; text-align: center; max-width: 500px;">
              <h4 style="color: var(--score-red);">Failed to Load Customer Base</h4>
              <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 6px;">${errorMessage || "Could not retrieve records from BigQuery."}</p>
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

    // Populate Filters pills count badges
    const countAllBadge = document.getElementById("count-all");
    const countNormalBadge = document.getElementById("count-normal");
    const countPrivilegedBadge = document.getElementById("count-privileged");
    if (countAllBadge) countAllBadge.textContent = totalCust;
    if (countNormalBadge) countNormalBadge.textContent = counts.NORMAL;
    if (countPrivilegedBadge) countPrivilegedBadge.textContent = counts.PRIVILEGED;

    // Reset Chart Canvases
    const gridDivs = document.querySelectorAll(".admin-charts-grid > div");
    if (gridDivs.length >= 3) {
      gridDivs[0].innerHTML = `
        <h4 class="chart-title">Customer Tiering</h4>
        <div class="chart-canvas-wrapper"><canvas id="admin-chart-tiers"></canvas></div>
        <p class="chart-interaction-tip">Click segment to filter table</p>
      `;
      gridDivs[1].innerHTML = `
        <h4 class="chart-title">Wellbeing Clusters</h4>
        <div class="chart-canvas-wrapper"><canvas id="admin-chart-wellbeing"></canvas></div>
        <p class="chart-interaction-tip">Click segment to filter table</p>
      `;
      gridDivs[2].innerHTML = `
        <h4 class="chart-title">Assets by Life Stage</h4>
        <div class="chart-canvas-wrapper"><canvas id="admin-chart-lifestages"></canvas></div>
        <p class="chart-interaction-tip">Grouped by age bracket assets</p>
      `;
    }

    // Customer Tiering (Doughnut Chart)
    const ctxTiers = document.getElementById("admin-chart-tiers").getContext("2d");
    adminCharts.tiers = new Chart(ctxTiers, {
      type: "doughnut",
      data: { 
        labels: ["Normal", "Privileged"], 
        datasets: [{ 
          data: [counts.NORMAL, counts.PRIVILEGED], 
          backgroundColor: ["#006A4E", "#7C3AED"], // Lloyds Green & Violet
          borderWidth: 0
        }] 
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => ` ${context.label}: ${context.raw} customers (${((context.raw / totalCust) * 100).toFixed(1)}%)`
            }
          }
        },
        onClick: (e, items) => {
          if (items.length > 0) {
            const index = items[0].index;
            const label = index === 1 ? "PRIVILEGED" : "NORMAL";
            toggleChartFilter('tier', label);
          }
        }
      }
    });

    // Wellbeing Clusters (Horizontal Bar Chart)
    const ctxWell = document.getElementById("admin-chart-wellbeing").getContext("2d");
    adminCharts.wellbeing = new Chart(ctxWell, {
      type: "bar",
      data: { 
        labels: ["Green", "Amber", "Red"], 
        datasets: [{ 
          data: [counts.GREEN, counts.AMBER, counts.RED], 
          backgroundColor: ["#0F6E56", "#854F0B", "#A32D2D"], // score green, amber, red
          borderRadius: 4,
          borderWidth: 0
        }] 
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => ` ${context.label} Tier: ${context.raw} customers (${((context.raw / totalCust) * 100).toFixed(1)}%)`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Customer Count", font: { family: "Outfit", size: 10, weight: "bold" } },
            ticks: { precision: 0 }
          },
          y: {
            title: { display: true, text: "Score zone", font: { family: "Outfit", size: 10, weight: "bold" } }
          }
        },
        onClick: (e, items) => {
          if (items.length > 0) {
            const index = items[0].index;
            const label = ["GREEN", "AMBER", "RED"][index];
            toggleChartFilter('wellbeing', label);
          }
        }
      }
    });

    // Assets by Life Stage (Grouped Bar Chart)
    const ctxStage = document.getElementById("admin-chart-lifestages").getContext("2d");
    const stageLabels = Object.keys(stages);
    const stageData = stageLabels.map(s => stages[s].total / stages[s].count);
    adminCharts.lifestages = new Chart(ctxStage, {
      type: "bar",
      data: { 
        labels: stageLabels, 
        datasets: [{ 
          label: "Average Assets", 
          data: stageData, 
          backgroundColor: "#006A4E",
          borderRadius: 4
        }] 
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => ` Avg Assets: £${Math.round(context.raw).toLocaleString('en-GB')}`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Life Stage Grouping', font: { family: 'Outfit', size: 10, weight: 'bold' } }
          },
          y: {
            title: { display: true, text: 'Average Assets per Customer (£)', font: { family: 'Outfit', size: 10, weight: 'bold' } },
            ticks: {
              callback: (value) => '£' + (value / 1000) + 'k'
            }
          }
        }
      }
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
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--color-text-muted);">
            No customers found matching the search criteria or active filters.
          </td>
        </tr>
      `;
      document.getElementById("admin-page-info").textContent = "Showing 0–0 of 0 customers";
      return;
    }

    const start = (adminPage - 1) * adminPageSize;
    const end = Math.min(start + adminPageSize, total);
    
    document.getElementById("admin-page-info").textContent = `Showing ${start + 1}–${end} of ${total} customers`;

    const pageInput = document.getElementById("admin-page-input");
    if (pageInput) {
      pageInput.value = adminPage;
    }

    filtered.slice(start, end).forEach(cust => {
      const accs = db.accounts.filter(a => a.customer_id === cust.customer_id);
      const balance = accs.reduce((sum, a) => sum + a.balance, 0);
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      
      const nameVal = cust.name || "Unknown";
      const stageVal = cust.life_stage || "Unknown";
      const tierVal = cust.tier || "NORMAL";
      
      // Calculate deterministic wellbeing score
      const { score } = getDeterministicScore(cust, accs);
      const scoreClass = score >= 80 ? "green" : (score >= 50 ? "amber" : "red");
      const scoreColor = score >= 80 ? "var(--score-green)" : (score >= 50 ? "var(--score-amber)" : "var(--score-red)");
      const scoreTierLabel = score >= 80 ? "GREEN" : (score >= 50 ? "AMBER" : "RED");
      const tierClass = tierVal === "PRIVILEGED" ? "status-privileged" : "status-normal";

      tr.innerHTML = `
        <td>${cust.customer_id}</td>
        <td><strong>${nameVal}</strong></td>
        <td>${stageVal}</td>
        <td><span class="status-pill ${tierClass}">${tierVal}</span></td>
        <td>
           <div class="wellbeing-score-cell">
              <span class="wellbeing-dot ${scoreClass}"></span>
              <span style="font-weight: 500; color: ${scoreColor};">${score} • ${scoreTierLabel}</span>
           </div>
        </td>
        <td class="td-balance" style="font-weight: 600; color: var(--lloyds-green-dark); text-align: right;">
           £${balance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td style="text-align: center;">
           <button class="btn-view-customer" style="background: transparent; border: 1.5px solid var(--lloyds-green); color: var(--lloyds-green); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
              View →
           </button>
        </td>
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
    if (!cust) return;
    document.getElementById("drawer-cust-name").textContent = cust.name;
    document.getElementById("drawer-cust-id").textContent = custId;
    document.getElementById("drawer-avatar").textContent = cust.name.charAt(0);
    
    // Skeleton loader for side drawer
    document.getElementById("drawer-content").innerHTML = `
      <div class="drawer-skeleton-loader" style="padding: 20px 0;">
         <div class="skeleton-gauge" style="width: 120px; height: 120px; border-radius: 50%; border: 6px solid var(--lloyds-green-light); margin: 0 auto; animation: pulse 1.5s infinite;"></div>
         <div class="skeleton-line" style="width: 80%; height: 14px; background: #e2e8f0; border-radius: 4px; margin: 20px auto 10px; animation: pulse 1.5s infinite;"></div>
         <div class="skeleton-line" style="width: 60%; height: 10px; background: #e2e8f0; border-radius: 4px; margin: 0 auto 30px; animation: pulse 1.5s infinite;"></div>
         <div class="skeleton-card" style="height: 80px; background: #f1f5f9; border-radius: 8px; margin-bottom: 15px; animation: pulse 1.5s infinite;"></div>
         <div class="skeleton-card" style="height: 80px; background: #f1f5f9; border-radius: 8px; animation: pulse 1.5s infinite;"></div>
      </div>
    `;
    
    const result = await pipeline.runPipeline(custId);
    if (!result) {
      document.getElementById("drawer-content").innerHTML = `<p class="text-red">Failed to analyze customer. Please try again.</p>`;
      return;
    }
    
    const { report, profile, recommendation, payload, signals } = result;
    const score = report.score;
    const derivedTier = score >= 80 ? "GREEN" : (score >= 50 ? "AMBER" : "RED");
    const statusColor = score >= 80 ? "var(--score-green)" : (score >= 50 ? "var(--score-amber)" : "var(--score-red)");
    
    // Calculate stroke offset
    const maxOffset = 235.62;
    const targetOffset = maxOffset * (1 - score / 100);
    
    // Render top 3 signals
    let signalsHtml = "";
    if (payload.banners && payload.banners.length > 0) {
      signalsHtml = payload.banners.map(b => {
        let borderCol = b.type === 'urgent' ? 'var(--score-red)' : (b.type === 'warning' ? 'var(--score-amber)' : 'var(--lloyds-green)');
        let bgCol = b.type === 'urgent' ? 'rgba(163, 45, 45, 0.05)' : (b.type === 'warning' ? 'rgba(133, 79, 11, 0.05)' : 'rgba(0, 106, 78, 0.05)');
        return `
          <div class="drawer-signal-item" style="border-left: 3px solid ${borderCol}; background: ${bgCol}; padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 0.8rem;">
             <div style="display: flex; gap: 8px; align-items: center; font-weight: 600; color: var(--lloyds-navy); margin-bottom: 4px;">
                <span>${b.icon}</span> ${b.headline}
             </div>
             <p style="color: var(--color-text-muted); line-height: 1.4; margin: 0;">${b.bullets[0]}</p>
          </div>
        `;
      }).join("");
    } else {
      signalsHtml = `<p style="font-size: 0.8rem; color: var(--color-text-muted); font-style: italic;">No critical alerts detected.</p>`;
    }
    
    // Render recommended product card
    const recommendedProduct = recommendation.products[0];
    let productCardHtml = "";
    if (recommendedProduct) {
      productCardHtml = `
        <div class="drawer-product-card" style="border: 0.5px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 12px; background: #fafaf9; margin-top: 15px;">
           <span class="product-tag" style="font-size: 0.65rem; background: var(--lloyds-green); color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase;">RECOMMENDED</span>
           <h5 style="font-size: 0.9rem; color: var(--lloyds-navy); margin: 8px 0 4px; font-weight: 600;">${recommendedProduct.name}</h5>
           <p style="color: var(--lloyds-green); font-weight: 700; font-size: 1rem; margin-bottom: 6px;">${recommendedProduct.interest_rate_aer}</p>
           <p style="font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.4; margin-bottom: 8px;">${recommendation.rationale}</p>
        </div>
      `;
    }

    document.getElementById("drawer-content").innerHTML = `
      <!-- Score section -->
      <div class="drawer-section" style="text-align: center; margin-bottom: 25px;">
         <div class="wellbeing-gauge-container mini-gauge" style="margin: 0 auto 15px; position: relative; width: 120px; height: 120px;">
            <svg class="wellbeing-gauge-svg" viewBox="0 0 120 120" style="width: 120px; height: 120px;">
               <circle class="gauge-bg" cx="60" cy="60" r="50" stroke-dasharray="235.62 314.16" style="fill: none; stroke: #e2e8f0; stroke-width: 6; stroke-linecap: round;" />
               <circle class="gauge-fill" cx="60" cy="60" r="50" stroke-dasharray="235.62 314.16" stroke-dashoffset="${targetOffset}" style="fill: none; stroke: ${statusColor}; stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 0.8s ease;" />
            </svg>
            <div class="gauge-text" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
               <div class="gauge-score" style="font-size: 1.8rem; font-weight: 700; color: ${statusColor};">${score}</div>
               <div class="gauge-label" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: ${statusColor}; font-weight: 600;">${derivedTier}</div>
            </div>
         </div>
         <p style="font-size: 0.85rem; line-height: 1.5; color: var(--color-text-main); font-weight: 500; padding: 0 10px; margin: 0;">
            ${report.plain_english_summary}
         </p>
      </div>

      <!-- Financial Signals -->
      <div class="drawer-section" style="margin-bottom: 20px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 15px;">
         <h4 style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); margin-bottom: 12px; font-weight: 600;">AI Signals & Alerts</h4>
         ${signalsHtml}
      </div>

      <!-- Recommended Product -->
      <div class="drawer-section" style="margin-bottom: 25px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 15px;">
         <h4 style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); margin-bottom: 12px; font-weight: 600;">Next Best Action</h4>
         ${productCardHtml}
      </div>

      <!-- Masquerade Action -->
      <div class="drawer-section" style="border-top: 1px solid rgba(0,0,0,0.06); padding-top: 20px; text-align: center;">
         <button class="btn-primary" id="btn-drawer-masquerade" style="width: 100%; background: var(--lloyds-green) !important; font-size: 0.85rem; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i class="fa-solid fa-mask" style="font-size: 14px;"></i> Open Client Workspace
         </button>
      </div>
    `;

    // Bind masquerade CTA
    const masqueradeBtn = document.getElementById("btn-drawer-masquerade");
    if (masqueradeBtn) {
      masqueradeBtn.onclick = () => {
        document.getElementById("admin-detail-drawer").classList.remove("active");
        session.set("customer", custId);
        showView("customerDashboard");
        initCustomerDashboard(custId);
      };
    }
  }

  document.getElementById("btn-close-admin-drawer").onclick = () => {
    document.getElementById("admin-detail-drawer").classList.remove("active");
  };

  // --- CUSTOMER LOGIC ---

  async function initCustomerDashboard(custId) {
    currentCustomerId = custId;
    
    // Reset customer workspace sidebar tabs state
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

  window.switchCustomerTab = (tileType) => {
    const t = document.querySelector(`[data-cust-tile="${tileType}"]`);
    if (t) {
      t.click();
    }
  };

  function animateGauge(targetScore, color, tierName) {
    const fillElem = document.getElementById("wellbeing-gauge-fill");
    const valElem = document.getElementById("wellbeing-gauge-val");
    const tierElem = document.getElementById("wellbeing-gauge-tier");

    if (!fillElem || !valElem || !tierElem) return;

    // Apply colors and labels
    fillElem.style.stroke = color;
    valElem.style.color = color;
    tierElem.textContent = `${tierName} — Healthy`;
    if (tierName === "AMBER") tierElem.textContent = `${tierName} — Caution`;
    if (tierName === "RED") tierElem.textContent = `${tierName} — Needs Action`;
    tierElem.style.color = color;

    // Calculate stroke dash offset
    const maxOffset = 235.62;
    const targetOffset = maxOffset * (1 - targetScore / 100);

    // Slide transition for SVG circle
    setTimeout(() => {
      fillElem.style.strokeDashoffset = targetOffset;
    }, 100);

    // Smooth count-up score values
    let currentScore = 0;
    const duration = 800; // 800ms sweep duration
    const startTime = performance.now();

    function step(timestamp) {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      currentScore = Math.floor(easeProgress * targetScore);
      valElem.textContent = currentScore;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        valElem.textContent = targetScore;
      }
    }

    requestAnimationFrame(step);
  }

  function getDimensionIcon(label) {
    const l = label.toLowerCase();
    if (l.includes("savings")) return "fa-piggy-bank";
    if (l.includes("debt") || l.includes("overdraft")) return "fa-credit-card";
    if (l.includes("spend") || l.includes("budget") || l.includes("stability")) return "fa-chart-pie";
    return "fa-award";
  }

  function getDimensionInsightAndColor(label, score, max) {
    const percentage = (score / max) * 100;
    let insight = "";
    let barColor = "";

    if (percentage >= 80) {
      barColor = "var(--score-green)";
      if (label.toLowerCase().includes("savings")) {
        insight = "3 months emergency fund built";
      } else if (label.toLowerCase().includes("debt") || label.toLowerCase().includes("overdraft")) {
        insight = "Debt-to-income healthy";
      } else if (label.toLowerCase().includes("budget") || label.toLowerCase().includes("spend")) {
        insight = "Spending aligned with income";
      } else {
        insight = "Active ISA opened";
      }
    } else if (percentage >= 50) {
      barColor = "var(--score-amber)";
      if (label.toLowerCase().includes("savings")) {
        insight = "1-2 months emergency fund";
      } else if (label.toLowerCase().includes("debt") || label.toLowerCase().includes("overdraft")) {
        insight = "Moderate credit utilisation";
      } else if (label.toLowerCase().includes("budget") || label.toLowerCase().includes("spend")) {
        insight = "Grocery spend rising";
      } else {
        insight = "Unutilized ISA allowance";
      }
    } else {
      barColor = "var(--score-red)";
      if (label.toLowerCase().includes("savings")) {
        insight = "No emergency cushion";
      } else if (label.toLowerCase().includes("debt") || label.toLowerCase().includes("overdraft")) {
        insight = "Overdraft limits breached";
      } else if (label.toLowerCase().includes("budget") || label.toLowerCase().includes("spend")) {
        insight = "Deficit spending active";
      } else {
        insight = "No ISA opened this year";
      }
    }

    return { insight, barColor, percentage };
  }

  function renderCustomerPortal(result) {
    if (!result) return;
    const { profile, report, signals, recommendation, ai_advice, payload } = result;
    
    // Dynamic Wellbeing Tier and Colors based on Score
    const score = report.score;
    const derivedTier = score >= 80 ? "GREEN" : (score >= 50 ? "AMBER" : "RED");
    const statusColor = score >= 80 ? "var(--score-green)" : (score >= 50 ? "var(--score-amber)" : "var(--score-red)");

    // AI Advisor Card (LLM Integration)
    const aiBox = document.getElementById("ai-advisor-advice");
    if (aiBox && ai_advice) {
       aiBox.innerHTML = `
         <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 15px; border-radius: 12px; border-left: 4px solid #0ea5e9; border-top: 0.5px solid rgba(0,0,0,0.05); border-right: 0.5px solid rgba(0,0,0,0.05); border-bottom: 0.5px solid rgba(0,0,0,0.05); margin-bottom: 25px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #0369a1; font-weight: 600;">
               <i class="fa-solid fa-sparkles" style="font-size: 14px;"></i> AI Financial Copilot
            </div>
            <p style="font-size: 0.95rem; line-height: 1.5; color: #1e293b; margin: 0;">${ai_advice.advice}</p>
            <div style="margin-top: 8px; font-size: 0.7rem; color: #64748b; font-style: italic;">
               Powered by ${ai_advice.model} • Confidence: ${(ai_advice.confidence * 100).toFixed(0)}%
            </div>
         </div>
       `;
    }
    
    // Sidebar greetings
    document.getElementById("sidebar-greeting-name").textContent = profile.name.split(" ")[0];
    const sidebarAvatar = document.getElementById("sidebar-avatar");
    if (sidebarAvatar) {
       sidebarAvatar.textContent = profile.name.charAt(0);
    }
    
    // Left header initials and greeting
    const initialsCircle = document.querySelector(".header-initials-circle");
    if (initialsCircle) {
      initialsCircle.textContent = profile.name ? profile.name.split(" ").map(n => n[0]).join("") : "M";
    }
    const welcomeTitle = document.getElementById("cust-welcome-title");
    if (welcomeTitle) {
      welcomeTitle.textContent = `Welcome back, ${profile.name.split(" ")[0]}`;
    }
    const welcomeSub = document.getElementById("cust-welcome-subtitle");
    if (welcomeSub) {
      welcomeSub.textContent = `Client ID: ${profile.customer_id || currentCustomerId}`;
    }

    // Centre Welcome Header Badges
    const tierPill = document.getElementById("cust-tier-pill");
    if (tierPill) {
      const tierVal = (profile.tier || "NORMAL").toUpperCase();
      tierPill.textContent = tierVal;
      tierPill.className = `status-pill ${tierVal === 'PRIVILEGED' ? 'status-privileged' : 'status-normal'}`;
    }
    const premierPill = document.getElementById("cust-premier-pill");
    if (premierPill) {
       if (profile.premier_flag || profile.premier_eligible) {
          premierPill.style.display = "inline-flex";
       } else {
          premierPill.style.display = "none";
       }
    }

    // Bottom Sidebar status footer badge: e.g. "PRIVILEGED • 84 🟢"
    const sidebarStatus = document.getElementById("sidebar-status-badge");
    if (sidebarStatus) {
      const dotChar = derivedTier === "GREEN" ? "🟢" : (derivedTier === "AMBER" ? "🟡" : "🔴");
      sidebarStatus.innerHTML = `
        <span class="sidebar-footer-tier">${profile.tier}</span>
        <span class="sidebar-footer-divider">•</span>
        <span class="sidebar-footer-score" style="color: ${statusColor}; font-weight: 700;">${score} ${dotChar}</span>
      `;
    }
    
    // Dynamic Earnings & Spending Metrics
    document.getElementById("cust-header-val-balance").textContent = profile.total_balance.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
    if (signals) {
      document.getElementById("cust-header-val-earnings").textContent = signals.avg_monthly_earnings.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
      document.getElementById("cust-header-val-spending").textContent = signals.avg_monthly_spending.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
    }
    
    // Dynamic Status Badge
    const zoneElem = document.getElementById("cust-header-val-zone");
    if (zoneElem) {
      zoneElem.textContent = derivedTier;
      zoneElem.className = `status-zone-badge zone-${derivedTier.toLowerCase()}`;
      zoneElem.style.cssText = `
        background-color: ${statusColor}15;
        color: ${statusColor};
        border: 1px solid ${statusColor}40;
        padding: 6px 16px;
        border-radius: 50px;
        font-weight: bold;
        font-size: 0.95rem;
        display: inline-block;
        letter-spacing: 0.05em;
      `;
    }
    
    // Trigger SVG Gauge Animation
    animateGauge(score, statusColor, derivedTier);

    // Render Banners Stack
    renderProactiveBanner(payload);
    
    // Render Accounts Grid
    const accGrid = document.getElementById("customer-accounts-grid");
    accGrid.innerHTML = "";
    profile.accounts.forEach(a => {
      accGrid.innerHTML += `
        <div class="dashboard-card" style="border: 0.5px solid rgba(0,0,0,0.1); border-radius: 12px; padding: 1.25rem;">
           <strong style="color: var(--lloyds-navy); font-family: var(--font-display); font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">${a.account_type}</strong>
           <div style="font-size: 1.5rem; margin-top: 10px; font-weight: 500; color: var(--lloyds-green);">${a.balance.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}</div>
        </div>
      `;
    });

    // Render Dimension Progress Bars
    const dimBars = document.getElementById("dimensions-progress-bars");
    if (dimBars) {
      dimBars.innerHTML = report.dimensions.map(d => {
        const { insight, barColor, percentage } = getDimensionInsightAndColor(d.label, d.score, d.max);
        const iconName = getDimensionIcon(d.label);
        return `
          <div class="dimension-card-row" style="display: flex; align-items: center; justify-content: space-between; gap: 15px; background: white; border: 0.5px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
             <div style="display: flex; align-items: center; gap: 12px; width: 30%;">
                <i class="fa-solid ${iconName}" style="color: ${barColor}; font-size: 18px; width: 24px; text-align: center;"></i>
                <span style="font-weight: 500; font-size: 0.85rem; color: var(--lloyds-navy);">${d.label}</span>
             </div>
             <div style="flex-grow: 1; display: flex; align-items: center; gap: 15px; width: 45%;">
                <div style="flex-grow: 1; height: 8px; background: var(--lloyds-green-light); border-radius: 4px; overflow: hidden;">
                   <div style="height: 100%; background: ${barColor}; width: 0%; transition: width 0.8s ease;" data-width="${percentage}%"></div>
                </div>
                <span style="font-family: monospace; font-size: 0.85rem; font-weight: 600; color: #475569; width: 45px; text-align: right;">${d.score}/${d.max}</span>
             </div>
             <div style="width: 25%; text-align: right; font-size: 0.8rem; font-weight: 500; color: var(--color-text-muted);">
                "${insight}"
             </div>
          </div>
        `;
      }).join("");
      
      // Animate progress bars
      setTimeout(() => {
        dimBars.querySelectorAll("[data-width]").forEach(el => {
          el.style.width = el.getAttribute("data-width");
        });
      }, 100);
    }

    // Render Wellbeing Action Callouts banner
    const actionContainer = document.getElementById("wellbeing-action-container");
    if (actionContainer) {
      let title = "";
      let desc = "";
      let recProduct = null;
      let supportCardHtml = "";

      if (derivedTier === "GREEN") {
        title = "Keep growing 📈";
        desc = "Your score is in the excellent GREEN tier! Optimize your idle cash with high-efficiency capital market accounts.";
        recProduct = db.products_live.find(p => p.product_id === "PROD_010") || db.products_live.find(p => p.product_id.includes("10")) || db.products_live[0];
      } else if (derivedTier === "AMBER") {
        title = "Improve your score";
        desc = "You're in the AMBER zone. Boost your wellbeing score into the GREEN tier by taking advantage of our structured high-yield saver pots.";
        recProduct = db.products_live.find(p => p.product_id === "PROD_003") || db.products_live.find(p => p.product_id.includes("03")) || db.products_live[0];
      } else {
        title = "Let's get you back on track";
        desc = "Your score is in the RED zone, indicating severe cash flow stress. Let's help you establish a simple, secure emergency buffer.";
        recProduct = db.products_live.find(p => p.product_id === "PROD_001") || db.products_live.find(p => p.product_id.includes("01")) || db.products_live[0];
        
        supportCardHtml = `
          <div class="support-action-card" style="border: 0.5px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 16px; background: #fff5f5; display: flex; gap: 15px; align-items: flex-start; margin-top: 15px;">
             <div style="background: #fee2e2; color: var(--score-red); padding: 10px; border-radius: 50%; font-size: 1.2rem;">
                <i class="fa-solid fa-phone-volume"></i>
             </div>
             <div>
                <h5 style="font-size: 0.9rem; color: var(--lloyds-navy); font-weight: 600; margin-bottom: 4px;">Free Money Advice Session</h5>
                <p style="font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.4; margin-bottom: 8px;">Schedule a 15-minute 1-on-1 coaching call with our financial health team to review budget tools.</p>
                <button class="btn-secondary" style="font-size: 0.75rem; padding: 6px 12px; border-color: var(--score-red) !important; color: var(--score-red) !important; background: transparent;" onclick="alert('Appointment scheduled!')">Book Call</button>
             </div>
          </div>
        `;
      }

      let productCardHtml = "";
      if (recProduct) {
        productCardHtml = `
          <div class="action-product-card" style="border: 0.5px solid rgba(0,0,0,0.1); border-radius: 12px; padding: 20px; background: white; margin-top: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
             <div style="flex-grow: 1; max-width: 70%; text-align: left;">
                <h5 style="font-size: 1rem; color: var(--lloyds-navy); font-weight: 600; margin-bottom: 6px;">${recProduct.name}</h5>
                <p style="font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.5; margin: 0;">${recommendation.rationale || "Optimized for your wellbeing tier."}</p>
             </div>
             <div style="text-align: right; display: flex; flex-direction: column; gap: 10px; align-items: flex-end;">
                <span style="font-size: 0.7rem; background: var(--lloyds-green-light); color: var(--lloyds-green); padding: 4px 10px; border-radius: 4px; font-weight: 600; text-transform: uppercase;">${recProduct.interest_rate_aer}</span>
                <button class="btn-primary" style="font-size: 0.8rem; padding: 8px 16px; background: var(--lloyds-green) !important;" onclick="window.openPurchaseModal('${recProduct.product_id}')">Open Account <i class="fa-solid fa-arrow-right" style="margin-left: 6px; font-size: 11px;"></i></button>
             </div>
          </div>
        `;
      }

      actionContainer.innerHTML = `
        <div style="margin-top: 25px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 20px; text-align: left;">
           <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--lloyds-navy); display: flex; align-items: center; gap: 8px; margin-bottom: 6px; margin-top: 0;">
              <i class="fa-solid fa-circle-nodes" style="color: ${statusColor};"></i> ${title}
           </h4>
           <p style="font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.5; margin-bottom: 10px;">${desc}</p>
           ${productCardHtml}
           ${supportCardHtml}
        </div>
      `;
    }

    // Render Product Showcases
    const prodShowcase = document.getElementById("product-recommendation-showcase");
    prodShowcase.innerHTML = recommendation.products.map(p => `
      <div class="dashboard-card" style="border: 0.5px solid rgba(0,0,0,0.1); border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; text-align: left;">
        <div>
          <h3 style="font-family: var(--font-display); color: var(--lloyds-navy); margin-bottom: 8px; font-size: 16px; font-weight: 500;">${p.name}</h3>
          <p style="color: var(--lloyds-green); font-weight: 700; font-size: 1.15rem; margin-bottom: 12px;">${p.interest_rate_aer}</p>
          <p style="font-size: 0.85rem; margin: 10px 0; line-height: 1.5; color: var(--color-text-muted);">${recommendation.rationale}</p>
        </div>
        <button class="btn-primary" style="margin-top: 15px; width: 100%;" onclick="window.openPurchaseModal('${p.product_id}')">Open Account</button>
      </div>
    `).join("");

    // Render spend breakdown & trend charts
    setTimeout(() => {
      drawSpendBreakdownChart(result.transactions);
      drawSpendTrendChart(profile, result.transactions);
    }, 100);
  }

  function renderProactiveBanner(payload) {
    const container = document.getElementById("proactive-banner-container");
    container.innerHTML = "";
    if (!payload || !payload.banners || payload.banners.length === 0) return;

    payload.banners.forEach(bannerData => {
      const bannerElement = document.createElement("div");
      bannerElement.className = `proactive-banner banner-${bannerData.type}`;
      bannerElement.id = `banner-${bannerData.id}`;
      
      bannerElement.innerHTML = `
        <div class="banner-summary-row">
           <div style="display: flex; gap: 15px; align-items: center;">
              <span style="font-size: 1.5rem;">${bannerData.icon}</span>
              <div style="text-align: left;">
                 <strong style="color: var(--lloyds-navy); font-size: 1rem; font-family: var(--font-display);">${bannerData.headline}</strong>
                 <p class="banner-sub-text" style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px; margin-bottom: 0;">Click to expand insights</p>
              </div>
           </div>
           <div style="display: flex; align-items: center; gap: 15px;">
              <span class="see-more-link" style="font-size: 0.85rem; font-weight: 600; color: var(--lloyds-green); cursor: pointer;">See more ▸</span>
              <button class="btn-dismiss-banner" style="background: none; border: none; font-size: 1.5rem; color: var(--color-text-muted); cursor: pointer; padding: 0 5px; line-height: 1;">×</button>
           </div>
        </div>
        <div class="banner-expand-container">
           <div class="banner-expanded-drawer">
              <ul style="margin-bottom: 20px; padding-left: 20px; font-size: 0.85rem; line-height: 1.6; color: var(--color-text-main); text-align: left;">
                 ${bannerData.bullets.map(b => `<li style="margin-bottom: 8px;">${b}</li>`).join("")}
              </ul>
              ${bannerData.recommendation ? `
                <div style="text-align: left;">
                  <button class="btn-primary" style="font-size: 0.85rem; padding: 10px 20px;" onclick="window.openPurchaseModal('${bannerData.recommendation.product_id}')">
                    ${bannerData.recommendation.cta_label}
                  </button>
                </div>
              ` : ""}
           </div>
        </div>
      `;

      const summaryRow = bannerElement.querySelector(".banner-summary-row");
      const expandContainer = bannerElement.querySelector(".banner-expand-container");
      const seeMoreLink = bannerElement.querySelector(".see-more-link");
      const subText = bannerElement.querySelector(".banner-sub-text");
      const dismissBtn = bannerElement.querySelector(".btn-dismiss-banner");

      summaryRow.onclick = (e) => {
        if (e.target.closest(".btn-dismiss-banner")) return;

        const isExpanded = expandContainer.classList.contains("expanded");
        if (isExpanded) {
          expandContainer.classList.remove("expanded");
          seeMoreLink.textContent = "See more ▸";
          subText.textContent = "Click to expand insights";
        } else {
          expandContainer.classList.add("expanded");
          seeMoreLink.textContent = "Collapse ▴";
          subText.textContent = "Click to collapse insights";
        }
      };

      dismissBtn.onclick = (e) => {
        e.stopPropagation();
        bannerElement.style.opacity = "0";
        bannerElement.style.transform = "translateY(-10px)";
        bannerElement.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        setTimeout(() => {
          bannerElement.remove();
        }, 300);
      };

      container.appendChild(bannerElement);
    });
  }

  window.openPurchaseModal = (prodId) => {
    const product = db.products_live.find(p => p.product_id === prodId);
    if (!product) return;
    document.getElementById("p-modal-title").textContent = `Open ${product.name}`;
    document.getElementById("p-modal-product-name").textContent = product.name;
    document.getElementById("p-modal-rate").textContent = product.interest_rate_aer;
    document.getElementById("purchase-modal").classList.add("active");
    
    const slider = document.getElementById("p-modal-slider");
    const input = document.getElementById("p-modal-input");
    const confirmBtn = document.getElementById("p-modal-confirm");

    // Pre-populate funding details
    const currentAccount = activePipelineResult?.profile?.accounts?.find(a => 
      a.account_type.toLowerCase().includes("current") || a.account_type.toLowerCase().includes("checking")
    );
    const initialBalance = currentAccount ? currentAccount.balance : 0;

    const updateFundingDisplay = (depositVal) => {
      document.getElementById("p-modal-funding-source").textContent = currentAccount ? currentAccount.account_type : "Current Account";
      document.getElementById("p-modal-funding-balance").textContent = initialBalance.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
      document.getElementById("p-modal-debit-amount").textContent = `-${depositVal.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}`;
      
      const newBal = Math.max(0, initialBalance - depositVal);
      document.getElementById("p-modal-new-balance").textContent = newBal.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
    };

    slider.min = 25; slider.max = 500; slider.value = 50;
    input.value = 50;
    updateFundingDisplay(50);

    // Confirm button is always active because AI key is pre-injected in backend
    confirmBtn.disabled = false;

    slider.oninput = () => {
      input.value = slider.value;
      updateFundingDisplay(parseFloat(slider.value));
    };

    input.oninput = () => {
      let val = parseFloat(input.value);
      if (isNaN(val)) val = 0;
      slider.value = Math.min(500, Math.max(25, val));
      updateFundingDisplay(val);
    };

    confirmBtn.onclick = async () => {
      document.getElementById("purchase-modal").classList.remove("active");
      const depositVal = parseFloat(input.value);
      
      const confirmation = await pipeline.runAgent6(currentCustomerId, prodId, depositVal);
      if (confirmation.success) {
        // Calculate wellbeing score variance
        const oldScore = activePipelineResult ? activePipelineResult.report.score : 0;
        const newScore = confirmation.updatedState.report.score;
        const scoreChange = newScore - oldScore;

        let scoreChangeHtml = "";
        if (scoreChange > 0) {
          scoreChangeHtml = `<p class="success-score-change" style="color: var(--score-green); font-weight:600; margin-top:10px;"><i class="fa-solid fa-circle-arrow-up"></i> Your wellbeing score increased by <strong>+${scoreChange}</strong> points! (New Score: <strong>${newScore}</strong>)</p>`;
        } else {
          scoreChangeHtml = `<p class="success-score-change" style="color: var(--color-text-muted); margin-top:10px;">Your wellbeing score is updated to <strong>${newScore}</strong>.</p>`;
        }

        document.getElementById("success-modal-body").innerHTML = `
          <div style="text-align: left; display: flex; flex-direction: column; gap: 8px;">
             <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--color-text-muted);">Account Type:</span><span style="font-weight:600; color:var(--lloyds-navy);">${product.name}</span></div>
             <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--color-text-muted);">Opening Deposit:</span><span style="font-weight:600; color:var(--lloyds-green);">£${depositVal.toFixed(2)}</span></div>
             <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--color-text-muted);">Reference:</span><span style="font-family:monospace; font-weight:600;">${confirmation.confirmation_ref || "PY_AUTO_81729"}</span></div>
             <div style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="color:var(--color-text-muted);">Estimated Interest Date:</span><span style="font-weight:600;">25 July 2026</span></div>
             <div style="height:0.5px; background:rgba(0,0,0,0.1); margin:10px 0;"></div>
             ${scoreChangeHtml}
          </div>
        `;
        document.getElementById("success-modal").classList.add("active");
        
        // Refresh local cache and UI
        activePipelineResult = confirmation.updatedState;
        renderCustomerPortal(confirmation.updatedState);
      } else {
        alert("Transaction Failed: " + confirmation.error);
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
    let month = 5; // June 2026
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
        if (!dataByMonthAndCategory[monthKey]) return;

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
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: "circle",
              color: "#334155",
              font: { family: "Inter", size: 11 }
            }
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
          x: {
            stacked: true,
            grid: { display: false },
            title: {
              display: true,
              text: "Billing Cycles / Months",
              color: "#334155",
              font: { family: "Outfit", size: 11, weight: "bold" }
            }
          },
          y: {
            stacked: true,
            ticks: { callback: value => "£" + value },
            title: {
              display: true,
              text: "Total Transaction Volume (£)",
              color: "#334155",
              font: { family: "Outfit", size: 11, weight: "bold" }
            }
          }
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
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const pct = totalSpending > 0 ? ((context.raw / totalSpending) * 100).toFixed(0) : 0;
                return `${context.label}: £${context.raw.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pct}%)`;
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
          <div style="margin-bottom: 8px; text-align: left;">
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

  // Navigation tiles
  const navTiles = document.querySelectorAll(".nav-tile");
  navTiles.forEach(t => {
    t.onclick = (e) => {
      // 1. Check for Signout
      if (t.id === "btn-customer-signout") {
        console.log("Customer Signout clicked.");
        session.clear();
        window.location.href = "/";
        return;
      }

      const tileType = t.getAttribute("data-cust-tile");
      if (!tileType) return;
      
      // 2. Intercept and Redirect Trends/Spending Insights to Overview
      let finalTileType = tileType;
      let shouldScrollToCharts = false;
      if (tileType === "trends") {
        finalTileType = "overview";
        shouldScrollToCharts = true;
      }

      document.querySelectorAll(".nav-tile").forEach(n => n.classList.remove("active"));
      const targetNavTile = document.querySelector(`.nav-tile[data-cust-tile="${finalTileType}"]`);
      if (targetNavTile) {
        targetNavTile.classList.add("active");
      } else {
        t.classList.add("active");
      }
      
      const panels = document.querySelectorAll(".viewport-panel");
      panels.forEach(p => p.classList.remove("active"));

      const targetPanel = document.getElementById(`panel-${finalTileType}`);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }

      // Render correct charts on switch
      if ((tileType === "trends" || tileType === "overview") && activePipelineResult) {
        setTimeout(() => {
          drawSpendTrendChart(activePipelineResult.profile, activePipelineResult.transactions);
          drawSpendBreakdownChart(activePipelineResult.transactions);
        }, 50);
      } else if (tileType === "wellbeing" && activePipelineResult) {
        setTimeout(() => {
          drawSpendBreakdownChart(activePipelineResult.transactions);
        }, 50);
      }

      // 3. Smooth scroll down to charts section if trends was clicked
      if (shouldScrollToCharts) {
        setTimeout(() => {
          const chartsSection = document.querySelector(".overview-charts-columns-grid");
          if (chartsSection) {
            chartsSection.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }

      // 4. Auto-collapse sidebar on click only on mobile viewports (< 1024px)
      const sidebar = document.getElementById("customer-portal-sidebar");
      if (sidebar && window.innerWidth < 1024) {
        sidebar.classList.add("sidebar-collapsed");
      }
    };
  });
});
