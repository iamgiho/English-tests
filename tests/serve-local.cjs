// Local browser QA: use the real app and data, with external integrations disabled.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/google-config.js') {
    res.setHeader('Content-Type', 'application/javascript');
    return res.end('window.GOOGLE_INTEGRATION = { passage: {}, word: {}, writing: {}, sheetCsvUrl: "" };');
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end(); }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.txt': 'text/plain' };
    res.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  });
}).listen(8877, '127.0.0.1', () => console.log('QA: http://127.0.0.1:8877 (external integrations disabled)'));
