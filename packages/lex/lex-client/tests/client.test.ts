import { LexValue, cidForLex } from '@atproto/lex-cbor'
import { lexParse } from '@atproto/lex-json'
import { Action, Client } from '..'
import * as app from './lexicons/app.js'
import * as com from './lexicons/com.js'

type Preference = app.bsky.actor.defs.Preferences[number]

describe('utils', () => {
  describe('TypedObjectSchema', () => {
    it('overrides $type when building an object', () => {
      const _r = app.bsky.actor.defs.adultContentPref.build({
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
      const fetchHandler = jest.fn(
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
            const { preferences } =
              app.bsky.actor.putPreferences.$input.schema.parse(
                lexParse(init?.body as string),
              )
            storedPreferences = preferences
            return new Response(null, { status: 204 })
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
        const data = await client.call(app.bsky.actor.getPreferences, options)

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

      expect(async () => {
        // @ts-expect-error invalid preference value
        await client.call(upsertPreference, {
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: 'not-a-boolean',
        })
      }).rejects.toThrow()
    })
  })

  describe('query', () => {
    it('allows perfoming a GET request and parsing the response', async () => {
      const fetchHandler = jest.fn(
        async (url: string, init?: RequestInit): Promise<Response> => {
          expect(url).toBe('/xrpc/app.bsky.actor.getPreferences')
          expect(init?.method).toBe('GET')

          const responsePayload = {
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

          return new Response(JSON.stringify(responsePayload), {
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

  describe('records', () => {
    it('allows creating records', async () => {
      let currentTid = 0
      // Only works 8 times
      const nextTid = jest.fn(() => `2222222222${2 + currentTid++}22`)

      const did = 'did:plc:alice'
      const fetchHandler = jest.fn(
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

          const responsePayload: com.atproto.repo.createRecord.Output = {
            cid: cid.toString(),
            uri: `at://${payload.repo}/${payload.collection}/${rkey}`,
          }

          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      )

      const client = new Client({ fetchHandler, did })

      await expect(async () => {
        await client.create(
          app.bsky.feed.generator,
          {
            // @ts-expect-error invalid DID
            did: 'not-a-did',
            displayName: 'Alice Generator',
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            rkey: 'alice-generator',
            validate: true,
          },
        )
      }).rejects.toThrow()

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
          did: 'no-a-did',
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
      const fetchHandler = jest.fn(
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

          const responsePayload: com.atproto.repo.getRecord.Output = {
            cid: cid.toString(),
            uri: `at://${repo!}/${collection!}/${rkey!}` as any,
            value: record,
          }

          return new Response(JSON.stringify(responsePayload), {
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
})
