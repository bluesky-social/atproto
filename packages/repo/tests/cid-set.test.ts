import { cidForLex } from '@atproto/lex-cbor'
import { CidSet, VisitedCidError } from '../src/index.js'

describe('CidSet.markVisited', () => {
  it('adds a CID the first time it is marked', async () => {
    const cid = await cidForLex({ a: 1 })
    const set = new CidSet()
    set.markVisited(cid)
    expect(set.has(cid)).toBe(true)
    expect(set.size()).toBe(1)
  })

  it('throws VisitedCidError when a CID is marked twice', async () => {
    const cid = await cidForLex({ a: 1 })
    const set = new CidSet()
    set.markVisited(cid)
    expect(() => set.markVisited(cid)).toThrow(VisitedCidError)
    expect(set.size()).toBe(1)
  })

  it('throws for a CID that was added with add()', async () => {
    const cid = await cidForLex({ a: 1 })
    const set = new CidSet().add(cid)
    expect(() => set.markVisited(cid)).toThrow(VisitedCidError)
  })

  it('tracks distinct CIDs independently', async () => {
    const a = await cidForLex({ a: 1 })
    const b = await cidForLex({ b: 2 })
    const set = new CidSet()
    set.markVisited(a)
    set.markVisited(b)
    expect(set.size()).toBe(2)
  })
})
