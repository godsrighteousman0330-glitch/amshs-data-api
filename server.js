const http = require('http');
const { MongoClient, ObjectId } = require('mongodb');

// ── Config ──────────────────────────────────────────────────────────
const PORT       = process.env.PORT || 8080;
const API_KEY    = process.env.API_KEY || 'amshs-secret-key-2026';
const MONGO_URI  = process.env.MONGODB_URI;
const DB_NAME    = process.env.DB_NAME || 'amshs_portal';

if (!MONGO_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  process.exit(1);
}

// ── MongoDB client ───────────────────────────────────────────────────
let client;
async function getDb() {
  if (!client || !client.topology?.isConnected()) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('Connected to MongoDB Atlas');
  }
  return client.db(DB_NAME);
}

// ── Helper: parse body ───────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ── Helper: send JSON ────────────────────────────────────────────────
function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'Content-Type, x-api-key',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
  });
  res.end(json);
}

// ── Convert filter $oid strings to ObjectId ──────────────────────────
function resolveIds(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.$oid) return new ObjectId(obj.$oid);
  const out = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) out[k] = resolveIds(obj[k]);
  return out;
}

// ── Main handler ─────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    });
    return res.end();
  }

  // Health check
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    return res.end('AMSHS Data API is running ✓');
  }

  // Auth check
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) return send(res, 401, { error: 'Unauthorized' });

  // Route: POST /action/<action>
  const match = req.url.match(/^\/action\/(\w+)$/);
  if (!match || req.method !== 'POST') return send(res, 404, { error: 'Not found' });

  const action = match[1];

  try {
    const body       = await parseBody(req);
    const db         = await getDb();
    const collection = db.collection(body.collection || 'employees');

    let result;

    if (action === 'find') {
      const filter  = resolveIds(body.filter || {});
      const options = {};
      if (body.sort)  options.sort  = body.sort;
      if (body.limit) options.limit = body.limit;
      if (body.skip)  options.skip  = body.skip;
      const docs = await collection.find(filter, options).toArray();
      result = { documents: docs };

    } else if (action === 'findOne') {
      const doc = await collection.findOne(resolveIds(body.filter || {}));
      result = { document: doc };

    } else if (action === 'insertOne') {
      const r = await collection.insertOne(body.document || {});
      result = { insertedId: r.insertedId };

    } else if (action === 'insertMany') {
      const r = await collection.insertMany(body.documents || []);
      result = { insertedCount: r.insertedCount };

    } else if (action === 'updateOne') {
      const r = await collection.updateOne(
        resolveIds(body.filter || {}),
        resolveIds(body.update || {}),
        { upsert: body.upsert || false }
      );
      result = { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount };

    } else if (action === 'deleteOne') {
      const r = await collection.deleteOne(resolveIds(body.filter || {}));
      result = { deletedCount: r.deletedCount };

    } else if (action === 'aggregate') {
      const docs = await collection.aggregate(body.pipeline || []).toArray();
      result = { documents: docs };

    } else {
      return send(res, 400, { error: `Unknown action: ${action}` });
    }

    send(res, 200, result);

  } catch (err) {
    console.error('Error:', err.message);
    send(res, 500, { error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`AMSHS Data API running on 0.0.0.0:${PORT}`);
});
