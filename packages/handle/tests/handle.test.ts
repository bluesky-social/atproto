import { ensureValid } from '../src'

describe('handle validation', () => {
  const domains = ['.bsky.app', '.test']
  const check = (toCheck: string) => () => {
    return ensureValid(toCheck, domains)
  }

  it('allows valid handles', () => {
    check('john.test')
    check('john.bsky.app')
  })
  it('errors on invalid handles', () => {
    expect(check('did:john.test')).toThrow(
      'Cannot register a handle that starts with `did:`',
    )
    expect(check('john.bsky.io')).toThrow('Not a supported handle domain')
    expect(check('john.com')).toThrow('Not a supported handle domain')
    expect(check('j.test')).toThrow('Handle too short')
    expect(check('jayromy-johnber123456.test')).toThrow('Handle too long')
    expect(check('john.test.bsky.app')).toThrow('Invalid characters in handle')
    expect(check('john..test')).toThrow('Invalid characters in handle')
    expect(check('jo_hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo!hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo%hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo&hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo*hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo|hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo:hn.test')).toThrow('Invalid characters in handle')
    expect(check('jo/hn.test')).toThrow('Invalid characters in handle')
    expect(check('about.test')).toThrow('Reserved handle')
    expect(check('atp.test')).toThrow('Reserved handle')
  })
})
