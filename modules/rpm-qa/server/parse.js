/**
 * Semicolon-delimited CSV parser for RPM component metadata.
 *
 * Handles the BugZilla component export format where fields are separated
 * by semicolons and the first row is the header.
 *
 * Limitations intentionally omitted for PoC simplicity:
 * - No quoted-field support (fields are assumed not to contain semicolons)
 * - No multi-line field support
 */

/**
 * Parse a semicolon-delimited CSV string into an array of objects.
 *
 * @param {string} text - Raw CSV text with semicolon delimiters
 * @returns {{ headers: string[], records: object[] }}
 */
function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trimEnd())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = lines[0].split(';').map(h => h.trim());

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(';');
    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = j < fields.length ? fields[j].trim() : '';
    }
    records.push(record);
  }

  return { headers, records };
}

module.exports = { parseCsv };
