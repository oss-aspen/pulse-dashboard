const { parseCsv } = require('./parse');

const STORAGE_KEY = 'rpm-qa/components.json';

/**
 * In-memory cache of parsed component records.
 * Re-populated on startup and after each admin upload.
 * @type {{ records: object[], headers: string[], loadedAt: string|null }}
 */
const cache = {
  records: [],
  headers: [],
  loadedAt: null,
};

/**
 * Load (or reload) the component data from storage into the in-memory cache.
 * @param {object} storage - Module storage context
 */
function loadFromStorage(storage) {
  try {
    const stored = storage.readFromStorage(STORAGE_KEY);
    if (!stored || !Array.isArray(stored.records)) return;
    cache.records = stored.records;
    cache.headers = stored.headers || [];
    cache.loadedAt = stored.savedAt || null;
    console.log(`[rpm-qa] Loaded ${cache.records.length} component records from storage`);
  } catch (err) {
    console.error('[rpm-qa] Failed to load components from storage:', err.message);
  }
}

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;

  // ── Startup load ─────────────────────────────────────────────────────────

  loadFromStorage(storage);

  // ── Routes ───────────────────────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/rpm-qa/components:
   *   get:
   *     tags: [RPM QA Lookup]
   *     summary: Return all parsed component records
   *     responses:
   *       200:
   *         description: Component list with all metadata fields
   */
  router.get('/components', function(req, res) {
    res.json({
      records: cache.records,
      headers: cache.headers,
      total: cache.records.length,
      loadedAt: cache.loadedAt,
    });
  });

  /**
   * @openapi
   * /api/modules/rpm-qa/upload:
   *   post:
   *     tags: [RPM QA Lookup]
   *     summary: Upload a semicolon-delimited CSV to replace component data (admin only)
   *     requestBody:
   *       required: true
   *       content:
   *         text/plain:
   *           schema:
   *             type: string
   *     responses:
   *       200:
   *         description: Upload result with record count
   *       400:
   *         description: Parse error or empty file
   */
  router.post('/upload', requireAdmin, function(req, res) {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body.trim()) {
        return res.status(400).json({ error: 'Empty file' });
      }
      try {
        const { headers, records } = parseCsv(body);
        if (records.length === 0) {
          return res.status(400).json({ error: 'No data rows found after header' });
        }

        const savedAt = new Date().toISOString();
        storage.writeToStorage(STORAGE_KEY, { headers, records, savedAt });

        cache.records = records;
        cache.headers = headers;
        cache.loadedAt = savedAt;

        console.log(`[rpm-qa] Uploaded and saved ${records.length} component records`);
        res.json({
          success: true,
          total: records.length,
          headers,
          loadedAt: savedAt,
        });
      } catch (err) {
        console.error('[rpm-qa] Upload parse error:', err.message);
        res.status(400).json({ error: 'Failed to parse CSV: ' + err.message });
      }
    });
  });

  // ── Diagnostics ───────────────────────────────────────────────────────────

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      return {
        recordCount: cache.records.length,
        headers: cache.headers,
        loadedAt: cache.loadedAt,
        dataAvailable: cache.records.length > 0,
      };
    });
  }

  // ── Export hook ───────────────────────────────────────────────────────────

  if (context.registerExport) {
    context.registerExport(async function(addFile, exportStorage) {
      const stored = exportStorage.readFromStorage(STORAGE_KEY);
      if (!stored) return;
      // Component metadata contains no PII — export as-is
      addFile(STORAGE_KEY, stored);
    });
  }
};
