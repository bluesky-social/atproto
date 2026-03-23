import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { LexValue, cidForLex } from '@atproto/lex-cbor'
import { cidForRawBytes, parseCid } from '@atproto/lex-data'
import { lexParse, lexToJson } from '@atproto/lex-json'
import {
  $Typed,
  LexValidationError,
  toDatetimeString,
} from '@atproto/lex-schema'
import {
  Action,
  Client,
  FetchHandler,
  XrpcAuthenticationError,
  XrpcInvalidResponseError,
  XrpcResponseError,
} from '../src/index.js'
import { app, com } from './lexicons/index.js'

const cborCid = parseCid(
  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
  { flavor: 'cbor' },
)

type Preference = app.bsky.actor.defs.Preferences[number]

describe('utils', () => {
  describe('TypedObjectSchema', () => {
    describe('build()', () => {
      it('overrides $type when building an object', () => {
        function expectAdultContentPref(
          _: app.bsky.actor.defs.AdultContentPref,
        ) {}
        function expectTypedAdultContentPref(
          _: $Typed<app.bsky.actor.defs.AdultContentPref>,
        ) {}

        const pref = app.bsky.actor.defs.adultContentPref.build({
          // @ts-expect-error
          $type: 'foo',
          enabled: true,
        })

        expectAdultContentPref(pref)
        expectTypedAdultContentPref(pref)

        expect(pref).toStrictEqual({
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: true,
        })

        expectTypeOf(pref).toEqualTypeOf<{
          $type: 'app.bsky.actor.defs#adultContentPref'
          enabled: boolean
        }>()
      })
    })
  })
})

