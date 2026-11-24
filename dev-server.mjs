import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 4173);

const ROUTE_MAP = {
  '/': 'tidly-notebook.html',
  '/index.html': 'tidly-notebook.html',
  '/tidly-notebook.html': 'tidly-notebook.html',
  '/ogretmen': 'tidly-ogretmen.html',
  '/tidly-ogretmen.html': 'tidly-ogretmen.html',
  '/doktor': 'tidly-doktor.html',
  '/tidly-doktor.html': 'tidly-doktor.html',
  '/asci': 'tidly-asci.html',
  '/tidly-asci.html': 'tidly-asci.html',
  '/ogrenci': 'tidly-ogrenci.html',
  '/tidly-ogrenci.html': 'tidly-ogrenci.html'
};

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  const file = ROUTE_MAP[url];
  if (file) {
    const htmlPath = path.resolve('dist', file);
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('dist/' + file + ' not found. Run npm run build first.');
      return;
    }
    const content = fs.readFileSync(htmlPath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(content);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Tidly Notebook dev server listening at http://127.0.0.1:${PORT}/`);
});
