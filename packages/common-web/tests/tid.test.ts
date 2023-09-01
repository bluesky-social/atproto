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

  it('throws if invalid tid passed', () => {
    expect(() => new TID('')).toThrow('Poorly formatted TID: 0 length')
  })

  describe('nextStr', () => {
    it('returns next tid as a string', () => {
      const str = TID.nextStr()
      expect(typeof str).toEqual('string')
      expect(str.length).toEqual(13)
    })

    it('returns a next tid larger than a provided prev', () => {
      const prev = TID.fromTime((Date.now() + 5000) * 1000, 0).toString()
      const str = TID.nextStr(prev)
      expect(str > prev).toBe(true)
    })
  })

  describe('newestFirst', () => {
    it('sorts tids newest first', () => {
      const oldest = TID.next()
      const newest = TID.next()

      const tids = [oldest, newest]

      tids.sort(TID.newestFirst)

      expect(tids).toEqual([newest, oldest])
    })
  })

  describe('oldestFirst', () => {
    it('sorts tids oldest first', () => {
      const oldest = TID.next()
      const newest = TID.next()

      const tids = [newest, oldest]

      tids.sort(TID.oldestFirst)

      expect(tids).toEqual([oldest, newest])
    })
  })

  describe('is', () => {
    it('true for valid tids', () => {
      const tid = TID.next()
      const asStr = tid.toString()

      expect(TID.is(asStr)).toBe(true)
    })

    it('false for invalid tids', () => {
      expect(TID.is('')).toBe(false)
    })
  })

  describe('equals', () => {
    it('true when same tid', () => {
      const tid = TID.next()
      expect(tid.equals(tid)).toBe(true)
    })

    it('true when different instance, same tid', () => {
      const tid0 = TID.next()
      const tid1 = new TID(tid0.toString())

      expect(tid0.equals(tid1)).toBe(true)
    })

    it('false when different tid', () => {
      const tid0 = TID.next()
      const tid1 = TID.next()

      expect(tid0.equals(tid1)).toBe(false)
    })
  })

  describe('newerThan', () => {
    it('true for newer tid', () => {
      const tid0 = TID.next()
      const tid1 = TID.next()

      expect(tid1.newerThan(tid0)).toBe(true)
    })

    it('false for older tid', () => {
      const tid0 = TID.next()
      const tid1 = TID.next()

      expect(tid0.newerThan(tid1)).toBe(false)
    })

    it('false for identical tids', () => {
      const tid0 = TID.next()
      const tid1 = new TID(tid0.toString())

      expect(tid0.newerThan(tid1)).toBe(false)
    })
  })

  describe('olderThan', () => {
    it('true for older tid', () => {
      const tid0 = TID.next()
      const tid1 = TID.next()

      expect(tid0.olderThan(tid1)).toBe(true)
    })

    it('false for newer tid', () => {
      const tid0 = TID.next()
      const tid1 = TID.next()

      expect(tid1.olderThan(tid0)).toBe(false)
    })

    it('false for identical tids', () => {
      const tid0 = TID.next()
      const tid1 = new TID(tid0.toString())

      expect(tid0.olderThan(tid1)).toBe(false)
    })
  })
})
