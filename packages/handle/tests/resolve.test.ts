import { resolveDns } from '../src'

jest.mock('dns/promises', () => {
  return {
    resolveTxt: (handle: string) => {
      if (handle === '_did.simple.test') {
        return [['atproto=did:example:simpleDid']]
      }
      if (handle === '_did.noisy.test') {
        return [
          ['blah blah blah'],
          ['atproto=did:example:noisyDid'],
          ['atprotodid:example:noisyDid'],
          ['did:example:noiseDid'],
          [
            'chunk long domain aspdfoiuwerpoaisdfupasodfiuaspdfoiuasdpfoiausdfpaosidfuaspodifuaspdfoiuasdpfoiasudfpasodifuaspdofiuaspdfoiuasd',
            'apsodfiuweproiasudfpoasidfu',
          ],
        ]
      }
      if (handle === '_did.bad.test') {
        return [
          ['blah blah blah'],
          ['did:example:badDid'],
          [
            'chunk long domain aspdfoiuwerpoaisdfupasodfiuaspdfoiuasdpfoiausdfpaosidfuaspodifuaspdfoiuasdpfoiasudfpasodifuaspdofiuaspdfoiuasd',
            'apsodfiuweproiasudfpoasidfu',
          ],
        ]
      }
    },
  }
})

describe('handle resolution', () => {
  it('handles a simple DNS resolution', async () => {
    const did = await resolveDns('simple.test')
    expect(did).toBe('did:example:simpleDid')
  })

  it('handles a noisy DNS resolution', async () => {
    const did = await resolveDns('noisy.test')
    expect(did).toBe('did:example:noisyDid')
  })

  it('handles a bad DNS resolution', async () => {
    const did = await resolveDns('bad.test')
    expect(did).toBeNull()
  })
})
