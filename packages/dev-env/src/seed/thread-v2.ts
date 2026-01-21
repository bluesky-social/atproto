import { AppBskyFeedPost } from '@atproto/api'
import type { DatabaseSchema } from '@atproto/bsky'
import { TestNetwork } from '../network'
import { TestNetworkNoAppView } from '../network-no-appview'
import { RecordRef, SeedClient } from './client'

type User = {
  id: string
  did: string
  email: string
  handle: string
  password: string
  displayName: string
  description: string
  selfLabels: undefined
}

function createUserStub(name: string): User {
  return {
    id: name,
    // @ts-ignore overwritten during seeding
    did: undefined,
    email: `${name}@test.com`,
    handle: `${name}.test`,
    password: `${name}-pass`,
    displayName: name,
    description: `hi im ${name} label_me`,
    selfLabels: undefined,
  }
}

async function createUsers<T extends readonly string[]>(
  seedClient: SeedClient<TestNetwork | TestNetworkNoAppView>,
  prefix: string,
  handles: T,
) {
  const stubs = handles.reduce((acc, handle) => {
    acc[handle] = createUserStub(`${prefix}-${handle}`)
    return acc
  }, {}) as Record<(typeof handles)[number], User>
  const users = await Promise.all(
    handles
      .map((h) => prefix + '-' + h)
      .map(async (handle) => {
        const user = createUserStub(handle)
        await seedClient.createAccount(handle, user)
        user.did = seedClient.dids[handle]
        return user
      }),
  )
  return users.reduce((acc, user) => {
    const id = user.id.split('-')[1]
    acc[id].did = user.did
    return acc
  }, stubs)
}

type ReplyFn = (
  replyAuthor: User,
  overridesOrCb?: Partial<AppBskyFeedPost.Record> | ReplyCb,
  maybeReplyCb?: ReplyCb,
) => Promise<void>

type ReplyCb = (r: ReplyFn) => Promise<void>

export const TAG_BUMP_DOWN = 'down'
export const TAG_HIDE = 'hide'

const rootReplyFnBuilder = <T extends TestNetworkNoAppView>(
  sc: SeedClient<T>,
  root: RecordRef,
  parent: RecordRef,
  prevBreadcrumbs: string,
  posts: Record<
    string,
    | Awaited<ReturnType<SeedClient['post']>>
    | Awaited<ReturnType<SeedClient['reply']>>
  >,
): ReplyFn => {
  let index = 0
  return async (
    replyAuthor: User,
    overridesOrCb?: Partial<AppBskyFeedPost.Record> | ReplyCb,
    maybeReplyCb?: ReplyCb,
  ) => {
    let overrides: Partial<AppBskyFeedPost.Record> | undefined
    let replyCb: ReplyCb | undefined
    if (overridesOrCb && typeof overridesOrCb === 'function') {
      replyCb = overridesOrCb
    } else {
      overrides = overridesOrCb
      replyCb = maybeReplyCb
    }

    const breadcrumbs = prevBreadcrumbs
      ? `${prevBreadcrumbs}.${index++}`
      : `${index++}`
    const text = breadcrumbs
    const reply = await sc.reply(
      replyAuthor.did,
      root,
      parent,
      text,
      undefined,
      undefined,
      overrides,
    )
    posts[breadcrumbs] = reply
    // Await for this post to be processed before replying to it.
    replyCb && (await sc.network.processAll())
    await replyCb?.(rootReplyFnBuilder(sc, root, reply.ref, breadcrumbs, posts))
  }
}

const createThread = async <T extends TestNetworkNoAppView>(
  sc: SeedClient<T>,
  rootAuthor: User,
  overridesOrCb?: Partial<AppBskyFeedPost.Record> | ReplyCb,
  maybeReplyCb?: ReplyCb,
) => {
  let overrides: Partial<AppBskyFeedPost.Record> | undefined
  let replyCb: ReplyCb | undefined
  if (overridesOrCb && typeof overridesOrCb === 'function') {
    replyCb = overridesOrCb
  } else {
    overrides = overridesOrCb
    replyCb = maybeReplyCb
  }

  const replies: Record<string, Awaited<ReturnType<SeedClient['reply']>>> = {}
  const breadcrumbs = ''
  const text = 'root'
  const root = await sc.post(
    rootAuthor.did,
    text,
    undefined,
    undefined,
    undefined,
    overrides,
  )
  // Await for this post to be processed before replying to it.
  replyCb && (await sc.network.processAll())
  await replyCb?.(
    rootReplyFnBuilder(sc, root.ref, root.ref, breadcrumbs, replies),
  )
  return { root, replies }
}

