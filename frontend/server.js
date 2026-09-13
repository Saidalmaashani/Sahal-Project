/* خادم static صغير للواجهة (بدون مكتبات خارجية)
   يقدّم مجلد build مع رؤوس أمنية إجبارية (CSP/HSTS/X-Frame/Referrer). */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'build');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; " +
    "font-src 'self' data:; connect-src 'self' https://sahal-project.onrender.com wss://sahal-project.onrender.com; " +
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const headers = { ...SECURITY_HEADERS, 'Content-Type': type };
  const longCache = ext === '.js' || ext === '.css' || ext === '.font' || ext === '.woff' || ext === '.woff2';
  if (longCache && /[0-9a-f]{8,}\.(js|css)/.test(path.basename(filePath))) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'no-cache';
  }
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    send(res, 200, data, headers);
  });
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) return serveFile(res, filePath);
    // SPA fallback — أي مسار لا يمثل ملفاً يعيد index.html (عدا أصول static)
    if (urlPath.startsWith('/static/') || path.extname(urlPath)) {
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    }
    serveFile(res, path.join(ROOT, 'index.html'));
  });
}).listen(PORT, () => {
  console.log(`Sahal frontend serving ${ROOT} on ${PORT}`);
});