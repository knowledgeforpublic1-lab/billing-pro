// Local dev server:  node server.js  ->  http://localhost:3000
// (Vercel deploy par api/index.js serverless function ki tarah chalta hai)
require('dotenv').config();
const express = require('express');
const path = require('path');
const apiApp = require('./api/index.js');

const https = require('https');

const app = express();

// API routes (/api/billing) — helmet/rate-limit/auth api/index.js ke andar.
// IMPORTANT: apiApp ko sirf /api/* par chalao. Agar local MONGODB_URI nahi hai,
// to live Vercel backend se transparently proxy karo taaki local dev me sabhi
// MongoDB bills, 62 contractors aur sync seamless chalein.
app.use((req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    if (process.env.MONGODB_URI) {
      return apiApp(req, res, next);
    }
    const targetUrl = 'https://billing-pro-dusky.vercel.app' + req.originalUrl;
    const clientReq = https.request(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: 'billing-pro-dusky.vercel.app'
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    clientReq.on('error', (err) => {
      console.error('Local proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Backend proxy error', details: err.message });
      }
    });
    req.pipe(clientReq);
    return;
  }
  next();
});

// Static frontend — poora folder serve MAT karo (xlsx/json/pdf/env leak hote hain).
// Sirf index.html serve karo; sensitive extensions/data files hard-block.
app.get(/^\/(?!api\/).*\.(xlsx|xls|json|pdf|txt|bat|env)$/i, (req, res) => res.status(403).send('Forbidden'));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
// Alag mobile page — desktop index.html ko haath lagaye bina
app.get(['/mobile', '/mobile.html'], (req, res) => res.sendFile(path.join(__dirname, 'mobile.html')));
app.use('/js', (req, res, next) => {
  if (req.url.includes('/data/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
}, express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use((req, res, next) => {
  let p = '';
  try { p = decodeURI(req.url); } catch(e) { p = req.url; }
  if (p.startsWith('/Reconciliation master')) {
    if (p.includes('upload.php') || /\/data\.(js|json)$/i.test(p)) {
      return res.status(403).send('Forbidden: data scripts are blocked.');
    }
    return express.static(path.join(__dirname, 'Reconciliation master'))(
      Object.assign(req, { url: p.replace('/Reconciliation master', '') || '/' }),
      res,
      next
    );
  }
  next();
});
// (dead /style.css route removed — style.css file hi nahi hai, css/ folder static serve hota hai)

app.use('/demo', express.static(path.join(__dirname, 'sap-ui-demo')));
app.get(['/old', '/old/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Billing Pro local: http://localhost:${PORT}`));