export async function simple(sc: SeedClient<TestNetwork>, prefix = 'simple') {
  const users = await createUsers(sc, prefix, [
    'op',
    'alice',
    'bob',
    'carol',
  ] as const)
  const { op, alice, bob, carol } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(op, async (r) => {
      await r(op)
    })
    await r(alice)
    await r(bob, async (r) => {
      await r(alice)
    })
    await r(carol)
  })

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function long(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'long', [
    'op',
    'alice',
    'bob',
    'carol',
    'dan',
  ] as const)
  const { op, alice, bob, carol, dan } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(op, async (r) => {
      await r(op, async (r) => {
        await r(op, async (r) => {
          await r(op, async (r) => {
            await r(op)
          })
        })
        await r(op)
      })
    })

    await r(alice)
    await r(bob)
    await r(carol)

    await r(op, async (r) => {
      await r(op, async (r) => {
        await r(alice, async (r) => {
          await r(op, async (r) => {
            await r(op)
          })
        })
      })
    })

    await r(alice)
    await r(bob)
    await r(carol)
  })

  await sc.like(op.did, r['5'].ref)
  await sc.like(bob.did, r['5'].ref)
  await sc.like(carol.did, r['5'].ref)
  await sc.like(dan.did, r['5'].ref)

  await sc.like(op.did, r['6'].ref)
  await sc.like(alice.did, r['6'].ref)
  await sc.like(carol.did, r['6'].ref)

  await sc.like(op.did, r['7'].ref)
  await sc.like(bob.did, r['7'].ref)

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function deep(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'deep', ['op'] as const)
  const { op } = users

  let counter = 0
  const { root, replies: r } = await createThread(sc, op, async (r) => {
    const recursiveReply = async (rFn: ReplyFn) => {
      if (counter < 18) {
        counter++
        await rFn(op, async (r) => recursiveReply(r))
      }
    }
    await recursiveReply(r)
  })

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function branchingFactor(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'bf', ['op', 'bob'] as const)
  const { op, bob } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(bob, async (r) => {
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
    })
    await r(bob, async (r) => {
      await r(bob, async (r) => {
        // This is the only case in this seed where a reply has 1 reply instead of 4,
        // to have cases of different lengths in the same tree.
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
    })
    await r(bob, async (r) => {
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
    })
    await r(bob, async (r) => {
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
        // This is the only case in this seed where a reply has 5 replies instead of 4,
        // to have cases of different lengths in the same tree.
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
      await r(bob, async (r) => {
        await r(bob)
        await r(bob)
        await r(bob)
        await r(bob)
      })
    })
  })

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function annotateMoreReplies(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'mr', ['op', 'alice'] as const)
  const { op, alice } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(alice, async (r) => {
      await r(alice, async (r) => {
        await r(alice, async (r) => {
          await r(alice, async (r) => {
            // more replies... (below = 4)
            await r(alice, async (r) => {
              await r(alice)
            })
            await r(alice)
            await r(alice, async (r) => {
              await r(alice, async (r) => {
                await r(alice)
              })
            })
            await r(alice)
            await r(alice)
          })
        })
      })
      await r(alice, async (r) => {
        await r(alice, async (r) => {
          await r(alice)
        })
      })
    })
    await r(alice, async (r) => {
      await r(alice, async (r) => {
        await r(alice)
        await r(alice)
        // more replies... (branchingFactor = 2)
        await r(alice)
        await r(alice)
        await r(alice)
      })
      await r(alice, async (r) => {
        await r(alice)
        await r(alice)
      })
      // more replies... (branchingFactor = 2)
      await r(alice)
    })
    await r(alice) // anchor reply not limited by branchingFactor
  })

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function annotateOP(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'op', ['op', 'alice', 'bob'] as const)
  const { op, alice, bob } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(op, async (r) => {
      await r(op, async (r) => {
        await r(op)
      })
    })
    await r(alice, async (r) => {
      await r(alice)
    })
    await r(op, async (r) => {
      await r(bob, async (r) => {
        await r(op)
      })
    })
  })

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function sort(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'sort', [
    'op',
    'alice',
    'bob',
    'carol',
  ] as const)
  const { op, alice, bob, carol } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    // 0 likes
    await r(alice, async (r) => {
      await r(carol) // 0 likes
      await r(alice) // 2 likes
      await r(bob) // 1 like
    })
    // 3 likes
    await r(carol, async (r) => {
      await r(bob) // 1 like
      await r(carol) // 2 likes
      await r(alice) // 0 likes
    })
    // 2 likes
    await r(bob, async (r) => {
      await r(bob) // 2 likes
      await r(alice) // 1 like
      await r(carol) // 0 likes
    })
  })

  // likes depth 1
  await sc.like(alice.did, r['2'].ref)
  await sc.like(carol.did, r['2'].ref)
  await sc.like(op.did, r['1'].ref) // op like
  await sc.like(bob.did, r['1'].ref)
  await sc.like(carol.did, r['1'].ref)

  // likes depth 2
  await sc.like(bob.did, r['0.1'].ref)
  await sc.like(carol.did, r['0.1'].ref)
  await sc.like(op.did, r['0.2'].ref) // op like
  await sc.like(bob.did, r['1.1'].ref)
  await sc.like(carol.did, r['1.1'].ref)
  await sc.like(bob.did, r['1.0'].ref)
  await sc.like(bob.did, r['2.0'].ref)
  await sc.like(carol.did, r['2.0'].ref)
  await sc.like(bob.did, r['2.1'].ref)

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function bumpOpAndViewer(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'bumpOV', [
    'op',
    'viewer',
    'alice',
    'bob',
    'carol',
  ] as const)
  const { op, viewer, alice, bob, carol } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    // 1 like
    await r(alice, async (r) => {
      await r(carol) // 0 likes
      await r(alice) // 2 likes
      await r(bob) // 1 like
      await r(viewer) // 0 likes
      await r(op) // 0 likes
    })
    // 3 likes
    await r(carol, async (r) => {
      await r(bob) // 1 like
      await r(carol) // 2 likes
      await r(op) // 0 likes
      await r(viewer) // 1 like
      await r(alice) // 0 likes
    })
    // 2 likes
    await r(bob, async (r) => {
      await r(viewer) // 0 likes
      await r(bob) // 4 likes
      await r(op) // 0 likes
      await r(alice) // 1 like
      await r(carol) // 1 like
    })
    // 0 likes
    await r(op, async (r) => {
      await r(viewer) // 0 likes
      await r(bob) // 0 likes
      await r(op) // 0 likes
      await r(alice) // 0 likes
      await r(carol) // 0 likes
    })
    // 0 likes
    await r(viewer, async (r) => {
      await r(bob) // 1 like
      await r(carol) // 1 like
      await r(op) // 0 likes
      await r(viewer) // 0 likes
      await r(alice) // 0 likes
    })
  })

  // likes depth 1
  await sc.like(alice.did, r['2'].ref)
  await sc.like(carol.did, r['2'].ref)
  await sc.like(viewer.did, r['0'].ref)
  await sc.like(op.did, r['1'].ref) // op like
  await sc.like(bob.did, r['1'].ref)
  await sc.like(carol.did, r['1'].ref)

  // likes depth 2
  await sc.like(bob.did, r['0.1'].ref)
  await sc.like(carol.did, r['0.1'].ref)
  await sc.like(op.did, r['0.2'].ref) // op like
  await sc.like(bob.did, r['1.1'].ref)
  await sc.like(carol.did, r['1.1'].ref)
  await sc.like(bob.did, r['1.0'].ref)
  await sc.like(alice.did, r['2.1'].ref)
  await sc.like(bob.did, r['2.1'].ref)
  await sc.like(carol.did, r['2.1'].ref)
  await sc.like(viewer.did, r['2.1'].ref)
  await sc.like(bob.did, r['1.3'].ref)
  await sc.like(bob.did, r['2.3'].ref)
  await sc.like(viewer.did, r['2.4'].ref)
  await sc.like(viewer.did, r['4.0'].ref)
  await sc.like(alice.did, r['4.1'].ref)

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function bumpGroupSorting(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'bumpGS', [
    'op',
    'viewer',
    'alice',
  ] as const)
  const { op, viewer, alice } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(viewer)
    await r(op)
    await r(alice)
    await r(op)
    await r(viewer)
    await r(op)
    await r(alice)
    await r(viewer)
  })

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function bumpFollows(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'bumpF', [
    'op',
    'viewerF',
    'viewerNoF',
    'alice',
    'bob',
    'carol',
  ] as const)

  const { op, viewerF, viewerNoF, alice, bob, carol } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(alice)
    await r(bob)
    await r(carol)
    await r(op)
    await r(viewerF)
    await r(viewerNoF)
  })

  await sc.follow(viewerF.did, alice.did)
  await sc.follow(viewerF.did, bob.did)
  // Does not follow carol.

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function blockDeletionAuth(
  sc: SeedClient<TestNetwork>,
  labelerDid: string,
) {
  const users = await createUsers(sc, 'bda', [
    'op',
    'opBlocked',
    'alice',
    'auth',
    'blocker',
    'blocked',
  ] as const)

  const { op, opBlocked, alice, auth, blocker, blocked } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    // 1p block, hidden for `blocked`.
    await r(blocker, async (r) => {
      await r(alice)
    })

    // 3p block, hidden for all.
    await r(opBlocked, async (r) => {
      await r(op)
      await r(alice)
    })

    // Deleted, hidden for all.
    await r(alice, async (r) => {
      await r(alice)
    })

    // User configured to only be seen by authenticated users.
    // Requires the test sets a `!no-unauthenticated` label for this user.
    await r(auth, async (r) => {
      // Another auth-only to show that the parent chain is preserved in the thread.
      await r(auth, async (r) => {
        await r(alice)
      })
    })
  })

  await sc.deletePost(alice.did, r['2'].ref.uri)
  await sc.block(blocker.did, blocked.did)
  await sc.block(op.did, opBlocked.did)

  const db = sc.network.bsky.db.db
  await createLabel(db, {
    src: labelerDid,
    uri: auth.did,
    cid: '',
    val: '!no-unauthenticated',
  })

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function mutes(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'mutes', [
    'op',
    'opMuted',
    'alice',
    'muted',
    'muter',
  ] as const)

  const { op, opMuted, alice, muted, muter } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(opMuted, async (r) => {
      await r(alice)
      await r(muted)
    })

    await r(muted, async (r) => {
      await r(opMuted)
      await r(alice)
    })
  })

  await sc.mute(op.did, opMuted.did)
  await sc.mute(muter.did, muted.did)

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function threadgated(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'tg', [
    'op',
    'opMuted',
    'viewer',
    'alice',
    'bob',
  ] as const)

  const { op, opMuted, alice, bob } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    // Muted moves down below threadgated.
    await r(opMuted)

    // Threadgated moves down.
    await r(alice, async (r) => {
      await r(alice)
      await r(bob)
      await r(op) // OP moves up.
    })

    await r(bob, async (r) => {
      await r(alice)
      await r(bob) // Threadgated is omitted if fetched from the root.
      await r(op) // OP moves down.
    })
  })

  await sc.agent.app.bsky.feed.threadgate.create(
    {
      repo: op.did,
      rkey: root.ref.uri.rkey,
    },
    {
      post: root.ref.uriStr,
      createdAt: new Date().toISOString(),
      hiddenReplies: [r['1'].ref.uriStr, r['2.1'].ref.uriStr],
    },
    sc.getHeaders(op.did),
  )

  // Just throw a mute there to test the prioritization between muted and threadgated.
  await sc.mute(op.did, opMuted.did)

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function tags(sc: SeedClient<TestNetwork>) {
  const users = await createUsers(sc, 'tags', [
    'op',
    'alice',
    'down',
    'following',
    'hide',
    'viewer',
  ] as const)

  const { op, alice, down, following, hide, viewer } = users

  const { root, replies: r } = await createThread(sc, op, async (r) => {
    await r(alice, async (r) => {
      await r(alice)
      await r(down)
      await r(hide)
    })
    await r(down, async (r) => {
      await r(alice)
      await r(down)
      await r(hide)
    })
    await r(hide, async (r) => {
      await r(alice)
      await r(down)
      await r(hide)
    })
    await r(op)
    await r(viewer)
    await r(following)
  })

  await sc.network.processAll()

  await sc.follow(viewer.did, following.did)

  const db = sc.network.bsky.db.db
  await createTag(db, { uri: r['1'].ref.uriStr, val: TAG_BUMP_DOWN })
  await createTag(db, { uri: r['0.1'].ref.uriStr, val: TAG_BUMP_DOWN })
  await createTag(db, { uri: r['1.1'].ref.uriStr, val: TAG_BUMP_DOWN })
  await createTag(db, { uri: r['2.1'].ref.uriStr, val: TAG_BUMP_DOWN })

  await createTag(db, { uri: r['2'].ref.uriStr, val: TAG_HIDE })
  await createTag(db, { uri: r['0.2'].ref.uriStr, val: TAG_HIDE })
  await createTag(db, { uri: r['1.2'].ref.uriStr, val: TAG_HIDE })
  await createTag(db, { uri: r['2.2'].ref.uriStr, val: TAG_HIDE })

  // Neither tag affect op, viewer.
  await createTag(db, { uri: r['3'].ref.uriStr, val: TAG_BUMP_DOWN })
  await createTag(db, { uri: r['4'].ref.uriStr, val: TAG_HIDE })

  // Tags affect following depending on the config to prioritize following.
  await createTag(db, { uri: r['5'].ref.uriStr, val: TAG_HIDE })

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

const createLabel = async (
  db: DatabaseSchema,
  opts: {
    src: string
    uri: string
    cid: string
    val: string
    exp?: string
  },
) => {
  await db
    .insertInto('label')
    .values({
      uri: opts.uri,
      cid: opts.cid,
      val: opts.val,
      cts: new Date().toISOString(),
      exp: opts.exp ?? null,
      neg: false,
      src: opts.src,
    })
    .execute()
}

const createTag = async (
  db: DatabaseSchema,
  opts: {
    uri: string
    val: string
  },
) => {
  await db
    .updateTable('record')
    .set({
      tags: JSON.stringify([opts.val]),
    })
    .where('uri', '=', opts.uri)
    .returningAll()
    .execute()
}
