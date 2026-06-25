/**
 * Lloyds Financial Wellbeing AI - 6-Agent Orchestration Pipeline (API Wrapper)
 * This script now calls the Python/FastAPI backend to orchestrate the 6 agents.
 */

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
    console.log(`[${agentName}] ${message}`);
  }

  clearLog() {
    this.activityLog = [];
  }

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
      
      // Import logs from backend
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
      
      return {
        success: true,
        updatedState: result.updated_state
      };
    } catch (err) {
      this.log("Orchestrator", `Purchase Failed: ${err.message}`, "error");
      return { success: false, error: err.message };
    }
  }
}

window.AgentPipeline = AgentPipeline;
