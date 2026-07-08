const { describe, it, expect } = require('vitest')
const { parseCsv } = require('../../server/parse')

describe('parseCsv', () => {
  it('parses a simple semicolon-delimited file', () => {
    const csv = [
      'Component;Product;QA Contact;Active',
      'kernel;RHEL;qa@example.com;True',
      'glibc;RHEL;qa2@example.com;True',
    ].join('\n')

    const { headers, records } = parseCsv(csv)

    expect(headers).toEqual(['Component', 'Product', 'QA Contact', 'Active'])
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      'Component': 'kernel',
      'Product': 'RHEL',
      'QA Contact': 'qa@example.com',
      'Active': 'True',
    })
  })

  it('handles Windows CRLF line endings', () => {
    const csv = 'Component;Product\r\nkernel;RHEL\r\n'
    const { records } = parseCsv(csv)
    expect(records).toHaveLength(1)
    expect(records[0]['Component']).toBe('kernel')
  })

  it('trims whitespace from field values', () => {
    const csv = 'Component;QA Contact\n kernel ; qa@example.com '
    const { records } = parseCsv(csv)
    expect(records[0]['Component']).toBe('kernel')
    expect(records[0]['QA Contact']).toBe('qa@example.com')
  })

  it('returns empty arrays for empty input', () => {
    const { headers, records } = parseCsv('')
    expect(headers).toEqual([])
    expect(records).toEqual([])
  })

  it('returns empty records array when only header row is present', () => {
    const { headers, records } = parseCsv('Component;Product;QA Contact')
    expect(headers).toHaveLength(3)
    expect(records).toHaveLength(0)
  })

  it('fills missing trailing fields with empty string', () => {
    const csv = 'Component;Product;QA Contact\nkernel'
    const { records } = parseCsv(csv)
    expect(records[0]['Product']).toBe('')
    expect(records[0]['QA Contact']).toBe('')
  })

  it('ignores blank lines', () => {
    const csv = 'Component;Product\nkernel;RHEL\n\n\nglibc;RHEL\n'
    const { records } = parseCsv(csv)
    expect(records).toHaveLength(2)
  })

  // --- RFC 4180 quoted-field tests ---

  it('parses a quoted field containing an embedded newline', () => {
    const csv = 'Component;Description\nkernel;"First line\nSecond line"'
    const { records } = parseCsv(csv)
    expect(records).toHaveLength(1)
    expect(records[0]['Component']).toBe('kernel')
    expect(records[0]['Description']).toBe('First line\nSecond line')
  })

  it('parses a quoted field containing an embedded CRLF (normalised to LF)', () => {
    const csv = 'Component;Description\r\nkernel;"First line\r\nSecond line"\r\n'
    const { records } = parseCsv(csv)
    expect(records).toHaveLength(1)
    expect(records[0]['Description']).toBe('First line\nSecond line')
  })

  it('parses a quoted field containing the semicolon delimiter', () => {
    const csv = 'Component;Description\nnetwork;"TCP; UDP; and SCTP support"'
    const { records } = parseCsv(csv)
    expect(records).toHaveLength(1)
    expect(records[0]['Description']).toBe('TCP; UDP; and SCTP support')
  })

  it('parses escaped double-quotes inside a quoted field', () => {
    const csv = 'Component;Description\nkernel;"Supports ""live"" patching"'
    const { records } = parseCsv(csv)
    expect(records).toHaveLength(1)
    expect(records[0]['Description']).toBe('Supports "live" patching')
  })

  it('does not trim content inside quoted fields', () => {
    const csv = 'Component;Description\nkernel;"  padded  "'
    const { records } = parseCsv(csv)
    expect(records[0]['Description']).toBe('  padded  ')
  })

  it('parses multiple records where one has a multi-line quoted description', () => {
    const csv = [
      'Component;Description',
      'kernel;"Line one\nLine two"',
      'glibc;Single line',
    ].join('\n')
    const { records } = parseCsv(csv)
    expect(records).toHaveLength(2)
    expect(records[0]['Component']).toBe('kernel')
    expect(records[0]['Description']).toBe('Line one\nLine two')
    expect(records[1]['Component']).toBe('glibc')
    expect(records[1]['Description']).toBe('Single line')
  })

  it('handles all 22 expected fields from the BugZilla export', () => {
    const FIELDS = [
      'Watchers', 'Embargo Developer', 'QA Contact', 'Contributors',
      'SST Pool', 'Assigned Team', 'Cc List', 'Docs Contact',
      'Bootstrap Ownership Confirmed', 'Default Assignee', 'Component',
      'Embargo Contributors', 'Active', 'Product', 'Watching Groups',
      'Component ID', 'Embargo QA Contact', 'Description',
      'Embargo Docs Contact', 'Sustaining Engineer', 'New Name', 'Developer',
    ]
    const header = FIELDS.join(';')
    const dataRow = FIELDS.map((_, i) => `val${i}`).join(';')
    const { headers, records } = parseCsv(`${header}\n${dataRow}`)

    expect(headers).toEqual(FIELDS)
    expect(records[0]['Component']).toBe('val10')
    expect(records[0]['QA Contact']).toBe('val2')
    expect(records[0]['Developer']).toBe('val21')
  })
})
