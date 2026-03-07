import { getLatestJSON, validateInput, sendNoContent, sendJson } from '../lib/update-feed.js';

export default async function handler(req, res) {
  try {
    // Only GET requests are allowed
    if (req.method && req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Method Not Allowed' });
    }

    const urlObj = new URL(req.url, `https://${req.headers.host}`);
    const params = urlObj.searchParams;

    const platform = params.get('platform');
    const quality = params.get('quality');
    const commit = params.get('commit');
    console.log(platform)
    console.log(quality)

    const input = validateInput(platform, quality);

    // Invalid combination → 404 for the updater (same as before)
    if (!input) {
      res.statusCode = 404;
      return res.end();
    }

    const latest = await getLatestJSON(input);

    // Cache in Vercel's edge for 4 hours
    res.setHeader('Cache-Control', 's-maxage=14400');

    // No JSON or already up-to-date → 204 No Content (VS Code expects this)
    if (!latest || commit === latest.version) {
      return sendNoContent(res);
    }

    // There is a newer version → return the version JSON as-is
    return sendJson(res, 200, latest);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Update API error:', e);
    }
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}