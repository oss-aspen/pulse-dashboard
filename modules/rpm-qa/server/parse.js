/**
 * RFC 4180-compliant delimited-text parser.
 *
 * Defaults to comma(`,`) as the field delimiter
 * but accepts any single-character delimiter via the
 * options argument (e.g. `{ delimiter: ';' }` for bugzilla CSV).
 *
 * Quoted-field rules (RFC 4180):
 * - Fields may be wrapped in double-quotes.
 * - A quoted field may contain the delimiter character, bare newlines
 *   (LF/CRLF), and escaped double-quotes (represented as "").
 * - Unquoted field values are trimmed of leading/trailing whitespace.
 * - Quoted field values are returned verbatim (no trimming); CRLF inside
 *   a quoted field is normalised to LF.
 */

/**
 * Parse a delimited text string into an array of objects.
 *
 * @param {string} text - Raw delimited text (first row is treated as the header)
 * @param {{ delimiter?: string }} [options]
 * @param {string} [options.delimiter=';'] - Single-character field delimiter
 * @returns {{ headers: string[], records: object[] }}
 */
function parseCsv(text, { delimiter = ',' } = {}) {
  if (delimiter.length !== 1) {
    throw new Error('delimiter must be a single character');
  }

  const len = text.length;
  let i = 0;

  // Skip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) i++;

  /**
   * Consume and return the next field starting at position i.
   * Advances i past the field content (but not past the following delimiter
   * or line ending).
   */
  function parseField() {
    if (i < len && text[i] === '"') {
      // Quoted field — content ends at the matching closing quote.
      i++; // consume opening quote
      let field = '';
      while (i < len) {
        const ch = text[i];
        if (ch === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            // Escaped double-quote inside a quoted field
            field += '"';
            i += 2;
          } else {
            i++; // consume closing quote
            break;
          }
        } else if (ch === '\r' && i + 1 < len && text[i + 1] === '\n') {
          // Normalise CRLF → LF inside quoted fields
          field += '\n';
          i += 2;
        } else {
          field += ch;
          i++;
        }
      }
      return field;
    }

    // Unquoted field — read until the next delimiter, CR, LF, or end-of-input.
    let field = '';
    while (i < len && text[i] !== delimiter && text[i] !== '\r' && text[i] !== '\n') {
      field += text[i++];
    }
    return field.trim();
  }

  /**
   * Parse one complete record (one or more fields) starting at position i.
   * Advances i past the trailing line ending.
   */
  function parseRecord() {
    const fields = [parseField()];
    while (i < len && text[i] === delimiter) {
      i++; // consume field delimiter
      fields.push(parseField());
    }
    // Consume the line ending that terminates this record
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;
    return fields;
  }

  const rawRecords = [];
  while (i < len) {
    // Skip blank lines that fall between records
    if (text[i] === '\r' || text[i] === '\n') {
      if (text[i] === '\r') i++;
      if (i < len && text[i] === '\n') i++;
      continue;
    }
    rawRecords.push(parseRecord());
  }

  if (rawRecords.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rawRecords[0];
  const records = [];
  for (let r = 1; r < rawRecords.length; r++) {
    const fields = rawRecords[r];
    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = j < fields.length ? fields[j] : '';
    }
    records.push(record);
  }

  return { headers, records };
}

module.exports = { parseCsv };
