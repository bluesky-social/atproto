import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { MINUTE } from '@atproto/common'
import { isValidHandle } from '@atproto/syntax'
import { httpLogger as log } from './logger.js'

const RELOAD_INTERVAL = 5 * MINUTE

const HEADERS = {
  value: 'Value (Term / Hashtag)',
  match: 'Match Type',
  outcome: 'Enforcement Outcome',
  surface: 'Surface',
  start: 'Effective Start Date',
  end: 'Effective End Date',
  status: 'Status',
} as const

type BlockRule = { term: string; exact: boolean }

/**
 * The prohibited search terms policy CSV, as the dataplane's search applies it
 * to actor typeahead: a query matching an active Block rule gets no results.
 * The file is reread every 5 minutes, which also moves the effective-date
 * window; a failed reload keeps the last good rules.
 */
export class ProhibitedTerms {
  private timer?: NodeJS.Timeout

  private constructor(
    private path: string,
    private rules: BlockRule[],
  ) {}

  /** Throws when the file can't be read or parsed. */
  static load(path: string): ProhibitedTerms {
    const csv = readFileSync(path, 'utf8')
    return new ProhibitedTerms(path, parseProhibitedTerms(csv, new Date()))
  }

  isBlocked(query: string): boolean {
    const normalized = normalizeQuery(query)
    return this.rules.some((rule) =>
      rule.exact ? normalized === rule.term : normalized.includes(rule.term),
    )
  }

  start() {
    this.timer ??= setInterval(() => void this.reload(), RELOAD_INTERVAL)
    this.timer.unref()
  }

  destroy() {
    clearInterval(this.timer)
    this.timer = undefined
  }

  async reload() {
    try {
      const csv = await readFile(this.path, 'utf8')
      this.rules = parseProhibitedTerms(csv, new Date())
    } catch (err) {
      log.error(
        { err, path: this.path },
        'failed to reload prohibited terms, keeping the last good rules',
      )
    }
  }
}

// @NOTE Keep in sync with what atlantis applies to actor typeahead (tango,
// atlantis/bsky/server/models/search/prohibited_terms.go), including which
// malformed rows it skips and which errors fail the whole file.
export function parseProhibitedTerms(csv: string, now: Date): BlockRule[] {
  const [header, ...rows] = parseCsv(csv)
  if (!header) throw new Error('prohibited terms file has no header')
  const index = new Map<string, number>()
  header.forEach((name, i) => {
    name = trimSpace(name)
    if (!name) return
    if (index.has(name)) throw new Error(`duplicate header "${name}"`)
    index.set(name, i)
  })
  for (const name of Object.values(HEADERS)) {
    if (!index.has(name)) throw new Error(`missing header "${name}"`)
  }

  const today = now.toISOString().slice(0, 10)
  const rules: BlockRule[] = []
  for (const row of rows) {
    if (row.length !== header.length) continue
    const rule = parseRule((name) => trimSpace(row[index.get(name)!]), today)
    if (rule) rules.push(rule)
  }
  return rules
}

function parseRule(
  field: (name: string) => string,
  today: string,
): BlockRule | undefined {
  if (field(HEADERS.status).toLowerCase() !== 'completed') return
  if (field(HEADERS.outcome).toLowerCase() !== 'block (zero results)') return
  const surface = normalizeLabel(field(HEADERS.surface))
  if (
    surface !== 'search results - all' &&
    surface !== 'search results - typeahead'
  ) {
    return
  }
  const match = field(HEADERS.match).toLowerCase()
  if (match !== 'exact' && match !== 'string') return

  // A blank start date is inactive; a blank end date never expires.
  const start = field(HEADERS.start)
  const end = field(HEADERS.end) || '9999-12-31'
  if (!isDate(start) || !isDate(end) || today < start || today > end) return

  // Actor typeahead checks plain and @handle rules; #hashtag rules don't apply.
  const value = lower(field(HEADERS.value)).normalize('NFC')
  const term = collapseSpace(value.replace(/^[#@]+/, ''))
  if (!term || /[#@]/.test(term) || value.startsWith('#')) return
  if (value.startsWith('@') && !isValidHandle(term)) return
  return { term, exact: match === 'exact' }
}

/** Lowercases, NFC-normalizes, treats # and @ as spaces, collapses spaces. */
export function normalizeQuery(query: string): string {
  return collapseSpace(lower(query.replace(/[#@]/g, ' ')).normalize('NFC'))
}

// Go's strings.ToLower maps each code point on its own, unlike toLowerCase():
// no final sigma, and U+0130 becomes a plain i.
function lower(value: string): string {
  return Array.from(value, (c) =>
    c === '\u0130' ? 'i' : c.toLowerCase(),
  ).join('')
}

// Accepts the em and en dashes that sheet exports produce.
function normalizeLabel(value: string): string {
  return collapseSpace(value.replace(/[\u2014\u2013]/g, '-')).toLowerCase()
}

// @NOTE \p{White_Space} is the whitespace set Go's strings.Fields uses.
function collapseSpace(value: string): string {
  return value
    .split(/\p{White_Space}+/u)
    .filter(Boolean)
    .join(' ')
}

function trimSpace(value: string): string {
  return value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '')
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

// RFC 4180 CSV, strict like Go's encoding/csv: a stray quote fails the whole
// file, blank lines are skipped, and a CR at the very end is dropped.
function parseCsv(text: string): string[][] {
  text = text.replace(/\r$/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false // inside a quoted field
  let closed = false // the current field was quoted and has closed
  const endRow = () => {
    if (row.length || field || closed) rows.push([...row, field])
    row = []
    field = ''
    closed = false
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const crlf = c === '\r' && text[i + 1] === '\n'
    if (quoted) {
      if (c !== '"') {
        if (!crlf) field += c
      } else if (text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        quoted = false
        closed = true
      }
    } else if (c === ',') {
      row.push(field)
      field = ''
      closed = false
    } else if (c === '\n' || crlf) {
      if (crlf) i++
      endRow()
    } else if (closed || (c === '"' && field)) {
      throw new Error(`malformed CSV quote at offset ${i}`)
    } else if (c === '"') {
      quoted = true
    } else {
      field += c
    }
  }
  if (quoted) throw new Error('unterminated quoted CSV field')
  endRow()
  return rows
}
