import AtpAgent from '@atproto/api'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import * as util from './_util'

describe('handles', () => {
  let agent: AtpAgent
  let close: util.CloseFn
  let sc: SeedClient

  let alice: string

  beforeAll(async () => {
    const server = await util.runTestServer({
      dbPostgresSchema: 'handles',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  it('resolves handles', async () => {
    const res = await agent.api.com.atproto.handle.resolve({
      handle: 'alice.test',
    })
    expect(res.data.did).toBe(alice)
  })

  it('allows a user to change their handle', async () => {
    await agent.api.com.atproto.handle.update(
      { handle: 'alice2.test' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    const attemptOld = agent.api.com.atproto.handle.resolve({
      handle: 'alice.test',
    })
    await expect(attemptOld).rejects.toThrow('Unable to resolve handle')
    const attemptNew = await agent.api.com.atproto.handle.resolve({
      handle: 'alice2.test',
    })
    expect(attemptNew.data.did).toBe(alice)
  })

  it('does not allow taking a handle that already exists', async () => {
    const attempt = agent.api.com.atproto.handle.update(
      { handle: 'bob.test' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await expect(attempt).rejects.toThrow('Handle already taken: bob.test')
  })

  it('disallows improperly formatted handles', async () => {
    const tryHandle = async (handle: string) => {
      await agent.api.com.atproto.handle.update(
        { handle },
        { headers: sc.getHeaders(alice), encoding: 'application/json' },
      )
    }
    await expect(tryHandle('did:john')).rejects.toThrow(
      'Cannot register a handle that starts with `did:`',
    )
    await expect(tryHandle('john.bsky.io')).rejects.toThrow(
      'Not a supported handle domain',
    )
    await expect(tryHandle('j.test')).rejects.toThrow('Handle too short')
    await expect(tryHandle('jayromy-johnber123456.test')).rejects.toThrow(
      'Handle too long',
    )
    await expect(tryHandle('jo_hn.test')).rejects.toThrow(
      'Invalid characters in handle',
    )
    await expect(tryHandle('jo!hn.test')).rejects.toThrow(
      'Invalid characters in handle',
    )
    await expect(tryHandle('jo%hn.test')).rejects.toThrow(
      'Invalid characters in handle',
    )
    await expect(tryHandle('jo&hn.test')).rejects.toThrow(
      'Invalid characters in handle',
    )
    await expect(tryHandle('jo*hn.test')).rejects.toThrow(
      'Invalid characters in handle',
    )
    await expect(tryHandle('jo|hn.test')).rejects.toThrow(
      'Invalid characters in handle',
    )
    await expect(tryHandle('jo:hn.test')).rejects.toThrow(
      'Invalid characters in handle',
    )
    await expect(tryHandle('jo/hn.test')).rejects.toThrow(
      'Invalid characters in handle',
    )
    await expect(tryHandle('about.test')).rejects.toThrow('Reserved handle')
    await expect(tryHandle('atp.test')).rejects.toThrow('Reserved handle')
  })
})
