import * as jose from 'jose'
import type { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'

describe('com.atproto.server.getServiceAuth', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let aliceDid: string
  let pdsDid: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'get_service_auth',
    })
    pdsDid = network.pds.ctx.cfg.service.did
    agent = network.pds.getAgent()
    const session = await agent.createAccount({
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
    aliceDid = session.data.did
  })

  afterAll(async () => {
    await network?.close()
  })

  it('issues a token whose aud matches a bare-DID input', async () => {
    const res = await agent.api.com.atproto.server.getServiceAuth({
      aud: pdsDid,
      lxm: 'com.atproto.server.describeServer',
    })
    const decoded = jose.decodeJwt(res.data.token)
    expect(decoded.aud).toBe(pdsDid)
    expect(decoded.iss).toBe(aliceDid)
    expect(decoded.lxm).toBe('com.atproto.server.describeServer')
  })

  it('issues a token whose aud matches a combined did#serviceId input', async () => {
    const aud = `${pdsDid}#atproto_pds`
    const res = await agent.api.com.atproto.server.getServiceAuth({
      aud,
      lxm: 'com.atproto.server.describeServer',
    })
    const decoded = jose.decodeJwt(res.data.token)
    expect(decoded.aud).toBe(aud)
    expect(decoded.iss).toBe(aliceDid)
    expect(decoded.lxm).toBe('com.atproto.server.describeServer')
  })

  it('rejects malformed aud with InvalidRequest', async () => {
    const attempt = agent.api.com.atproto.server.getServiceAuth({
      aud: 'not-a-did',
      lxm: 'com.atproto.server.describeServer',
    })
    await expect(attempt).rejects.toThrow(
      /aud must be a valid atproto DID or did#serviceId reference/,
    )
  })

  it('rejects an aud with a non-atproto DID method', async () => {
    const attempt = agent.api.com.atproto.server.getServiceAuth({
      aud: 'did:foo:bar',
      lxm: 'com.atproto.server.describeServer',
    })
    await expect(attempt).rejects.toThrow(
      /aud must be a valid atproto DID or did#serviceId reference/,
    )
  })

  it('rejects an aud with empty fragment', async () => {
    const attempt = agent.api.com.atproto.server.getServiceAuth({
      aud: `${pdsDid}#`,
      lxm: 'com.atproto.server.describeServer',
    })
    await expect(attempt).rejects.toThrow(
      /aud must be a valid atproto DID or did#serviceId reference/,
    )
  })
})
