import TID from '../src/tid'

describe('TIDs', () => {
  it('creates a new TID', () => {
    const tid = TID.next()
    const str = tid.toString()
    expect(typeof str).toEqual('string')
    expect(str.length).toEqual(13)
  })

  it('parses a TID', () => {
    const tid = TID.next()
    const str = tid.toString()
    const parsed = TID.fromStr(str)
    expect(parsed.timestamp()).toEqual(tid.timestamp())
    expect(parsed.clockid()).toEqual(tid.clockid())
  })
})
