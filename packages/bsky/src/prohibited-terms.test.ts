import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ProhibitedTerms,
  normalizeQuery,
  parseProhibitedTerms,
} from './prohibited-terms.js'

const HEADER =
  'ID,Date Requested,Value (Term / Hashtag),Match Type,Enforcement Outcome,Surface,Intervention,Priority,Implementation,Effective Start Date,Effective End Date,Date Completed,Status'

const NOW = new Date('2026-06-15T23:59:00Z')

type Row = {
  value: string
  match?: string
  outcome?: string
  surface?: string
  start?: string
  end?: string
  status?: string
}

function row({
  value,
  match = 'Exact',
  outcome = 'Block (Zero Results)',
  surface = 'Search Results - All',
  start = '2026-01-01',
  end = '',
  status = 'Completed',
}: Row): string {
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`
  return [
    '1',
    '2026-01-01',
    quote(value),
    match,
    quote(outcome),
    quote(surface),
    '',
    'P1',
    '',
    start,
    end,
    '',
    status,
  ].join(',')
}

function csv(...rows: Row[]): string {
  return [HEADER, ...rows.map(row)].join('\n') + '\n'
}

function terms(...rows: Row[]) {
  return parseProhibitedTerms(csv(...rows), NOW)
}

describe('parseProhibitedTerms', () => {
  it('keeps active Block rules for the All and Typeahead surfaces', () => {
    expect(
      terms(
        { value: 'all-term' },
        { value: 'typeahead-term', surface: 'Search Results - Typeahead' },
        { value: 'sheet-label', surface: 'Search Results —  All' },
        { value: 'en-dash', surface: 'search results – typeahead' },
        { value: 'substring', match: 'String' },
      ),
    ).toEqual([
      { term: 'all-term', exact: true },
      { term: 'typeahead-term', exact: true },
      { term: 'sheet-label', exact: true },
      { term: 'en-dash', exact: true },
      { term: 'substring', exact: false },
    ])
  })

  it.each<[string, Partial<Row>]>([
    ['pending status', { status: 'Pending' }],
    ['suppress outcome', { outcome: 'Suppress (Remove from Suggestions)' }],
    ['monitor outcome', { outcome: 'Monitor Only (No Enforcement)' }],
    ['redirect outcome', { outcome: 'Redirect to Resources [Phase 3]' }],
    ['unknown outcome', { outcome: 'Block' }],
    ['people surface', { surface: 'Search Results - People' }],
    ['phase two surface', { surface: 'All Surfaces [Phase 2]' }],
    ['regex match', { match: 'Regex' }],
    ['blank start', { start: '' }],
    ['future start', { start: '2026-06-16' }],
    ['past end', { start: '2026-01-01', end: '2026-06-14' }],
    ['invalid start', { start: '2026-02-30' }],
    ['invalid end', { end: '06/30/2026' }],
    ['hashtag term', { value: '#tagterm' }],
    ['internal marker', { value: 'bad#term' }],
    ['invalid handle', { value: '@not a handle' }],
    ['blank term', { value: ' @ ' }],
  ])('skips a row with %s', (_, overrides) => {
    expect(terms({ value: 'skipped-term', ...overrides })).toEqual([])
  })

  it('treats the effective dates as an inclusive UTC window', () => {
    expect(
      terms(
        { value: 'starts-today', start: '2026-06-15' },
        { value: 'ends-today', start: '2026-01-01', end: '2026-06-15' },
        { value: 'open-ended', start: '2026-01-01', end: '' },
      ).map((r) => r.term),
    ).toEqual(['starts-today', 'ends-today', 'open-ended'])
  })

  it('normalizes configured terms', () => {
    expect(
      terms(
        { value: '  Mixed   CASE\tTerm ' },
        { value: '@Someone.Example.Com' },
        { value: 'Cafe\u0301' },
      ).map((r) => r.term),
    ).toEqual(['mixed case term', 'someone.example.com', 'caf\u00e9'])
  })

  it('accepts a CR at the end of the file, after a quoted field', () => {
    const last = row({ value: 'cr-term' }).replace(/Completed$/, '"Completed"')
    expect(parseProhibitedTerms(`${HEADER}\n${last}\r`, NOW)).toEqual([
      { term: 'cr-term', exact: true },
    ])
  })

  it('skips rows with the wrong number of fields', () => {
    const data = `${HEADER}\n${row({ value: 'short-row' })},extra\n`
    expect(parseProhibitedTerms(data, NOW)).toEqual([])
  })

  it('parses quoted fields, CRLF line endings and blank lines', () => {
    const data = [HEADER, '', row({ value: 'a "quoted", term' }), ''].join(
      '\r\n',
    )
    // Internal quotes are fine; the comma is part of the term.
    expect(parseProhibitedTerms(data, NOW)).toEqual([
      { term: 'a "quoted", term', exact: true },
    ])
  })

  it.each([
    ['an empty file', ''],
    ['a missing header', HEADER.replace(',Status', ',State')],
    ['a duplicate header', `${HEADER},Status`],
    ['a stray quote', `${HEADER}\n1,a"b,c`],
    ['text after a closing quote', `${HEADER}\n1,"a"b,c`],
    ['an unterminated quote', `${HEADER}\n1,"abc`],
  ])('fails on %s', (_, data) => {
    expect(() => parseProhibitedTerms(data, NOW)).toThrow()
  })
})

