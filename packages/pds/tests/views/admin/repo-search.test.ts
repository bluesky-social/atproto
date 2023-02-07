import AtpAgent from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/moderationAction'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  paginateAll,
  adminAuth,
} from '../../_util'
import { SeedClient } from '../../seeds/client'
import usersBulkSeed from '../../seeds/users-bulk'
import { Database } from '../../../src'

describe('pds admin repo search view', () => {
  let agent: AtpAgent
  let db: Database
  let close: CloseFn
  let sc: SeedClient
  let headers: { [s: string]: string }

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_admin_repo_search',
    })
    close = server.close
    db = server.ctx.db
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await usersBulkSeed(sc)
    headers = { authorization: adminAuth() }
  })

  afterAll(async () => {
    await close()
  })

  beforeAll(async () => {
    await sc.takeModerationAction({
      action: TAKEDOWN,
      subject: {
        $type: 'com.atproto.repo.repoRef',
        did: sc.dids['cara-wiegand69.test'],
      },
    })
  })

  it('gives relevant results', async () => {
    const result = await agent.api.com.atproto.admin.searchRepos(
      { term: 'car' },
      { headers },
    )

    const handles = result.data.repos.map((u) => u.handle)

    const shouldContain = [
      'cara-wiegand69.test', // Present despite repo takedown
      'eudora-dietrich4.test', // Carol Littel
      'shane-torphy52.test', //Sadie Carter
      'aliya-hodkiewicz.test', // Carlton Abernathy IV
      'carlos6.test',
      'carolina-mcdermott77.test',
    ]

    shouldContain.forEach((handle) => expect(handles).toContain(handle))

    if (db.dialect === 'pg') {
      expect(handles).toContain('cayla-marquardt39.test') // Fuzzy match supported by postgres
    } else {
      expect(handles).not.toContain('cayla-marquardt39.test')
    }

    const shouldNotContain = [
      'sven70.test',
      'hilario84.test',
      'santa-hermann78.test',
      'dylan61.test',
      'preston-harris.test',
      'loyce95.test',
      'melyna-zboncak.test',
    ]

    shouldNotContain.forEach((handle) => expect(handles).not.toContain(handle))

    if (db.dialect === 'pg') {
      expect(forSnapshot(result.data.repos)).toMatchInlineSnapshot(snapPg)
    } else {
      expect(forSnapshot(result.data.repos)).toMatchInlineSnapshot(snapSqlite)
    }
  })

  it('paginates with term', async () => {
    const results = (results) => results.flatMap((res) => res.users)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.com.atproto.admin.searchRepos(
        { term: 'p', before: cursor, limit: 3 },
        { headers },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.repos.length).toBeLessThanOrEqual(3),
    )

    const full = await agent.api.com.atproto.admin.searchRepos(
      { term: 'p' },
      { headers },
    )

    expect(full.data.repos.length).toBeGreaterThan(5)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('paginates without term', async () => {
    const results = (results) => results.flatMap((res) => res.repos)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.com.atproto.admin.searchRepos(
        { before: cursor, limit: 3 },
        { headers },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator, 5)
    paginatedAll.forEach((res) =>
      expect(res.repos.length).toBeLessThanOrEqual(3),
    )

    const full = await agent.api.com.atproto.admin.searchRepos(
      { limit: 15 },
      { headers },
    )

    expect(full.data.repos.length).toEqual(15)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})

// Not using jest snapshots because it doesn't handle the conditional pg/sqlite very well:
// you can achieve it using named snapshots, but when you run the tests for pg the test suite fails
// since the sqlite snapshots appear obsolete to jest (and vice-versa when you run the sqlite suite).

const snapPg = `
Array [
  Object {
    "account": Object {
      "email": "cara-wiegand69.test@bsky.app",
    },
    "did": "user(0)",
    "handle": "cara-wiegand69.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {
      "takedownId": 1,
    },
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "eudora-dietrich4.test@bsky.app",
    },
    "did": "user(1)",
    "handle": "eudora-dietrich4.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Carol Littel",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "shane-torphy52.test@bsky.app",
    },
    "did": "user(2)",
    "handle": "shane-torphy52.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Sadie Carter",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "aliya-hodkiewicz.test@bsky.app",
    },
    "did": "user(3)",
    "handle": "aliya-hodkiewicz.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Carlton Abernathy IV",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "carlos6.test@bsky.app",
    },
    "did": "user(4)",
    "handle": "carlos6.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "carolina-mcdermott77.test@bsky.app",
    },
    "did": "user(5)",
    "handle": "carolina-mcdermott77.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Latoya Windler",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "cayla-marquardt39.test@bsky.app",
    },
    "did": "user(6)",
    "handle": "cayla-marquardt39.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Rachel Kshlerin",
      },
    ],
  },
]
`

const snapSqlite = `
Array [
  Object {
    "account": Object {
      "email": "aliya-hodkiewicz.test@bsky.app",
    },
    "did": "user(0)",
    "handle": "aliya-hodkiewicz.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Carlton Abernathy IV",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "cara-wiegand69.test@bsky.app",
    },
    "did": "user(1)",
    "handle": "cara-wiegand69.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {
      "currentAction": Object {
        "action": "com.atproto.admin.moderationAction#takedown",
        "id": 1,
      },
    },
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "carlos6.test@bsky.app",
    },
    "did": "user(2)",
    "handle": "carlos6.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "carolina-mcdermott77.test@bsky.app",
    },
    "did": "user(3)",
    "handle": "carolina-mcdermott77.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Latoya Windler",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "eudora-dietrich4.test@bsky.app",
    },
    "did": "user(4)",
    "handle": "eudora-dietrich4.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Carol Littel",
      },
    ],
  },
  Object {
    "account": Object {
      "email": "shane-torphy52.test@bsky.app",
    },
    "did": "user(5)",
    "handle": "shane-torphy52.test",
    "indexedAt": "1970-01-01T00:00:00.000Z",
    "moderation": Object {},
    "relatedRecords": Array [
      Object {
        "$type": "app.bsky.system.declaration",
        "actorType": "app.bsky.system.actorUser",
      },
      Object {
        "$type": "app.bsky.actor.profile",
        "avatar": Object {
          "cid": "cids(0)",
          "mimeType": "image/jpeg",
        },
        "description": "",
        "displayName": "Sadie Carter",
      },
    ],
  },
]
`
