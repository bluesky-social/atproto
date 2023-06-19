import { HandleResolver } from '../src'

jest.mock('dns/promises', () => {
  return {
    resolveTxt: (handle: string) => {
      if (handle === '_atproto.simple.test') {
        return [['did=did:example:simpleDid']]
      }
      if (handle === '_atproto.noisy.test') {
        return [
          ['blah blah blah'],
          ['did:example:fakeDid'],
          ['atproto=did:example:fakeDid'],
          ['did=did:example:noisyDid'],
          [
            'chunk long domain aspdfoiuwerpoaisdfupasodfiuaspdfoiuasdpfoiausdfpaosidfuaspodifuaspdfoiuasdpfoiasudfpasodifuaspdofiuaspdfoiuasd',
            'apsodfiuweproiasudfpoasidfu',
          ],
        ]
      }
      if (handle === '_atproto.bad.test') {
        return [
          ['blah blah blah'],
          ['did:example:fakeDid'],
          ['atproto=did:example:fakeDid'],
          [
            'chunk long domain aspdfoiuwerpoaisdfupasodfiuaspdfoiuasdpfoiausdfpaosidfuaspodifuaspdfoiuasdpfoiasudfpasodifuaspdofiuaspdfoiuasd',
            'apsodfiuweproiasudfpoasidfu',
          ],
        ]
      }
      if (handle === '_atproto.multi.test') {
        return [['did=did:example:firstDid'], ['did=did:example:secondDid']]
      }
    },
  }
})

describe('handle resolver', () => {
  let resolver: HandleResolver

  beforeAll(async () => {
    resolver = new HandleResolver()
  })

  it('handles a simple DNS resolution', async () => {
    const did = await resolver.resolveDns('simple.test')
    expect(did).toBe('did:example:simpleDid')
  })

  it('handles a noisy DNS resolution', async () => {
    const did = await resolver.resolveDns('noisy.test')
    expect(did).toBe('did:example:noisyDid')
  })

  it('handles a bad DNS resolution', async () => {
    const did = await resolver.resolveDns('bad.test')
    expect(did).toBeUndefined()
  })

  it('throws on multiple dids under same domain', async () => {
    const did = await resolver.resolveDns('multi.test')
    expect(did).toBeUndefined()
  })
})
