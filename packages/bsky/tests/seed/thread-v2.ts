import { addHours, subHours } from 'date-fns'
import { AppBskyFeedPost } from '@atproto/api'
import {
  RecordRef,
  SeedClient,
  TestNetwork,
  TestNetworkNoAppView,
} from '@atproto/dev-env'
import { User, createUsers } from './util'

type ReplyFn = (
  replyAuthor: User,
  overridesOrCb?: Partial<AppBskyFeedPost.Record> | ReplyCb,
  maybeReplyCb?: ReplyCb,
) => Promise<void>

type ReplyCb = (r: ReplyFn) => Promise<void>

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
      ? `${prevBreadcrumbs}_${index++}`
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

export async function simple(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
  prefix = 'simple',
) {
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

export async function long(sc: SeedClient<TestNetwork | TestNetworkNoAppView>) {
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

export async function deep(sc: SeedClient<TestNetwork | TestNetworkNoAppView>) {
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

export async function nestedBranchingFactor(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'nbf', ['op', 'bob'] as const)
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

export async function annotateOP(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
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

export async function sortingNoOpOrViewer(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'sort1', [
    'op',
    'alice',
    'bob',
    'carol',
  ] as const)
  const { op, alice, bob, carol } = users

  const rootCreatedAt = subHours(new Date(), 10)
  const ov = (hoursAfterRoot = 0) => ({
    createdAt: addHours(rootCreatedAt, hoursAfterRoot).toISOString(),
  })

  const { root, replies: r } = await createThread(sc, op, ov(), async (r) => {
    // 0 likes
    await r(alice, ov(1), async (r) => {
      await r(carol, ov(2)) // 0 likes
      await r(alice, ov(3)) // 2 likes
      await r(bob, ov(4)) // 1 like
    })
    // 3 likes
    await r(carol, ov(3), async (r) => {
      await r(bob, ov(4)) // 1 like
      await r(carol, ov(5)) // 2 likes
      await r(alice, ov(6)) // 0 likes
    })
    // 2 likes
    await r(bob, ov(5), async (r) => {
      await r(bob, ov(6)) // 2 likes
      await r(alice, ov(7)) // 1 like
      await r(carol, ov(8)) // 0 likes
    })
  })

  // likes depth 1
  await sc.like(alice.did, r['2'].ref)
  await sc.like(carol.did, r['2'].ref)
  await sc.like(op.did, r['1'].ref) // op like, bumps hotness.
  await sc.like(bob.did, r['1'].ref)
  await sc.like(carol.did, r['1'].ref)

  // likes depth 2
  await sc.like(bob.did, r['0_1'].ref)
  await sc.like(carol.did, r['0_1'].ref)
  await sc.like(op.did, r['0_2'].ref) // op like, bumps hotness.
  await sc.like(bob.did, r['1_1'].ref)
  await sc.like(carol.did, r['1_1'].ref)
  await sc.like(bob.did, r['1_0'].ref)
  await sc.like(bob.did, r['2_0'].ref)
  await sc.like(carol.did, r['2_0'].ref)
  await sc.like(bob.did, r['2_1'].ref)

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function sortingWithOpAndViewer(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'sort2', [
    'op',
    'viewer',
    'alice',
    'bob',
    'carol',
  ] as const)
  const { op, viewer, alice, bob, carol } = users

  const rootCreatedAt = subHours(new Date(), 10)
  const ov = (hoursAfterRoot = 0) => ({
    createdAt: addHours(rootCreatedAt, hoursAfterRoot).toISOString(),
  })

  const { root, replies: r } = await createThread(sc, op, ov(), async (r) => {
    // 1 like
    await r(alice, ov(0), async (r) => {
      await r(carol, ov(1)) // 0 likes
      await r(alice, ov(2)) // 2 likes
      await r(bob, ov(3)) // 1 like
      await r(viewer, ov(4)) // 0 likes
      await r(op, ov(5)) // 0 likes
    })
    // 3 likes
    await r(carol, ov(1), async (r) => {
      await r(bob, ov(2)) // 1 like
      await r(carol, ov(3)) // 2 likes
      await r(op, ov(4)) // 0 likes
      await r(viewer, ov(5)) // 1 like
      await r(alice, ov(6)) // 0 likes
    })
    // 2 likes
    await r(bob, ov(2), async (r) => {
      await r(viewer, ov(3)) // 0 likes
      await r(bob, ov(4)) // 4 likes
      await r(op, ov(5)) // 0 likes
      await r(alice, ov(6)) // 1 like
      await r(carol, ov(7)) // 1 like
    })
    // 0 likes
    await r(op, ov(3), async (r) => {
      await r(viewer, ov(4)) // 0 likes
      await r(bob, ov(5)) // 0 likes
      await r(op, ov(6)) // 0 likes
      await r(alice, ov(7)) // 0 likes
      await r(carol, ov(8)) // 0 likes
    })
    // 0 likes
    await r(viewer, ov(4), async (r) => {
      await r(bob, ov(5)) // 1 like
      await r(carol, ov(6)) // 1 like
      await r(op, ov(7)) // 0 likes
      await r(viewer, ov(8)) // 0 likes
      await r(alice, ov(9)) // 0 likes
    })
  })

  // likes depth 1
  await sc.like(alice.did, r['2'].ref)
  await sc.like(carol.did, r['2'].ref)
  await sc.like(viewer.did, r['0'].ref)
  await sc.like(op.did, r['1'].ref) // op like, bumps hotness.
  await sc.like(bob.did, r['1'].ref)
  await sc.like(carol.did, r['1'].ref)

  // likes depth 2
  await sc.like(bob.did, r['0_1'].ref)
  await sc.like(carol.did, r['0_1'].ref)
  await sc.like(op.did, r['0_2'].ref) // op like, bumps hotness.
  await sc.like(bob.did, r['1_1'].ref)
  await sc.like(carol.did, r['1_1'].ref)
  await sc.like(bob.did, r['1_0'].ref)
  await sc.like(alice.did, r['2_1'].ref)
  await sc.like(bob.did, r['2_1'].ref)
  await sc.like(carol.did, r['2_1'].ref)
  await sc.like(viewer.did, r['2_1'].ref)
  await sc.like(bob.did, r['1_3'].ref)
  await sc.like(bob.did, r['2_3'].ref)
  await sc.like(viewer.did, r['2_4'].ref)
  await sc.like(viewer.did, r['4_0'].ref)
  await sc.like(alice.did, r['4_1'].ref)

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}

export async function sortingWithFollows(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'follow', [
    'op',
    'viewerF',
    'viewerNoF',
    'alice',
    'bob',
    'carol',
  ] as const)

  const { op, viewerF, viewerNoF, alice, bob, carol } = users

  const rootCreatedAt = subHours(new Date(), 10)
  const ov = (hoursAfterRoot = 0) => ({
    createdAt: addHours(rootCreatedAt, hoursAfterRoot).toISOString(),
  })

  const { root, replies: r } = await createThread(sc, op, ov(), async (r) => {
    await r(alice, ov(0))
    await r(bob, ov(1))
    await r(carol, ov(2))
    await r(op, ov(3))
    await r(viewerF, ov(4))
    await r(viewerNoF, ov(5))
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
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
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

    // User configured to only be seend by authenticated users.
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

  return {
    seedClient: sc,
    users,
    root,
    r,
  }
}
