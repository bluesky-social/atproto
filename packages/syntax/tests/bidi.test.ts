import { describe, expect, it } from 'vitest'

import { hasBidiControls, stripBidiControls } from '../src/index.js'

// Fixtures are built from code points, never typed as literal invisible
// characters in this file, matching the reasoning in src/bidi.ts.
const RLO = String.fromCodePoint(0x202e)
const LRE = String.fromCodePoint(0x202a)
const RLE = String.fromCodePoint(0x202b)
const PDF = String.fromCodePoint(0x202c)
const LRO = String.fromCodePoint(0x202d)
const LRI = String.fromCodePoint(0x2066)
const RLI = String.fromCodePoint(0x2067)
const FSI = String.fromCodePoint(0x2068)
const PDI = String.fromCodePoint(0x2069)
const LRM = String.fromCodePoint(0x200e)
const RLM = String.fromCodePoint(0x200f)
const ALM = String.fromCodePoint(0x061c)

describe('hasBidiControls', () => {
  it('is false for plain ASCII text', () => {
    expect(hasBidiControls('Alice')).toBe(false)
  })

  it('is false for real Arabic text with legitimate direction marks', () => {
    expect(hasBidiControls(`price: 100${LRM}${RLM} ريال${ALM}`)).toBe(false)
  })

  it('is true for the exact character from atproto#1480', () => {
    expect(hasBidiControls(`Alice${RLO}redaeR yekulB`)).toBe(true)
  })

  it('is true for every embedding, override, and isolate control character', () => {
    for (const char of [LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI]) {
      expect(hasBidiControls(`a${char}b`)).toBe(true)
    }
  })
})

describe('stripBidiControls', () => {
  it('leaves plain text unchanged', () => {
    expect(stripBidiControls('Alice')).toBe('Alice')
  })

  it('removes the override character so notification text cannot be spoofed', () => {
    const malicious = `Alice${RLO}redaeR yekulB`
    const cleaned = stripBidiControls(malicious)
    expect(cleaned).toBe('AliceredaeR yekulB')
    expect(hasBidiControls(cleaned)).toBe(false)
  })

  it('removes every embedding, override, and isolate control character', () => {
    for (const char of [LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI]) {
      expect(stripBidiControls(`a${char}b`)).toBe('ab')
    }
  })

  it('never strips legitimate direction marks, real RTL text must survive intact', () => {
    const input = `price: 100${LRM}${RLM} ريال${ALM}`
    expect(stripBidiControls(input)).toBe(input)
  })

  it('is idempotent', () => {
    const once = stripBidiControls(`a${RLO}b`)
    expect(stripBidiControls(once)).toBe(once)
  })
})
