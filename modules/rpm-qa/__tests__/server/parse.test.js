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
