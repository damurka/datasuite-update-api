/*
Should download the version JSON file from the VSCodium repo
the JSON file should conform to this schema:
{
  "url": "<url to release download>",
  "name": "1.33.1", // the version number
  "version": "51b0b28134d51361cf996d2f0a1c698247aeabd8", // the latest commit hash
  "productVersion": "1.0.0", // the version number
  "hash": "cb4109f196d23b9d1e8646ce43145c5bb62f55a8", // sha1 of the release download
  "timestamp": 1554971059007,
  "sha256hash": "ac2a1c8772501732cd5ff539a04bb4dc566b58b8528609d2b34bbf970d08cf01" // sha256 of the release download
}
The hashes can be ignored by this api/lambda -- we are only concerned with whether
the commit hash in the url parameter matches the "version" identifier in the above payload
*/

const INSIDER = 'insider';
const STABLE = 'stable';

const DARWIN = 'darwin';
const WINDOWS = 'win32';
const LINUX = 'linux';

const ARM64 = 'arm64';
const IA32 = 'ia32';
const X64 = 'x64';

const SYSTEM = 'system';
const ARCHIVE = 'archive';
const USER = 'user';

const QUALITIES = new Set([INSIDER, STABLE]);
const OS = new Set([DARWIN, LINUX, WINDOWS]);
const TYPES = new Set([ARCHIVE, USER, SYSTEM]);
const ARCH = new Set([ARM64, IA32, X64]);

const VERSION_BASE_URL =
  'https://raw.githubusercontent.com/aphrcwaro/datasuite_public/main';

// Build the URL to latest.json for a given platform/quality combination
const buildVersionUrl = ({ quality, os, arch, type }) => {
  let path = `${quality}/${os}/${arch}`;
  if (type) path += `/${type}`;
  return `${VERSION_BASE_URL}/${path}/latest.json`;
};

const getLatestJSON = async (input) => {
  const url = buildVersionUrl(input);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      // 404 from GitHub or other error => treat as "no update info"
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;

    return data;
  } catch (e) {
    // Network or other failure => treat as "no update info"
    return null;
  }
};

// returns false if invalid, or an object of { quality, os, arch, type } if valid
const validateInput = (platform, quality) => {
  if (!quality || !QUALITIES.has(quality)) return false;
  if (!platform || typeof platform !== 'string') return false;

  let [os, arch, type] = platform.split('-');
  if (!OS.has(os)) return false;

  if (os === WINDOWS) {
    if (!type) {
      if (!arch) {
        // win32 => default arch + type
        type = SYSTEM;
        arch = IA32;
      } else if (TYPES.has(arch)) {
        // win32-archive / win32-user / win32-system => interpret as type with default arch
        type = arch;
        arch = IA32;
      } else {
        // win32-x64 => default type system
        type = SYSTEM;
      }
    }

    if (!TYPES.has(type)) return false;
  } else if (os === DARWIN) {
    if (!arch) arch = X64; // default to x64 if not specified
  }

  if (!ARCH.has(arch)) return false;

  return { quality, os, arch, type };
};

const sendNoContent = (res) => {
  res.statusCode = 204;
  res.end();
};

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

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
