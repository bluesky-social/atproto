import {
  ensureValidHandle,
  ensureHandleServiceConstraints,
  normalizeAndEnsureValidHandle,
  ensureValidHandleRegex,
  InvalidHandleError,
} from '../src'

describe('handle validation', () => {
  const expectValid = (h: string) => {
    ensureValidHandle(h)
    ensureValidHandleRegex(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => ensureValidHandle(h)).toThrow(InvalidHandleError)
    expect(() => ensureValidHandleRegex(h)).toThrow(InvalidHandleError)
  }

  it('allows valid handles', () => {
    expectValid('A.ISI.EDU')
    expectValid('XX.LCS.MIT.EDU')
    expectValid('SRI-NIC.ARPA')
    expectValid('john.test')
    expectValid('jan.test')
    expectValid('a234567890123456789.test')
    expectValid('john2.test')
    expectValid('john-john.test')
    expectValid('john.bsky.app')
    expectValid('jo.hn')
    expectValid('a.co')
    expectValid('a.org')
    expectValid('joh.n')
    expectValid('j0.h0')
    const longHandle =
      'shoooort' + '.loooooooooooooooooooooooooong'.repeat(8) + '.test'
    expect(longHandle.length).toEqual(253)
    expectValid(longHandle)
    expectValid('short.' + 'o'.repeat(63) + '.test')
    expectValid('jaymome-johnber123456.test')
    expectValid('jay.mome-johnber123456.test')
    expectValid('john.test.bsky.app')
    expectValid('laptop.local')
    expectValid('laptop.arpa')

    // NOTE: this probably isn't ever going to be a real domain, but my read of
    // the RFC is that it would be possible
    expectValid('john.t')
  })

  it('allows punycode handles', () => {
    expectValid('xn--ls8h.test') // 💩.test
    expectValid('xn--bcher-kva.tld') // bücher.tld
  })

  it('allows onion (Tor) handles', () => {
    expectValid('expyuzz4wqqyqhjn.onion')
    expectValid('friend.expyuzz4wqqyqhjn.onion')
    expectValid(
      'g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
    expectValid(
      'friend.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
    expectValid(
      'friend.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
    expectValid(
      '2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
    expectValid(
      'friend.2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion',
    )
  })

  it('throws on invalid handles', () => {
    expectInvalid('did:thing.test')
    expectInvalid('did:thing')
    expectInvalid('john-.test')
    expectInvalid('john.0')
    expectInvalid('john.-')
    expectInvalid('short.' + 'o'.repeat(64) + '.test')
    expectInvalid('short' + '.loooooooooooooooooooooooong'.repeat(10) + '.test')
    const longHandle =
      'shooooort' + '.loooooooooooooooooooooooooong'.repeat(8) + '.test'
    expect(longHandle.length).toEqual(254)
    expectInvalid(longHandle)
    expectInvalid('xn--bcher-.tld')
    expectInvalid('john..test')
    expectInvalid('jo_hn.test')
    expectInvalid('-john.test')
    expectInvalid('.john.test')
    expectInvalid('jo!hn.test')
    expectInvalid('jo%hn.test')
    expectInvalid('jo&hn.test')
    expectInvalid('jo@hn.test')
    expectInvalid('jo*hn.test')
    expectInvalid('jo|hn.test')
    expectInvalid('jo:hn.test')
    expectInvalid('jo/hn.test')
    expectInvalid('john💩.test')
    expectInvalid('bücher.test')
    expectInvalid('john .test')
    expectInvalid('john.test.')
    expectInvalid('john')
    expectInvalid('john.')
    expectInvalid('.john')
    expectInvalid('john.test.')
    expectInvalid('.john.test')
    expectInvalid(' john.test')
    expectInvalid('john.test ')
    expectInvalid('joh-.test')
    expectInvalid('john.-est')
    expectInvalid('john.tes-')
  })

  it('correctly validates corner cases (modern vs. old RFCs)', () => {
    expectValid('12345.test')
    expectValid('8.cn')
    expectValid('4chan.org')
    expectValid('4chan.o-g')
    expectValid('blah.4chan.org')
    expectValid('thing.a01')
    expectValid('120.0.0.1.com')
    expectValid('0john.test')
    expectValid('9sta--ck.com')
    expectValid('99stack.com')
    expectValid('0ohn.test')
    expectValid('john.t--t')
    expectValid('thing.0aa.thing')

    expectInvalid('cn.8')
    expectInvalid('thing.0aa')
    expectInvalid('thing.0aa')
  })

  it('does not allow IP addresses as handles', () => {
    expectInvalid('127.0.0.1')
    expectInvalid('192.168.0.142')
    expectInvalid('fe80::7325:8a97:c100:94b')
    expectInvalid('2600:3c03::f03c:9100:feb0:af1f')
  })

  it('is consistent with examples from stackoverflow', () => {
    const okStackoverflow = [
      'stack.com',
      'sta-ck.com',
      'sta---ck.com',
      'sta--ck9.com',
      'stack99.com',
      'sta99ck.com',
      'google.com.uk',
      'google.co.in',
      'google.com',
      'maselkowski.pl',
      'm.maselkowski.pl',
      'xn--masekowski-d0b.pl',
      'xn--fiqa61au8b7zsevnm8ak20mc4a87e.xn--fiqs8s',
      'xn--stackoverflow.com',
      'stackoverflow.xn--com',
      'stackoverflow.co.uk',
      'xn--masekowski-d0b.pl',
      'xn--fiqa61au8b7zsevnm8ak20mc4a87e.xn--fiqs8s',
    ]
    okStackoverflow.forEach(expectValid)

    const badStackoverflow = [
      '-notvalid.at-all',
      '-thing.com',
      'www.masełkowski.pl.com',
    ]
    badStackoverflow.forEach(expectInvalid)
  })
})

describe('service constraints & normalization', () => {
  const domains = ['.bsky.app', '.test']
  it('throw on handles that violate service constraints', () => {
    const expectThrow = (handle: string, err: string) => {
      expect(() => ensureHandleServiceConstraints(handle, domains)).toThrow(err)
    }

    expectThrow('john.bsky.io', 'Not a supported handle domain')
    expectThrow('john.com', 'Not a supported handle domain')
    expectThrow('j.test', 'Handle too short')
    expectThrow('uk.test', 'Handle too short')
    expectThrow('john.test.bsky.app', 'Invalid characters in handle')
    expectThrow('about.test', 'Reserved handle')
    expectThrow('atp.test', 'Reserved handle')
    expectThrow('barackobama.test', 'Reserved handle')
  })

  it('normalizes handles', () => {
    const normalized = normalizeAndEnsureValidHandle('JoHn.TeST')
    expect(normalized).toBe('john.test')
  })

  it('throws on invalid normalized handles', () => {
    expect(() => normalizeAndEnsureValidHandle('JoH!n.TeST')).toThrow(
      InvalidHandleError,
    )
  })
})
