const fs = require('fs');
const BigQuerySimulation = require('../database.js');

const db = new BigQuerySimulation();

console.log(`Generated ${db.customers.length} customers.`);
console.log(`Generated ${db.accounts.length} accounts.`);
console.log(`Generated ${db.transactions.length} transactions.`);

// Save to JSONL for BQ
fs.writeFileSync('scratch/customers.json', db.customers.map(c => JSON.stringify(c)).join('\n'));
fs.writeFileSync('scratch/accounts.json', db.accounts.map(a => JSON.stringify(a)).join('\n'));
fs.writeFileSync('scratch/transactions.json', db.transactions.map(t => JSON.stringify(t)).join('\n'));
fs.writeFileSync('scratch/products.json', db.products_live.map(p => JSON.stringify(p)).join('\n'));

console.log("Data files generated in scratch/");
