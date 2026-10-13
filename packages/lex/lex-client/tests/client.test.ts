import { assert, describe, expect, it, vi } from 'vitest'
import { type LexValue, cidForLex } from '@atproto/lex-cbor'
import { cidForRawBytes, isTypedBlobRef, parseCid } from '@atproto/lex-data'
import { lexParse, lexToJson } from '@atproto/lex-json'
import { LexValidationError, currentDatetimeString } from '@atproto/lex-schema'
import {
  type Action,
  Client,
  type FetchHandler,
  XrpcAuthenticationError,
  XrpcInvalidResponseError,
  XrpcResponseError,
  buildAgent,
} from '../src/index.js'
import {
  type ApplyWritesOutputBody,
  type CreateRecordOutputBody,
  type GetRecordOutputBody,
  type Preference,
  type UploadBlobOutputBody,
  com,
} from './lexicons.js'

const cborCid = parseCid(
  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
  { flavor: 'cbor' },
)

describe(Client, () => {
  describe('atproto-* headers', () => {
    it('defaults "service" to atproto-proxy headers set through the per-request headers option', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (_url, _init) => {
        return Response.json({ preferences: [] })
      })

      const client = new Client(fetchHandler)

      await client.xrpc(com.example.actor.getPreferences, {
        headers: {
          'atproto-proxy': 'did:plc:existing#service',
        },
      })

      expect(fetchHandler).toHaveBeenCalledOnce()

      const [_url, init] = fetchHandler.mock.calls[0]
      const headers = new Headers(init?.headers)

      expect(headers.get('atproto-proxy')).toBe('did:plc:existing#service')
    })

    it('uses the "atproto-proxy" header as fallback for the "service" option', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (_url, _init) => {
        return Response.json({ preferences: [] })
      })

      const client = new Client(fetchHandler, {
        headers: { 'atproto-proxy': 'did:plc:existing#service' },
      })

      expect(client.service).toBe('did:plc:existing#service')

      await client.xrpc(com.example.actor.getPreferences)

      // A per-request "service" still overrides the header-provided default
      await client.xrpc(com.example.actor.getPreferences, {
        service: 'did:plc:new#service',
      })

      // And "service: null" disables it
      await client.xrpc(com.example.actor.getPreferences, {
        service: null,
      })

      expect(fetchHandler).toHaveBeenCalledTimes(3)

      const proxies = fetchHandler.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('atproto-proxy'),
      )
      expect(proxies).toEqual([
        'did:plc:existing#service',
        'did:plc:new#service',
        null,
      ])
    })

    it('uses global "service" and "labelers" options for requests', async () => {
      const service = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz#bsky_appview'
      const labeler = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'

      const fetchHandler = vi.fn<FetchHandler>(async (_url, _init) => {
        return Response.json({ preferences: [] })
      })

      const client = new Client(fetchHandler, { service, labelers: [labeler] })

      await client.xrpc(com.example.actor.getPreferences)

      expect(fetchHandler).toHaveBeenCalledOnce()

      const [_url, init] = fetchHandler.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('atproto-proxy')).toBe(service)
      expect(headers.get('atproto-accept-labelers')).toBe(labeler)
    })

    it('allows default proxy and labeler headers to be overridden per request', async () => {
      const service = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz#bsky_appview'
      const labeler = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'

      const fetchHandler = vi.fn<FetchHandler>(async (_url, _init) => {
        return Response.json({ preferences: [] })
      })

      const client = new Client(fetchHandler, { service, labelers: [labeler] })

      await client.xrpc(com.example.actor.getPreferences, {
        service: 'did:plc:new#service',
        labelers: ['did:plc:new'],
      })

      expect(fetchHandler).toHaveBeenCalledOnce()

      const [_url, init] = fetchHandler.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('atproto-proxy')).toBe('did:plc:new#service')
      expect(headers.get('atproto-accept-labelers')).toBe('did:plc:new')
    })

    it('allows default proxy and labeler headers to be disabled per request', async () => {
      const service = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz#bsky_appview'
      const labeler = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'

      const fetchHandler = vi.fn<FetchHandler>(async (_url, _init) => {
        return Response.json({ preferences: [] })
      })

      const client = new Client(fetchHandler, { service, labelers: [labeler] })

      await client.xrpc(com.example.actor.getPreferences, {
        service: null,
        labelers: null,
      })

      expect(fetchHandler).toHaveBeenCalledOnce()

      const [_url, init] = fetchHandler.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.has('atproto-proxy')).toBe(false)
      expect(headers.has('atproto-accept-labelers')).toBe(false)
    })

    it('applies defaults when "service" and "labelers" are explicitly undefined', async () => {
      const service = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz#bsky_appview'
      const labeler = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'

      const fetchHandler = vi.fn<FetchHandler>(async (_url, _init) => {
        return Response.json({ preferences: [] })
      })

      const client = new Client(fetchHandler, { service, labelers: [labeler] })

      await client.xrpc(com.example.actor.getPreferences, {
        service: undefined,
        labelers: undefined,
      })

      expect(fetchHandler).toHaveBeenCalledOnce()

      const [_url, init] = fetchHandler.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('atproto-proxy')).toBe(service)
      expect(headers.get('atproto-accept-labelers')).toBe(labeler)
    })

    it('ignores the client\'s default "service" and "labelers" in record helper methods', async () => {
      const service = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz#bsky_appview'
      const labeler = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'
      const did = 'did:plc:alice'

      const fetchHandler = vi.fn<FetchHandler>(async (url, _init) => {
        if (url.includes('listRecords')) {
          return Response.json({ records: [] })
        }
        return Response.json({
          uri: `at://${did}/com.example.feed.post/2222222222222`,
          cid: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        })
      })

      const client = new Client(
        { fetchHandler, did },
        { service, labelers: [labeler] },
      )

      await client.createRecord(
        com.example.feed.post.$build({
          text: 'Hello!',
          createdAt: currentDatetimeString(),
        }),
      )
      await client.listRecords(com.example.feed.post.$type)

      expect(fetchHandler).toHaveBeenCalledTimes(2)
      for (const [, init] of fetchHandler.mock.calls) {
        const headers = new Headers(init?.headers)
        expect(headers.has('atproto-proxy')).toBe(false)
        expect(headers.has('atproto-accept-labelers')).toBe(false)
      }

      // Explicit per-call options still apply
      await client.listRecords(com.example.feed.post.$type, {
        service,
        labelers: [labeler],
      })

      const [, init] = fetchHandler.mock.calls[2]
      const headers = new Headers(init?.headers)
      expect(headers.get('atproto-proxy')).toBe(service)
      expect(headers.get('atproto-accept-labelers')).toBe(labeler)
    })

    it('propagates custom (non atproto-*) headers when composing clients', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>(async (_url, _init) => {
        return Response.json({ preferences: [] })
      })

      const agent = buildAgent({
        fetch,
        service: 'https://base.example.com',
        headers: { 'x-base': 'base', 'x-shared': 'base' },
      })

      const client = new Client(agent)

      await client.xrpc(com.example.actor.getPreferences, {
        headers: { 'x-child': 'child', 'x-shared': 'child' },
      })

      expect(fetch).toHaveBeenCalledOnce()

      const [_url, init] = fetch.mock.calls[0]
      const headers = Object.fromEntries(new Headers(init?.headers))

      expect(headers).toMatchObject({
        'x-base': 'base',
        'x-child': 'child',
        'x-shared': 'child',
      })
    })

    it('always adds the static labelers as "redact" labelers', async () => {
      using _ = vi
        .spyOn(Client, 'appLabelers', 'get')
        .mockReturnValue(['did:plc:staticlabeler'])

      const fetchHandler = vi.fn<FetchHandler>(async (_url, _init) => {
        return Response.json({ preferences: [] })
      })

      const client = new Client(fetchHandler)

      await client.xrpc(com.example.actor.getPreferences, {
        labelers: ['did:plc:dynamiclabeler'],
      })

      expect(fetchHandler).toHaveBeenCalledOnce()

      const [_url, init] = fetchHandler.mock.calls[0]
      const headers = new Headers(init?.headers)

      expect(headers.get('atproto-accept-labelers')).toBe(
        'did:plc:staticlabeler;redact, did:plc:dynamiclabeler',
      )
    })
  })

  describe('actions', () => {
    it('updatePreferences', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (url, init) => {
        if (url === '/xrpc/com.example.actor.getPreferences') {
          expect(init?.method).toBe('GET')
          expect(init?.body).toBeUndefined()
          return Response.json({ preferences: storedPreferences })
        } else if (url === '/xrpc/com.example.actor.putPreferences') {
          expect(init?.method).toBe('POST')
          expect(typeof init?.body).toBe('string')
          const result = com.example.actor.putPreferences.$input.schema.safeParse(
            lexParse(init?.body as string),
          )
          if (result.success) {
            storedPreferences = result.value.preferences
            return new Response(null, { status: 204 })
          } else {
            return Response.json(
              { error: 'InvalidRequest', message: result.reason.message },
              { status: 400 },
            )
          }
        } else {
          return new Response('Not Found', { status: 404 })
        }
      })

      const client = new Client(fetchHandler)

      const updatePreferences: Action<
        (pref: Preference[]) => false | Preference[],
        Preference[]
      > = async function (client, updatePreferences, options) {
        const data = await client.call(
          com.example.actor.getPreferences,
          {},
          options,
        )

        const preferences = updatePreferences(data.preferences)
        if (preferences === false) return data.preferences

        options?.signal?.throwIfAborted()

        await client.call(
          com.example.actor.putPreferences,
          { preferences },
          options,
        )

        return preferences
      }

      const upsertPreference: Action<Preference, Preference[]> =
        async function (client, pref, options) {
          return updatePreferences(
            client,
            (prefs) => [...prefs.filter((p) => p.$type !== pref.$type), pref],
            options,
          )
        }

      let storedPreferences: Preference[] = [
        com.example.actor.defs.adultContentPref.build({
          enabled: false,
        }),
        com.example.actor.defs.contentLabelPref.build({
          label: 'my-label',
          visibility: 'warn',
        }),
      ]

      expect(fetchHandler).toHaveBeenCalledTimes(0)
      expect(storedPreferences).toEqual([
        {
          $type: 'com.example.actor.defs#adultContentPref',
          enabled: false,
        },
        {
          $type: 'com.example.actor.defs#contentLabelPref',
          label: 'my-label',
          visibility: 'warn',
        },
      ])

      // Upsert adult content preference
      await client.call(
        upsertPreference,
        com.example.actor.defs.adultContentPref.build({
          enabled: true,
        }),
      )

      expect(fetchHandler).toHaveBeenCalledTimes(2)
      expect(storedPreferences).toEqual([
        {
          $type: 'com.example.actor.defs#contentLabelPref',
          label: 'my-label',
          visibility: 'warn',
        },
        {
          $type: 'com.example.actor.defs#adultContentPref',
          enabled: true,
        },
      ])

      // @ts-expect-error invalid preference value
      await client.call(upsertPreference, {
        $type: 'com.example.actor.defs#adultContentPref',
        // enabled: true,
      })

      expect(fetchHandler).toHaveBeenCalledTimes(4)
      expect(storedPreferences).toEqual([
        {
          $type: 'com.example.actor.defs#contentLabelPref',
          label: 'my-label',
          visibility: 'warn',
        },
        {
          $type: 'com.example.actor.defs#adultContentPref',
          enabled: false, // "false" default will be enforced when parsing the body
        },
      ])

      await expect(async () => {
        await client.call(upsertPreference, {
          $type: 'com.example.actor.defs#adultContentPref',
          // @ts-expect-error invalid preference value
          enabled: 'not-a-boolean',
        })
      }).rejects.toThrow('Expected boolean value')
    })
  })

  describe('query', () => {
    it('allows perfoming a GET request and parsing the response', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (url, init) => {
        expect(url).toBe('/xrpc/com.example.actor.getPreferences')
        expect(init?.method).toBe('GET')
        expect(init?.body).toBeUndefined()

        return Response.json({
          preferences: [
            {
              $type: 'com.example.actor.defs#adultContentPref',
              enabled: false,
            },
            {
              $type: 'com.example.actor.defs#someOtherPref',
              otherField: 'some value',
            },
          ],
        })
      })

      const client = new Client(fetchHandler)

      const { preferences } = await client.call(com.example.actor.getPreferences)

      expect(preferences).toEqual([
        {
          $type: 'com.example.actor.defs#adultContentPref',
          enabled: false,
        },
        {
          $type: 'com.example.actor.defs#someOtherPref',
          otherField: 'some value',
        },
      ])

      expect(fetchHandler).toHaveBeenCalledTimes(1)

      const adultContentPref = preferences.find((p) =>
        com.example.actor.defs.adultContentPref.isTypeOf(p),
      )

      expect(adultContentPref).toEqual({
        $type: 'com.example.actor.defs#adultContentPref',
        enabled: false,
      })
    })
  })

  describe('errors', () => {
    it('handles invalid XRPC error payloads', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json(
          { invalidField: 'this is not a valid xrpc error payload' },
          { status: 400 },
        )
      })

      const client = new Client(fetchHandler)

      await expect(
        client.call(com.example.actor.getPreferences),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseError)
        expect(err.message).toMatch(
          'Upstream server responded with a 400 error',
        )
        return true
      })
    })

    it('uses the status code to construct the "error"', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(null, { status: 429 })
      })

      const client = new Client(fetchHandler)

      await expect(
        client.call(com.example.actor.getPreferences),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseError)
        expect(err.error).toBe('RateLimitExceeded')
        expect(err.message).toBe('Upstream server responded with a 429 error')
        return true
      })
    })

    it('handles XRPC errors with invalid status code', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(null, { status: 302 })
      })

      const client = new Client(fetchHandler)

      await expect(
        client.call(com.example.actor.getPreferences),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcInvalidResponseError)
        expect(err.message).toMatch('Unexpected status code 302')
        return true
      })
    })

    it('handles XRPC server errors', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response('<p>Server error</p>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        })
      })

      const client = new Client(fetchHandler)

      await expect(
        client.call(com.example.actor.getPreferences),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseError)
        expect(err.error).toBe('InternalServerError')
        expect(err.message).toBe('Upstream server responded with a 500 error')
        expect(err.payload).toEqual({
          encoding: 'text/html',
          body: new Uint8Array(Buffer.from('<p>Server error</p>')),
        })
        return true
      })
    })

    it('propagates server error messages', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json(
          {
            error: 'CustomError',
            message: 'This is a custom error message from the server',
          },
          {
            status: 400,
          },
        )
      })

      const client = new Client(fetchHandler)

      await expect(
        client.call(com.example.actor.getPreferences),
      ).rejects.toMatchObject({
        name: 'XrpcResponseError',
        message: 'This is a custom error message from the server',
        payload: {
          encoding: 'application/json',
          body: {
            error: 'CustomError',
            message: 'This is a custom error message from the server',
          },
        },
      })
    })

    it('turns 401 responses into XrpcAuthenticationError', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json(
          {
            error: 'Unauthorized',
            message: 'Unauthorized access',
          },
          {
            status: 401,
            headers: {
              'www-authenticate':
                'Basic realm="example", charset="UTF-8", error="invalid_token", error_description="The access token is invalid", Bearer realm="oauth"',
            },
          },
        )
      })

      const client = new Client(fetchHandler)

      const response = await client.xrpcSafe(com.example.actor.getPreferences)

      assert(response instanceof XrpcAuthenticationError)
      expect(response.error).toBe('Unauthorized')
      expect(response.message).toBe('Unauthorized access')
      expect(response.name).toBe('XrpcAuthenticationError')
      expect(response.wwwAuthenticate).toEqual({
        Basic: {
          realm: 'example',
          charset: 'UTF-8',
          error: 'invalid_token',
          error_description: 'The access token is invalid',
        },
        Bearer: {
          realm: 'oauth',
        },
      })
    })
  })

  describe('records', () => {
    it('allows creating records', async () => {
      let currentTid = 0
      // Only works 8 times
      const nextTid = vi.fn(() => `2222222222${2 + currentTid++}22`)

      const did = 'did:plc:alice'
      const fetchHandler = vi.fn<FetchHandler>(async (url, init) => {
        expect(url).toBe('/xrpc/com.atproto.repo.createRecord')
        expect(init?.method).toBe('POST')
        expect(typeof init?.body).toBe('string')
        const payload = com.atproto.repo.createRecord.main.input.schema.parse(
          lexParse(init?.body as string),
        )

        expect(payload).toMatchObject({
          repo: did,
          collection: expect.any(String),
          record: expect.any(Object),
        })

        const rkey = payload.rkey || nextTid()
        const cid = await cidForLex(payload.record as LexValue)

        const responseBody: CreateRecordOutputBody = {
          cid: cid.toString(),
          uri: `at://${payload.repo}/${payload.collection}/${rkey}`,
        }

        return Response.json(responseBody)
      })

      const client = new Client({ fetchHandler, did })

      await expect(async () => {
        return client.create(
          com.example.feed.generator,
          {
            // @ts-expect-error invalid DID
            did: 'not-a-did',
            displayName: 'Alice Generator',
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            rkey: 'alice-generator',
            validateRequest: true,
          },
        )
      }).rejects.toThrow('Invalid DID (got "not-a-did") at $.did')

      // validate performs schema validation before making the request
      expect(fetchHandler).toHaveBeenCalledTimes(0)

      const newGenerator = await client.create(
        com.example.feed.generator,
        {
          did,
          displayName: 'Alice Generator',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          rkey: 'alice-generator',
          validate: true,
        },
      )

      expect(fetchHandler).toHaveBeenCalledTimes(1)
      expect(newGenerator.cid).toBe(
        'bafyreiad2d6jkx3mrr4pbhdcik46t4r4zjnnlvsvz7ssmz7lr765gdpngu',
      )

      const aliceGenerator = await client.create(com.example.feed.generator, {
        did,
        displayName: 'Alice Generator',
        createdAt: currentDatetimeString(),
      })

      expect(nextTid).toHaveBeenCalledTimes(1)
      expect(aliceGenerator.uri).toBe(
        `at://${did}/com.example.feed.generator/${'2'.repeat(13)}`,
      )

      const newProfile = await client.create(com.example.actor.profile, {
        displayName: 'Alice',
      })

      expect(nextTid).toHaveBeenCalledTimes(1)
      expect(fetchHandler).toHaveBeenCalledTimes(3)
      expect(newProfile.uri).toBe(
        'at://did:plc:alice/com.example.actor.profile/self',
      )

      const newPost = await client.create(com.example.feed.post, {
        text: 'Hello, world!',
        createdAt: currentDatetimeString(),
      })

      expect(nextTid).toHaveBeenCalledTimes(2)
      expect(fetchHandler).toHaveBeenCalledTimes(4)
      expect(newPost.uri).toBe(`at://${did}/com.example.feed.post/2222222222322`)
    })

    it('allows fetching records', async () => {
      const did = 'did:plc:alice'
      const fetchHandler = vi.fn<FetchHandler>(async (url, init) => {
        expect(init?.method).toBe('GET')
        const urlObj = new URL(url, 'https://example.com')
        expect(urlObj.pathname).toBe('/xrpc/com.atproto.repo.getRecord')

        const repo = urlObj.searchParams.get('repo')
        const collection = urlObj.searchParams.get('collection')
        const rkey = urlObj.searchParams.get('rkey')

        expect(repo).toBe(did)
        expect(collection).toBe(com.example.feed.post.$type)
        expect(rkey).toBe('2222222222222')

        const record = com.example.feed.post.$build({
          text: 'This is an old post',
          createdAt: '2024-01-01T00:00:00Z',
        })

        const cid = await cidForLex(record)

        const responseBody: GetRecordOutputBody = {
          cid: cid.toString(),
          uri: `at://${repo!}/${collection!}/${rkey!}` as any,
          value: record,
        }

        return Response.json(responseBody)
      })

      const client = new Client({ fetchHandler, did })

      const { value: post } = await client.get(com.example.feed.post, {
        rkey: '2222222222222',
      })

      expect(fetchHandler).toHaveBeenCalledTimes(1)
      expect(post).toMatchObject({
        $type: 'com.example.feed.post',
        text: 'This is an old post',
        createdAt: '2024-01-01T00:00:00Z',
      })

      // @TODO: using getRecord method (to check we got the cid)
    })
  })

  describe('blobs', () => {
    const fetchHandler = vi.fn(
      async (url: string, init?: RequestInit): Promise<Response> => {
        expect(url).toBe('/xrpc/com.atproto.repo.uploadBlob')
        expect(init?.method).toBe('POST')
        const headers = new Headers(init?.headers)
        const type = headers.get('content-type')!
        expect(type).toBeDefined()
        const blob =
          init?.body instanceof Blob
            ? init.body
            : ArrayBuffer.isView(init?.body) ||
                init?.body instanceof ArrayBuffer
              ? new Blob([init.body], { type })
              : (() => {
                  throw new Error('Invalid body type')
                })()

        const bytes = new Uint8Array(await blob.arrayBuffer())

        const responseBody: UploadBlobOutputBody = {
          blob: {
            $type: 'blob',
            ref: await cidForRawBytes(bytes),
            mimeType: blob.type,
            size: blob.size,
          },
        }

        return Response.json(lexToJson(responseBody))
      },
    )

    it('allows uploading blobs', async () => {
      const client = new Client(fetchHandler)
      const blob = new Blob(['hello world'], { type: 'text/plain' })

      const { body } = await client.uploadBlob(blob)

      expect(fetchHandler).toHaveBeenCalledTimes(1)
      assert(isTypedBlobRef(body.blob))
      expect(body.blob.$type).toBe('blob')
      expect(body.blob.mimeType).toBe('text/plain')
      expect(body.blob.size).toBe(11)
      expect(body.blob.ref).toEqual(
        await cidForRawBytes(new TextEncoder().encode('hello world')),
      )
    })

    it('allows uploading blobs from Uint8Array', async () => {
      const client = new Client(fetchHandler)
      const data = new TextEncoder().encode('hello world')

      const { body } = await client.uploadBlob(data)

      expect(fetchHandler).toHaveBeenCalledTimes(2)
      assert(isTypedBlobRef(body.blob))
      expect(body.blob.$type).toBe('blob')
      expect(body.blob.mimeType).toBe('application/octet-stream')
      expect(body.blob.size).toBe(11)
      expect(body.blob.ref).toEqual(
        await cidForRawBytes(new TextEncoder().encode('hello world')),
      )
    })

    it('allows uploading blobs from ArrayBuffer', async () => {
      const client = new Client(fetchHandler)
      const data = new TextEncoder().encode('hello world').buffer

      const { body } = await client.uploadBlob(data)

      expect(fetchHandler).toHaveBeenCalledTimes(3)
      assert(isTypedBlobRef(body.blob))
      expect(body.blob.$type).toBe('blob')
      expect(body.blob.mimeType).toBe('application/octet-stream')
      expect(body.blob.size).toBe(11)
      expect(body.blob.ref).toEqual(
        await cidForRawBytes(new TextEncoder().encode('hello world')),
      )
    })
  })

  describe('validateRequest option', () => {
    const did = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz' as const

    describe('create()', () => {
      it('validates locally when validateRequest: true', async () => {
        const fetchHandler = vi.fn<FetchHandler>()
        const client = new Client({ fetchHandler, did })

        await expect(
          client.create(
            com.example.feed.generator,
            {
              // @ts-expect-error invalid DID
              did: 'not-a-did',
              displayName: 'Test',
              createdAt: currentDatetimeString(),
            },
            { rkey: 'test', validateRequest: true },
          ),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof LexValidationError)
          expect(err.message).toMatch('Invalid DID')
          return true
        })

        expect(fetchHandler).not.toHaveBeenCalled()
      })

      it('skips local validation when validateRequest: false', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({
            uri: `at://${did}/com.example.feed.generator/test`,
            cid: cborCid.toString(),
          })
        })
        const client = new Client({ fetchHandler, did })

        await client.create(
          com.example.feed.generator,
          {
            // @ts-expect-error invalid DID
            did: 'not-a-did',
            displayName: 'Test',
            createdAt: currentDatetimeString(),
          },
          { rkey: 'test', validateRequest: false },
        )

        expect(fetchHandler).toHaveBeenCalled()
      })

      it('defaults to not validating', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({
            uri: `at://${did}/com.example.feed.generator/test`,
            cid: cborCid.toString(),
          })
        })
        const client = new Client({ fetchHandler, did })

        await client.create(
          com.example.feed.generator,
          {
            // @ts-expect-error invalid DID
            did: 'not-a-did',
            displayName: 'Test',
            createdAt: currentDatetimeString(),
          },
          { rkey: 'test' },
        )

        expect(fetchHandler).toHaveBeenCalled()
      })

      it('validates required fields when validateRequest: true', async () => {
        const fetchHandler = vi.fn<FetchHandler>()
        const client = new Client({ fetchHandler, did })

        await expect(
          client.create(
            com.example.feed.generator,
            // @ts-expect-error
            {
              displayName: 'Test',
            },
            { rkey: 'test', validateRequest: true },
          ),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof LexValidationError)
          expect(err.message).toMatch('Missing required key "did"')
          return true
        })

        expect(fetchHandler).not.toHaveBeenCalled()
      })

      it('validates types when validateRequest: true', async () => {
        const fetchHandler = vi.fn<FetchHandler>()
        const client = new Client({ fetchHandler, did })

        await expect(
          client.create(
            com.example.feed.generator,
            {
              did,
              // @ts-expect-error wrong type
              displayName: 123,
              createdAt: currentDatetimeString(),
            },
            { rkey: 'test', validateRequest: true },
          ),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof LexValidationError)
          expect(err.message).toMatch('Expected string value type (got 123)')
          return true
        })

        expect(fetchHandler).not.toHaveBeenCalled()
      })
    })

    describe('put()', () => {
      it('validates locally when validateRequest: true', async () => {
        const fetchHandler = vi.fn<FetchHandler>()
        const client = new Client({ fetchHandler, did })

        await expect(
          client.put(
            com.example.actor.profile,
            {
              // @ts-expect-error invalid data
              displayName: 123,
            },
            { validateRequest: true },
          ),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof LexValidationError)
          expect(err.message).toMatch('Expected string value type (got 123)')
          return true
        })

        expect(fetchHandler).not.toHaveBeenCalled()
      })

      it('skips local validation when validateRequest: false', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({
            uri: `at://${did}/com.example.actor.profile/self`,
            cid: cborCid.toString(),
          })
        })
        const client = new Client({ fetchHandler, did })

        await client.put(
          com.example.actor.profile,
          {
            // @ts-expect-error invalid data
            displayName: 123,
          },
          { validateRequest: false },
        )

        expect(fetchHandler).toHaveBeenCalled()
      })

      it('defaults to not validating', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({
            uri: `at://${did}/com.example.actor.profile/self`,
            cid: cborCid.toString(),
          })
        })
        const client = new Client({ fetchHandler, did })

        await client.put(com.example.actor.profile, {
          // @ts-expect-error invalid data
          displayName: 123,
        })

        expect(fetchHandler).toHaveBeenCalled()
      })
    })

    describe('applyWrites()', () => {
      it('allows applying multiple writes in a single request', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async (path, init) => {
          const request = new Request(new URL(path, 'http://localhost'), init)
          expect(request.method).toBe('POST')

          const payload = com.atproto.repo.applyWrites.main.input.schema.parse(
            lexParse(await request.text()),
          )

          let cid = 0
          const body: ApplyWritesOutputBody = {
            results: payload.writes.map((write) => {
              if (com.atproto.repo.applyWrites.create.$isTypeOf(write)) {
                return com.atproto.repo.applyWrites.createResult.$build({
                  uri: `at://${did}/${write.collection}/${write.rkey ?? '2222222222222'}`,
                  cid: `${++cid}`,
                })
              }
              if (com.atproto.repo.applyWrites.update.$isTypeOf(write)) {
                return com.atproto.repo.applyWrites.updateResult.$build({
                  uri: `at://${did}/${write.collection}/${write.rkey}`,
                  cid: `${++cid}`,
                })
              }
              if (com.atproto.repo.applyWrites.delete.$isTypeOf(write)) {
                return com.atproto.repo.applyWrites.deleteResult.$build({
                  uri: `at://${did}/${write.collection}/${write.rkey}`,
                })
              }

              throw new Error('Unknown write type')
            }),
          }
          return Response.json(body)
        })

        const client = new Client(
          { fetchHandler, did },
          { validateResponse: false },
        )

        const { body } = await client.applyWrites((op) => [
          op.create(com.example.feed.post, {
            text: 'Hello, world!',
            createdAt: currentDatetimeString(),
          }),

          op.update(com.example.actor.profile, {
            displayName: 'Alice',
          }),

          op.delete(com.example.feed.post, {
            rkey: '2222222222224',
          }),

          op.delete(com.example.actor.profile),
        ])

        expect(fetchHandler).toHaveBeenCalledTimes(1)
        expect(body.results).toEqual([
          {
            $type: 'com.atproto.repo.applyWrites#createResult',
            uri: `at://${did}/com.example.feed.post/2222222222222`,
            cid: '1',
          },
          {
            $type: 'com.atproto.repo.applyWrites#updateResult',
            uri: `at://${did}/com.example.actor.profile/self`,
            cid: '2',
          },
          {
            $type: 'com.atproto.repo.applyWrites#deleteResult',
            uri: `at://${did}/com.example.feed.post/2222222222224`,
          },
          {
            $type: 'com.atproto.repo.applyWrites#deleteResult',
            uri: `at://${did}/com.example.actor.profile/self`,
          },
        ])
      })

      it('expects an options argument when rkey is needed', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async (path, init) => {
          const request = new Request(new URL(path, 'http://localhost'), init)
          expect(request.method).toBe('POST')
          const payload = com.atproto.repo.applyWrites.main.input.schema.parse(
            lexParse(await request.text()),
          )

          expect(payload.writes).toHaveLength(2)

          return Response.json({})
        })
        const client = new Client(
          { fetchHandler, did },
          { validateResponse: false },
        )

        await client.applyWrites(function* (op) {
          yield op.delete(com.example.actor.profile)
          yield op.update(com.example.actor.profile, { displayName: 'Alice' })

          expect(() => {
            // @ts-expect-error
            op.update(com.example.feed.post, {
              text: 'Alice',
              createdAt: currentDatetimeString(),
            })
          }).toThrow()

          expect(() => {
            // @ts-expect-error
            op.delete(com.example.feed.post)
          }).toThrow()
        })

        expect(fetchHandler).toHaveBeenCalledTimes(1)
      })
    })
  })
})