describe('normalizeQuery', () => {
  it.each([
    ['@BlockedTerm', 'blockedterm'],
    ['#blockedterm', 'blockedterm'],
    ['BlOcKeDtErM', 'blockedterm'],
    ['  blocked \t  term  ', 'blocked term'],
    ['@blocked#term', 'blocked term'],
    ['cafe\u0301', 'caf\u00e9'],
    // Per code point like Go: no final sigma, and a dotted capital I is plain i.
    ['\u039f\u03a3', '\u03bf\u03c3'],
    ['\u0130', 'i'],
  ])('normalizes %j to %j', (query, normalized) => {
    expect(normalizeQuery(query)).toBe(normalized)
  })
})

describe('ProhibitedTerms', () => {
  let dir: string
  let path: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'prohibited-terms-'))
    path = join(dir, 'terms.csv')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('blocks exact and substring matches of the normalized query', async () => {
    await writeFile(
      path,
      csv(
        { value: 'blockedterm' },
        { value: 'two words' },
        { value: 'needle', match: 'String' },
        { value: '@someone.example.com' },
      ),
    )
    const prohibited = ProhibitedTerms.load(path)

    expect(prohibited.isBlocked('@BlockedTerm')).toBe(true)
    expect(prohibited.isBlocked('#blockedterm')).toBe(true)
    expect(prohibited.isBlocked('  Two   WORDS ')).toBe(true)
    expect(prohibited.isBlocked('blockedterm suffix')).toBe(false)
    expect(prohibited.isBlocked('blocked')).toBe(false)
    expect(prohibited.isBlocked('haystackneedlehaystack')).toBe(true)
    expect(prohibited.isBlocked('@someone.example.com')).toBe(true)
    expect(prohibited.isBlocked('someone.example')).toBe(false)
    expect(prohibited.isBlocked('')).toBe(false)
  })

  it('fails to load a missing or malformed file', async () => {
    expect(() => ProhibitedTerms.load(path)).toThrow()
    await writeFile(path, 'not,the,policy,header\n')
    expect(() => ProhibitedTerms.load(path)).toThrow()
  })

  it('reloads the file and keeps the last good rules on failure', async () => {
    await writeFile(path, csv({ value: 'first' }))
    const prohibited = ProhibitedTerms.load(path)
    expect(prohibited.isBlocked('first')).toBe(true)

    await writeFile(path, csv({ value: 'second' }))
    await prohibited.reload()
    expect(prohibited.isBlocked('first')).toBe(false)
    expect(prohibited.isBlocked('second')).toBe(true)

    await writeFile(path, 'not,the,policy,header\n')
    await prohibited.reload()
    expect(prohibited.isBlocked('second')).toBe(true)

    await rm(path)
    await prohibited.reload()
    expect(prohibited.isBlocked('second')).toBe(true)
  })
})
