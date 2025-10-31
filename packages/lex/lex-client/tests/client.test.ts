import { Server, createServer } from 'node:http'
import { lexParse } from '@atproto/lex-core'
import { Action, Client } from '..'
import * as app from './lexicons/app.js'

type Preference = app.bsky.actor.defs.Preferences[number]

const updatePreferences: Action<
  (pref: Preference[]) => false | Preference[],
  Preference[]
> = async function (client, updatePreferences, options) {
  const data = await client.call(app.bsky.actor.getPreferences, options)

  const preferences = updatePreferences(data.preferences)
  if (preferences === false) return data.preferences

  options?.signal?.throwIfAborted()

  await client.call(app.bsky.actor.putPreferences, { preferences }, options)

  return preferences
}

const upsertPreference: Action<Preference, Preference[]> = async function (
  client,
  pref,
  options,
) {
  return updatePreferences(
    client,
    (prefs) => [...prefs.filter((p) => p.$type !== pref.$type), pref],
    options,
  )
}

describe('Client', () => {
  let server: Server
  let serverOrigin: string

  const preferences: Preference[] = [
    {
      $type: 'app.bsky.actor.defs#adultContentPref',
      enabled: false,
    },
  ]

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      console.error('Received request:', req.method, req.url)
      res.setHeader('connection', 'close')
      try {
        const { method } = req
        const [path, _query] = req.url!.split('?')
        if (
          method === 'GET' &&
          path === '/xrpc/app.bsky.actor.getPreferences'
        ) {
          res
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ preferences }))
        } else if (
          method === 'POST' &&
          path === '/xrpc/app.bsky.actor.putPreferences'
        ) {
          const body = app.bsky.actor.putPreferences.main.input.schema.parse(
            lexParse(Buffer.concat(await req.toArray()).toString('utf-8')),
          )
          preferences.splice(0, preferences.length, ...body.preferences)
          res.setHeader('content-length', '0').end(null)
        } else {
          res.statusCode = 404
          res.end('{"error": "NotFound"}')
        }
      } catch (err) {
        console.error('Server error:', err)
        if (res.headersSent) return res.end()
        if (res.statusCode === 200) res.statusCode = 400
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      } finally {
        if (!req.readableEnded) {
          for await (const _chunk of req) {
            // drain
          }
        }
      }
    })
    serverOrigin = await new Promise<string>((resolve, reject) => {
      server.on('error', reject)
      server.listen(0, () => {
        server.removeListener('error', reject)
        const address = server.address()
        if (address && typeof address === 'object') {
          resolve(`http://localhost:${address.port}`)
        } else {
          reject(new Error('Failed to get server address'))
        }
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  describe('call', () => {
    it('should call a query with parameters and options', async () => {
      const client = new Client({
        did: 'did:example:alice',
        service: serverOrigin,
      })

      console.error('client: ', client)

      const { preferences } = await client.call(app.bsky.actor.getPreferences)

      console.error('Preferences: ', preferences)

      const isOtherPreference = (
        pref: object,
      ): pref is { otherField: string } => {
        return 'otherField' in pref && typeof pref.otherField === 'string'
      }

      const expectString = (value: string) => {
        value
      }

      for (const pref of preferences) {
        if (app.bsky.actor.defs.adultContentPref.is(pref)) {
          pref.$type
          pref.enabled
        } else {
          pref.$type

          await client.call(upsertPreference, pref)

          // @ts-expect-error
          expectString(pref.otherField)
          if (isOtherPreference(pref)) {
            pref.otherField
            expectString(pref.otherField)
          }
        }
      }

      const _r = app.bsky.actor.defs.adultContentPref.build({
        $type: 'foo' as const,
        enabled: true,
      })

      _r.$type

      console.error('_r.$type: ', _r.$type)

      await client.call(
        upsertPreference,
        app.bsky.actor.defs.adultContentPref.build({
          enabled: true,
        }),
      )

      // @ts-expect-error invalid preference value
      await client.call(upsertPreference, {
        $type: app.bsky.actor.defs.adultContentPref.$type,
        // enabled: true,
      })

      const newGenerator = await client.create(
        app.bsky.feed.generator,
        {
          // @ts-expect-error invalid DID
          did: 'not-a-did',
          displayName: 'Alice Generator',
          createdAt: new Date().toISOString(),
        },
        {
          rkey: 'alice-generator',
        },
      )

      newGenerator.body.cid

      const newGeneratorInvalid = await client.create(
        // @ts-expect-error an "rkey" option is required for feed generator records
        app.bsky.feed.generator,
        {
          did: 'no-a-did',
          displayName: 'Alice Generator',
          createdAt: new Date().toISOString(),
        },
      )

      newGeneratorInvalid.body.cid

      const newProfile = await client.create(app.bsky.actor.profile, {
        displayName: 'Alice',
      })

      newProfile.body.cid

      const newPost = await client.create(app.bsky.feed.post, {
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      })

      newPost.body.cid

      const oldPostRes = await client.get(app.bsky.feed.post, {
        rkey: 'qsd',
      })

      oldPostRes.text

      const oldPost = await client.get(app.bsky.feed.post, {
        rkey: 'qsd',
      })

      oldPost.text
    })
  })
})