describe('Client', () => {
  describe('actions', () => {
    it('updatePreferences', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (url, init) => {
        if (url === '/xrpc/app.bsky.actor.getPreferences') {
          expect(init?.method).toBe('GET')
          expect(init?.body).toBeUndefined()
          return Response.json({ preferences: storedPreferences })
        } else if (url === '/xrpc/app.bsky.actor.putPreferences') {
          expect(init?.method).toBe('POST')
          expect(typeof init?.body).toBe('string')
          const result = app.bsky.actor.putPreferences.$input.schema.safeParse(
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

      const client = new Client({ fetchHandler })

      const updatePreferences: Action<
        (pref: Preference[]) => false | Preference[],
        Preference[]
      > = async function (client, updatePreferences, options) {
        const data = await client.call(
          app.bsky.actor.getPreferences,
          {},
          options,
        )

        const preferences = updatePreferences(data.preferences)
        if (preferences === false) return data.preferences

        options?.signal?.throwIfAborted()

        await client.call(
          app.bsky.actor.putPreferences,
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
        app.bsky.actor.defs.adultContentPref.build({
          enabled: false,
        }),
        app.bsky.actor.defs.contentLabelPref.build({
          label: 'my-label',
          visibility: 'warn',
        }),
      ]

      expect(fetchHandler).toHaveBeenCalledTimes(0)
      expect(storedPreferences).toEqual([
        {
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: false,
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'my-label',
          visibility: 'warn',
        },
      ])

      // Upsert adult content preference
      await client.call(
        upsertPreference,
        app.bsky.actor.defs.adultContentPref.build({
          enabled: true,
        }),
      )

      expect(fetchHandler).toHaveBeenCalledTimes(2)
      expect(storedPreferences).toEqual([
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'my-label',
          visibility: 'warn',
        },
        {
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: true,
        },
      ])

      // @ts-expect-error invalid preference value
      await client.call(upsertPreference, {
        $type: 'app.bsky.actor.defs#adultContentPref',
        // enabled: true,
      })

      expect(fetchHandler).toHaveBeenCalledTimes(4)
      expect(storedPreferences).toEqual([
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'my-label',
          visibility: 'warn',
        },
        {
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: false, // "false" default will be enforced when parsing the body
        },
      ])

      await expect(async () => {
        await client.call(upsertPreference, {
          $type: 'app.bsky.actor.defs#adultContentPref',
          // @ts-expect-error invalid preference value
          enabled: 'not-a-boolean',
        })
      }).rejects.toThrow('Expected boolean value')
    })
  })

  describe('query', () => {
    it('allows perfoming a GET request and parsing the response', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async (url, init) => {
        expect(url).toBe('/xrpc/app.bsky.actor.getPreferences')
        expect(init?.method).toBe('GET')
        expect(init?.body).toBeUndefined()

        return Response.json({
          preferences: [
            {
              $type: 'app.bsky.actor.defs#adultContentPref',
              enabled: false,
            },
            {
              $type: 'app.bsky.actor.defs#someOtherPref',
              otherField: 'some value',
            },
          ],
        })
      })

      const client = new Client({ fetchHandler })

      const { preferences } = await client.call(app.bsky.actor.getPreferences)

      expect(preferences).toEqual([
        {
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: false,
        },
        {
          $type: 'app.bsky.actor.defs#someOtherPref',
          otherField: 'some value',
        },
      ])

      expect(fetchHandler).toHaveBeenCalledTimes(1)

      const adultContentPref = preferences.find((p) =>
        app.bsky.actor.defs.adultContentPref.isTypeOf(p),
      )

      expect(adultContentPref).toEqual({
        $type: 'app.bsky.actor.defs#adultContentPref',
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

      const client = new Client({ fetchHandler })

      await expect(
        client.call(app.bsky.actor.getPreferences),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseError)
        expect(err.message).toMatch(
          'Upstream server responded with a 400 error',
        )
        return true
      })
    })

    it('extracts error message from RFC7807 JSON payloads', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return Response.json({ title: 'Custom error title' }, { status: 400 })
      })

      const client = new Client({ fetchHandler })

      await expect(
        client.call(app.bsky.actor.getPreferences),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseError)
        expect(err.message).toBe('Upstream server responded with a 400 error')
        expect(err.payload).toEqual({
          encoding: 'application/json',
          body: { title: 'Custom error title' },
        })
        return true
      })
    })

    it('uses plain text error message as error message', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response('Not a JSON body', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        })
      })

      const client = new Client({ fetchHandler })

      await expect(
        client.call(app.bsky.actor.getPreferences),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseError)
        expect(err.error).toBe('InvalidRequest')
        expect(err.message).toBe('Upstream server responded with a 400 error')
        return true
      })
    })

    it('uses the status code to construct the "error"', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(null, { status: 429 })
      })

      const client = new Client({ fetchHandler })

      await expect(
        client.call(app.bsky.actor.getPreferences),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcResponseError)
        expect(err.error).toBe('RateLimitExceeded')
        expect(err.message).toBe('Upstream server responded with a 429 error')
        return true
      })
    })

    it('handles XRPC errors with invalid status code', async () => {
      const fetchHandler = vi.fn<FetchHandler>(async () => {
        return new Response(null, {
          status: 302,
        })
      })

      const client = new Client({ fetchHandler })

      await expect(
        client.call(app.bsky.actor.getPreferences),
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

      const client = new Client({ fetchHandler })

      await expect(
        client.call(app.bsky.actor.getPreferences),
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

      const client = new Client({ fetchHandler })

      await expect(
        client.call(app.bsky.actor.getPreferences),
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

      const client = new Client({ fetchHandler })

      const response = await client.xrpcSafe(app.bsky.actor.getPreferences)

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

        const responseBody: com.atproto.repo.createRecord.$OutputBody = {
          cid: cid.toString(),
          uri: `at://${payload.repo}/${payload.collection}/${rkey}`,
        }

        return Response.json(responseBody)
      })

      const client = new Client({ fetchHandler, did })

      await expect(async () => {
        return client.create(
          app.bsky.feed.generator,
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
        app.bsky.feed.generator,
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
        'bafyreihx5eurnmsnj6ulfby3icl4ebh6pliwuqaze25z4ejitnt23b4vw4',
      )

      const aliceGenerator = await client.create(app.bsky.feed.generator, {
        did,
        displayName: 'Alice Generator',
        createdAt: toDatetimeString(new Date()),
      })

      expect(nextTid).toHaveBeenCalledTimes(1)
      expect(aliceGenerator.uri).toBe(
        `at://${did}/app.bsky.feed.generator/${'2'.repeat(13)}`,
      )

      const newProfile = await client.create(app.bsky.actor.profile, {
        displayName: 'Alice',
      })

      expect(nextTid).toHaveBeenCalledTimes(1)
      expect(fetchHandler).toHaveBeenCalledTimes(3)
      expect(newProfile.uri).toBe(
        'at://did:plc:alice/app.bsky.actor.profile/self',
      )

      const newPost = await client.create(app.bsky.feed.post, {
        text: 'Hello, world!',
        createdAt: toDatetimeString(new Date()),
      })

      expect(nextTid).toHaveBeenCalledTimes(2)
      expect(fetchHandler).toHaveBeenCalledTimes(4)
      expect(newPost.uri).toBe(`at://${did}/app.bsky.feed.post/2222222222322`)
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
        expect(collection).toBe(app.bsky.feed.post.$type)
        expect(rkey).toBe('2222222222222')

        const record = app.bsky.feed.post.$build({
          text: 'This is an old post',
          createdAt: '2024-01-01T00:00:00Z',
        })

        const cid = await cidForLex(record)

        const responseBody: com.atproto.repo.getRecord.$OutputBody = {
          cid: cid.toString(),
          uri: `at://${repo!}/${collection!}/${rkey!}` as any,
          value: record,
        }

        return Response.json(responseBody)
      })

      const client = new Client({ fetchHandler, did })

      const { value: post } = await client.get(app.bsky.feed.post, {
        rkey: '2222222222222',
      })

      expect(fetchHandler).toHaveBeenCalledTimes(1)
      expect(post).toMatchObject({
        $type: 'app.bsky.feed.post',
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

        const responseBody: com.atproto.repo.uploadBlob.$OutputBody = {
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
      const client = new Client({ fetchHandler })
      const blob = new Blob(['hello world'], { type: 'text/plain' })

      const { body } = await client.uploadBlob(blob)

      expect(fetchHandler).toHaveBeenCalledTimes(1)
      expect(body.blob.$type).toBe('blob')
      expect(body.blob.mimeType).toBe('text/plain')
      expect(body.blob.size).toBe(11)
      expect(body.blob.ref).toEqual(
        await cidForRawBytes(new TextEncoder().encode('hello world')),
      )
    })

    it('allows uploading blobs from Uint8Array', async () => {
      const client = new Client({ fetchHandler })
      const data = new TextEncoder().encode('hello world')

      const { body } = await client.uploadBlob(data)

      expect(fetchHandler).toHaveBeenCalledTimes(2)
      expect(body.blob.$type).toBe('blob')
      expect(body.blob.mimeType).toBe('application/octet-stream')
      expect(body.blob.size).toBe(11)
      expect(body.blob.ref).toEqual(
        await cidForRawBytes(new TextEncoder().encode('hello world')),
      )
    })

    it('allows uploading blobs from ArrayBuffer', async () => {
      const client = new Client({ fetchHandler })
      const data = new TextEncoder().encode('hello world').buffer

      const { body } = await client.uploadBlob(data)

      expect(fetchHandler).toHaveBeenCalledTimes(3)
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
            app.bsky.feed.generator,
            {
              // @ts-expect-error invalid DID
              did: 'not-a-did',
              displayName: 'Test',
              createdAt: toDatetimeString(new Date()),
            },
            { rkey: 'test', validateRequest: true },
          ),
        ).rejects.toThrow('Invalid DID')

        // Should not make request if validation fails
        expect(fetchHandler).not.toHaveBeenCalled()
      })

      it('skips local validation when validateRequest: false', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({
            uri: `at://${did}/app.bsky.feed.generator/test`,
            cid: cborCid.toString(),
          })
        })
        const client = new Client({ fetchHandler, did })

        // Should make request even with invalid data
        await client.create(
          app.bsky.feed.generator,
          {
            // @ts-expect-error invalid DID
            did: 'not-a-did',
            displayName: 'Test',
            createdAt: toDatetimeString(new Date()),
          },
          { rkey: 'test', validateRequest: false },
        )

        expect(fetchHandler).toHaveBeenCalled()
      })

      it('defaults to not validating', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({
            uri: `at://${did}/app.bsky.feed.generator/test`,
            cid: cborCid.toString(),
          })
        })
        const client = new Client({ fetchHandler, did })

        // Should make request without validation by default
        await client.create(
          app.bsky.feed.generator,
          {
            // @ts-expect-error invalid DID
            did: 'not-a-did',
            displayName: 'Test',
            createdAt: toDatetimeString(new Date()),
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
            app.bsky.feed.generator,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {
              displayName: 'Test',
            } as any,
            { rkey: 'test', validateRequest: true },
          ),
        ).rejects.toThrow()

        expect(fetchHandler).not.toHaveBeenCalled()
      })

      it('validates types when validateRequest: true', async () => {
        const fetchHandler = vi.fn<FetchHandler>()
        const client = new Client({ fetchHandler, did })

        await expect(
          client.create(
            app.bsky.feed.generator,
            {
              did,
              // @ts-expect-error wrong type
              displayName: 123,
              createdAt: toDatetimeString(new Date()),
            },
            { rkey: 'test', validateRequest: true },
          ),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof LexValidationError)
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
            app.bsky.actor.profile,
            {
              // @ts-expect-error invalid data
              displayName: 123,
            },
            { validateRequest: true },
          ),
        ).rejects.toThrow()

        expect(fetchHandler).not.toHaveBeenCalled()
      })

      it('skips local validation when validateRequest: false', async () => {
        const fetchHandler = vi.fn<FetchHandler>(async () => {
          return Response.json({
            uri: `at://${did}/app.bsky.actor.profile/self`,
            cid: cborCid.toString(),
          })
        })
        const client = new Client({ fetchHandler, did })

        await client.put(
          app.bsky.actor.profile,
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
            uri: `at://${did}/app.bsky.actor.profile/self`,
            cid: cborCid.toString(),
          })
        })
        const client = new Client({ fetchHandler, did })

        await client.put(app.bsky.actor.profile, {
          // @ts-expect-error invalid data
          displayName: 123,
        })

        expect(fetchHandler).toHaveBeenCalled()
      })
    })
  })
})
