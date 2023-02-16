import { NoHandleRecordError, resolveDns } from '../src'

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
    await expect(resolveDns('bad.test')).rejects.toThrow(NoHandleRecordError)
  })
})
