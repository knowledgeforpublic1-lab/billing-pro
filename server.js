// Local dev server:  node server.js  ->  http://localhost:3000
// (Vercel deploy par api/index.js serverless function ki tarah chalta hai)
require('dotenv').config();
const express = require('express');
const path = require('path');
const apiApp = require('./api/index.js');

const app = express();

// API routes (/api/billing) — helmet/rate-limit/auth api/index.js ke andar
app.use(apiApp);

// Static frontend — poora folder serve MAT karo (xlsx/json/pdf/env leak hote hain).
// Sirf index.html serve karo; sensitive extensions/data files hard-block.
app.get(/^\/(?!api\/).*\.(xlsx|xls|json|pdf|txt|bat|env)$/i, (req, res) => res.status(403).send('Forbidden'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
// Alag mobile page — desktop index.html ko haath lagaye bina
app.get(['/mobile', '/mobile.html'], (req, res) => res.sendFile(path.join(__dirname, 'mobile.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Billing Pro local: http://localhost:${PORT}`));
