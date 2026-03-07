import http from 'node:http';
import updateHandler from './api/update.js';
import downloadHandler from './api/download.js';

const port = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/api/update') {
      return await updateHandler(req, res);
    }

    if (path === '/api/download') {
      return await downloadHandler(req, res);
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Not Found' }));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});