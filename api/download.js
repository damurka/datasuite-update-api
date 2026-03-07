import { getLatestJSON, sendJson, validateInput } from '../lib/update-feed.js';

export default async function handler(req, res) {
  try {
    if (req.method && req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Method Not Allowed' });
    }

    const urlObj = new URL(req.url, `https://${req.headers.host}`);
    const params = urlObj.searchParams;

    const platform = params.get('platform');
    const quality = params.get('quality');

    const input = validateInput(platform, quality);

    if (!input) {
      return sendJson(res, 400, {
        error: 'Invalid platform/quality combination'
      });
    }

    const latest = await getLatestJSON(input);

    res.setHeader('Cache-Control', 's-maxage=14400');

    if (!latest || !latest.url) {
      return sendJson(res, 404, {
        error: 'No release metadata found'
      });
    }

    // Redirect to the latest binary
    res.statusCode = 302;
    res.setHeader('Location', latest.url);
    return res.end();
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Download redirect API error:', e);
    }
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}