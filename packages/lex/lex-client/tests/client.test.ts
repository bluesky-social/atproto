import { describe, expect, it, vi } from 'vitest'
import { LexValue, cidForLex } from '@atproto/lex-cbor'
import { cidForRawBytes } from '@atproto/lex-data'
import { lexParse, lexStringify } from '@atproto/lex-json'
import { Action, Client } from '../src/index.js'
import { app, com } from './lexicons/index.js'

type Preference = app.bsky.actor.defs.Preferences[number]

describe('utils', () => {
  describe('TypedObjectSchema', () => {
    it('overrides $type when building an object', () => {
      const _r = app.bsky.actor.defs.adultContentPref.build({
        // @ts-expect-error
        $type: 'foo',
        enabled: true,
      })
      expect(_r.$type).toBe('app.bsky.actor.defs#adultContentPref')
    })
  })
})

describe('Client', () => {
  describe('actions', () => {
    it('updatePreferences', async () => {
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
          if (url === '/xrpc/app.bsky.actor.getPreferences') {
            return new Response(
              JSON.stringify({ preferences: storedPreferences }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          } else if (url === '/xrpc/app.bsky.actor.putPreferences') {
            expect(typeof init?.body).toBe('string')
            const result =
              app.bsky.actor.putPreferences.$input.schema.safeParse(
                lexParse(init?.body as string),
              )
            if (result.success) {
              storedPreferences = result.value.preferences
              return new Response(null, { status: 204 })
            } else {
              return new Response(
                JSON.stringify({
                  error: 'InvalidRequest',
                  message: result.reason.message,
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }
          } else {
            return new Response('Not Found', { status: 404 })
          }
        },
      )

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
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
          expect(url).toBe('/xrpc/app.bsky.actor.getPreferences')
          expect(init?.method).toBe('GET')

          const responseBody = {
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
          }

          return new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      )

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
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
          expect(url).toBe('/xrpc/app.bsky.actor.getPreferences')
          expect(init?.method).toBe('GET')

          const responseBody = {
            invalidField: 'this is not a valid xrpc error payload',
          }

          return new Response(JSON.stringify(responseBody), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      )

      const client = new Client({ fetchHandler })

      await expect(client.call(app.bsky.actor.getPreferences)).rejects.toThrow(
        'Upstream server returned an invalid response payload',
      )
    })

    it('handles XRPC errors with invalid body data', async () => {
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
          expect(url).toBe('/xrpc/app.bsky.actor.getPreferences')
          expect(init?.method).toBe('GET')

          return new Response('Not a JSON body', {
            status: 400,
            headers: { 'Content-Type': 'text/plain' },
          })
        },
      )

      const client = new Client({ fetchHandler })

      await expect(client.call(app.bsky.actor.getPreferences)).rejects.toThrow(
        'Upstream server returned an invalid response payload',
      )
    })

    it('handles XRPC errors with invalid status code', async () => {
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
          expect(url).toBe('/xrpc/app.bsky.actor.getPreferences')
          expect(init?.method).toBe('GET')

          return new Response(null, {
            status: 302,
          })
        },
      )

      const client = new Client({ fetchHandler })

      await expect(client.call(app.bsky.actor.getPreferences)).rejects.toThrow(
        'Upstream server returned an invalid status code',
      )
    })

    it('handles XRPC server errors', async () => {
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
          expect(url).toBe('/xrpc/app.bsky.actor.getPreferences')
          expect(init?.method).toBe('GET')

          return new Response('<p>Server error</p>', {
            status: 500,
            headers: { 'Content-Type': 'text/html' },
          })
        },
      )

      const client = new Client({ fetchHandler })

      await expect(client.call(app.bsky.actor.getPreferences)).rejects.toThrow(
        'Upstream server encountered an error',
      )
    })

    it('propatages server error messages', async () => {
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
          expect(url).toBe('/xrpc/app.bsky.actor.getPreferences')
          expect(init?.method).toBe('GET')

          const responseBody = {
            error: 'CustomError',
            message: 'This is a custom error message from the server',
          }

          return new Response(JSON.stringify(responseBody), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      )

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
  })

  describe('records', () => {
    it('allows creating records', async () => {
      let currentTid = 0
      // Only works 8 times
      const nextTid = vi.fn(() => `2222222222${2 + currentTid++}22`)

      const did = 'did:plc:alice'
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
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

          const responseBody: com.atproto.repo.createRecord.OutputBody = {
            cid: cid.toString(),
            uri: `at://${payload.repo}/${payload.collection}/${rkey}`,
          }

          return new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      )

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
      }).rejects.toThrow('Invalid DID at $.did')

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

      const aliceGenerator = await client.create(
        // @ts-expect-error an "rkey" option is required for feed generator records
        app.bsky.feed.generator,
        {
          did,
          displayName: 'Alice Generator',
          createdAt: new Date().toISOString(),
        },
      )

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
        createdAt: new Date().toISOString(),
      })

      expect(nextTid).toHaveBeenCalledTimes(2)
      expect(fetchHandler).toHaveBeenCalledTimes(4)
      expect(newPost.uri).toBe(`at://${did}/app.bsky.feed.post/2222222222322`)
    })

    it('allows fetching records', async () => {
      const did = 'did:plc:alice'
      const fetchHandler = vi.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
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

          const responseBody: com.atproto.repo.getRecord.OutputBody = {
            cid: cid.toString(),
            uri: `at://${repo!}/${collection!}/${rkey!}` as any,
            value: record,
          }

          return new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      )

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

        const responseBody: com.atproto.repo.uploadBlob.OutputBody = {
          blob: {
            $type: 'blob',
            ref: await cidForRawBytes(bytes),
            mimeType: blob.type,
            size: blob.size,
          },
        }

        return new Response(lexStringify(responseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
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
})
