import { Readable } from 'node:stream'
import { jest } from '@jest/globals'
import * as undici from 'undici'
import { BlobDiverter } from '../src/daemon/blob-diverter.js'

describe('blob diversion upload retries', () => {
  const originalDispatcher = undici.getGlobalDispatcher()
  let agent: undici.MockAgent

  beforeEach(() => {
    agent = new undici.MockAgent()
    agent.disableNetConnect()
    undici.setGlobalDispatcher(agent)
  })

  afterEach(async () => {
    undici.setGlobalDispatcher(originalDispatcher)
    await agent.close()
    jest.restoreAllMocks()
  })

  function diverter() {
    return new BlobDiverter(null as never, {
      idResolver: {
        did: {
          resolve: async () => ({
            id: 'did:plc:example',
            service: [
              {
                id: '#atproto_pds',
                type: 'AtprotoPersonalDataServer',
                serviceEndpoint: 'https://pds.example.com',
              },
            ],
          }),
        },
      } as never,
      serviceConfig: {
        url: 'https://divert.example.com',
        adminPassword: 'password',
        maxBytes: 100,
      },
    })
  }

  const subject = {
    subjectDid: 'did:plc:example' as const,
    subjectUri: null,
    subjectBlobCids: ['cid'],
  }

  it('does not repeat an upload after response headers time out', async () => {
    const timeout = new undici.errors.HeadersTimeoutError()
    agent
      .get('https://divert.example.com')
      .intercept({
        path: /\/xrpc\/com\.atproto\.unspecced\.reportBlob/,
        method: 'POST',
      })
      .replyWithError(timeout)
      .persist()
    const instance = diverter()
    using download = jest
      .spyOn(instance, 'getBlob')
      .mockImplementation(async () => ({
        type: 'image/jpeg',
        stream: Readable.from('blob'),
      }))

    await expect(instance.uploadBlobOnService(subject)).rejects.toMatchObject({
      statusCode: 502,
      cause: { cause: timeout },
    })
    expect(download).toHaveBeenCalledTimes(1)
  })

  it('still retries a transient connection failure', async () => {
    const pool = agent.get('https://divert.example.com')
    const request = {
      path: /\/xrpc\/com\.atproto\.unspecced\.reportBlob/,
      method: 'POST',
    }
    pool
      .intercept(request)
      .replyWithError(new undici.errors.ConnectTimeoutError())
    pool.intercept(request).reply(200, '')
    const instance = diverter()
    using download = jest
      .spyOn(instance, 'getBlob')
      .mockImplementation(async () => ({
        type: 'image/jpeg',
        stream: Readable.from('blob'),
      }))

    await expect(instance.uploadBlobOnService(subject)).resolves.toBeUndefined()
    expect(download).toHaveBeenCalledTimes(2)
  })
})
