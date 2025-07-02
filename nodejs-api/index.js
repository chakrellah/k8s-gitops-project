require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Connect to PostgreSQL using env variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`NodeJS API listening on port ${port}`);
});
