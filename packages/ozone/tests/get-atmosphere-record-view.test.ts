import assert from 'node:assert/strict'
import { jest } from '@jest/globals'
import { ADMIN_PASSWORD, TestNetwork } from '@atproto/dev-env'
import { Client } from '@atproto/lex-client'
import { verifyJwt } from '@atproto/xrpc-server'
import { app } from '../src/lexicons/index.js'
import { LABELER_HEADER_NAME } from '../src/util.js'

const schema = app.bsky.unspecced.getAtmosphereRecordView
const uri = 'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/site.standard.document/test'
const cid = 'bafyreihbszgpe6omdcnuf5v6ctzqpiardllknn5a2xy5535ga4yhidyy5a'
const output: app.bsky.unspecced.getAtmosphereRecordView.$OutputBody = {
  view: app.bsky.embed.external.viewArticle.$build({
    uri: 'https://example.com/article',
    title: 'Reported article',
    description: 'An article preview',
  }),
  associatedRefs: [{ uri, cid }],
  associatedRecords: [{ title: 'Reported article', textContent: 'Full text' }],
}

describe('get Atmosphere record views through Ozone', () => {
  let network: TestNetwork
  let client: Client

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_get_atmosphere_record_view',
    })
    client = new Client(network.ozone.url)
  })

  afterAll(async () => {
    await network?.close()
  })

  it('forwards the CID and labelers using method-scoped Ozone credentials', async () => {
    using upstream = jest
      .spyOn(network.ozone.ctx.appviewClient, 'call')
      .mockResolvedValue(output)
    const incomingAuth = await network.ozone.modHeaders(schema.$lxm)
    const labelers = 'did:plc:labelerone;redact, did:plc:labelertwo'

    const result = await client.call(
      schema,
      { uri, cid },
      {
        headers: {
          ...incomingAuth,
          [LABELER_HEADER_NAME]: labelers,
          'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
        },
      },
    )

    expect(result).toEqual(output)
    expect(upstream).toHaveBeenCalledTimes(1)
    const [method, params, options] = upstream.mock.calls[0]
    expect(method).toMatchObject({ $lxm: schema.$lxm })
    expect(params).toEqual({ uri, cid })
    assert(options && 'headers' in options)
    const headers = new Headers(options.headers)
    expect(headers.get(LABELER_HEADER_NAME)).toBe(labelers)
    expect(headers.has('atproto-proxy')).toBe(false)
    const authorization = headers.get('authorization')
    assert(authorization)
    assert(authorization.startsWith('Bearer '))
    expect(authorization).not.toBe(incomingAuth.authorization)
    const token = await verifyJwt(
      authorization.slice('Bearer '.length),
      network.ozone.ctx.cfg.appview.did,
      schema.$lxm,
      async () => network.ozone.ctx.signingKey.did(),
    )
    expect(token.iss).toBe(
      `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
    )
  })

  it('allows the admin token', async () => {
    using upstream = jest
      .spyOn(network.ozone.ctx.appviewClient, 'call')
      .mockResolvedValue(output)
    const authorization = `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64')}`

    expect(
      await client.call(
        schema,
        { uri },
        {
          headers: { authorization },
        },
      ),
    ).toEqual(output)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('reaches AppView with moderation visibility', async () => {
    using hydrateContext = jest.spyOn(
      network.bsky.ctx.hydrator,
      'createContext',
    )

    const result = await client.call(
      schema,
      { uri },
      {
        headers: await network.ozone.modHeaders(schema.$lxm),
      },
    )

    expect(result).toEqual({})
    expect(hydrateContext).toHaveBeenCalledWith(
      expect.objectContaining({
        includeTakedowns: true,
        include3pBlocks: true,
        xrpcEndpoint: schema.$lxm,
      }),
    )
  })

  it('rejects unauthenticated requests before calling AppView', async () => {
    using upstream = jest.spyOn(network.ozone.ctx.appviewClient, 'call')

    await expect(client.call(schema, { uri })).rejects.toMatchObject({
      status: 401,
    })
    expect(upstream).not.toHaveBeenCalled()
  })
})
