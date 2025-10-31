import assert from 'node:assert'
import * as http from 'node:http'
import { AddressInfo } from 'node:net'
import { CID } from 'multiformats/cid'
import { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import * as xrpcServer from '../src'
import { closeServer, createServer } from './_util'

const LEXICONS: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'io.example.ipld',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              cid: {
                type: 'cid-link',
              },
              bytes: {
                type: 'bytes',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              cid: {
                type: 'cid-link',
              },
              bytes: {
                type: 'bytes',
              },
            },
          },
        },
      },
    },
  },
]

describe('Ipld vals', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method('io.example.ipld', (ctx) => {
    assert(ctx.input?.body, 'expected input body')
    assert(typeof ctx.input.body === 'object', 'expected input body')

    const asCid = CID.asCID(ctx.input.body['cid'])
    if (!(asCid instanceof CID)) {
      throw new Error('expected cid')
    }
    const bytes = ctx.input.body['bytes']
    if (!(bytes instanceof Uint8Array)) {
      throw new Error('expected bytes')
    }
    return { encoding: 'application/json', body: ctx.input.body }
  })

  let client: XrpcClient
  beforeAll(async () => {
    s = await createServer(server)
    const { port } = s.address() as AddressInfo
    client = new XrpcClient(`http://localhost:${port}`, LEXICONS)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('can send and receive ipld vals', async () => {
    const cid = CID.parse(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    const bytes = new Uint8Array([0, 1, 2, 3])
    const res = await client.call(
      'io.example.ipld',
      {},
      {
        cid,
        bytes,
      },
      { encoding: 'application/json' },
    )
    expect(res.success).toBeTruthy()
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(cid.equals(res.data.cid)).toBeTruthy()
    expect(bytes).toEqual(res.data.bytes)
  })
})
