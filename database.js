/**
 * Lloyds Financial Wellbeing AI - Synthetic Database (API Wrapper)
 * This script now syncs with the Python/FastAPI backend to get the ground truth data.
 */

class BigQuerySimulation {
  constructor() {
    this.customers = [];
    this.accounts = [];
    this.transactions = [];
    this.products_live = [];
    this.banners = [];
    this.isLoaded = false;
  }

  async sync() {
    console.log("Syncing with Python BigQuery Simulator...");
    try {
      const response = await fetch('/api/db');
      if (!response.ok) throw new Error("Database sync failed.");
      const data = await response.json();
      this.customers = data.customers;
      this.accounts = data.accounts;
      this.products_live = data.products_live;
      this.isLoaded = true;
      console.log("Database Sync Complete. Records loaded:", this.customers.length);
    } catch (err) {
      console.error("Sync Error:", err);
    }
  }

  // Helper to maintain compatibility with legacy code until fully migrated
  getTransactionsForCustomer(customer_id) {
    // Note: Transactions are huge, we don't sync all of them at once.
    // In a real app, this would be an API call. For the demo, we'll fetch them as needed.
    return []; 
  }

  // Agent 6 actions are handled via the AgentPipeline wrapper now.
}

window.BigQuerySimulation = BigQuerySimulation;
