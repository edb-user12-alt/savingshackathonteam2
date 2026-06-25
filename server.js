const express = require('express');
const path = require('path');
const { BigQuery } = require('@google-cloud/bigquery');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;
const bigquery = new BigQuery();
const DATASET_ID = 'lloyds_financial_wellbeing';

app.use(express.static(__dirname));
app.use(bodyParser.json({ limit: '10mb' }));

// API to push data to BigQuery
app.post('/api/push-to-bq', async (req, res) => {
  const { customers, accounts, transactions } = req.body;
  try {
    if (customers && customers.length) {
      await bigquery.dataset(DATASET_ID).table('customers').insert(customers);
    }
    if (accounts && accounts.length) {
      await bigquery.dataset(DATASET_ID).table('accounts').insert(accounts);
    }
    if (transactions && transactions.length) {
      await bigquery.dataset(DATASET_ID).table('transactions').insert(transactions);
    }
    res.status(200).send({ message: 'Data pushed to BigQuery successfully' });
  } catch (error) {
    console.error('BigQuery Insert Error:', error);
    res.status(500).send({ error: error.message });
  }
});

// Main entry point
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Lloyds Wellbeing AI Server running on port ${PORT}`);
});
