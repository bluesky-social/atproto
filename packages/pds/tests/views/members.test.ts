import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  constantDate,
  paginateAll,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds member views', () => {
  let client: AtpServiceClient
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  const scene = 'scene.test'
  const otherScene = 'other-scene.test'
  const carolScene = 'carol-scene.test'

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_members',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  const getCursors = (items: { createdAt?: string }[]) =>
    items.map((item) => item.createdAt ?? constantDate)

  const getSortedCursors = (items: { createdAt?: string }[]) =>
    getCursors(items).sort((a, b) => tstamp(b) - tstamp(a))

  const tstamp = (x: string) => new Date(x).getTime()

  it('fetches members', async () => {
    const sceneMembers = await client.app.bsky.graph.getMembers(
      { actor: sc.scenes[scene].did },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(sceneMembers.data)).toMatchSnapshot()
    expect(getCursors(sceneMembers.data.members)).toEqual(
      getSortedCursors(sceneMembers.data.members),
    )

    const otherSceneMembers = await client.app.bsky.graph.getMembers(
      { actor: sc.scenes[otherScene].did },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(otherSceneMembers.data)).toMatchSnapshot()
    expect(getCursors(otherSceneMembers.data.members)).toEqual(
      getSortedCursors(otherSceneMembers.data.members),
    )

    const carolSceneMembers = await client.app.bsky.graph.getMembers(
      { actor: sc.scenes[carolScene].did },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(carolSceneMembers.data)).toMatchSnapshot()
    expect(getCursors(carolSceneMembers.data.members)).toEqual(
      getSortedCursors(carolSceneMembers.data.members),
    )
  })

  it('fetches members by handle', async () => {
    const byDid = await client.app.bsky.graph.getMembers(
      { actor: sc.scenes[scene].did },
      { headers: sc.getHeaders(alice) },
    )
    const byHandle = await client.app.bsky.graph.getMembers(
      { actor: sc.scenes[scene].handle },
      { headers: sc.getHeaders(alice) },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates members', async () => {
    const results = (results) => results.flatMap((res) => res.members)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.graph.getMembers(
        {
          actor: sc.scenes[scene].did,
          before: cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.members.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.graph.getMembers(
      { actor: sc.scenes[scene].did },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.members.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches memberships', async () => {
    const aliceMemberships = await client.app.bsky.graph.getMemberships(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceMemberships.data)).toMatchSnapshot()
    expect(getCursors(aliceMemberships.data.memberships)).toEqual(
      getSortedCursors(aliceMemberships.data.memberships),
    )

    const bobMemberships = await client.app.bsky.graph.getMemberships(
      { actor: sc.dids.bob },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(bobMemberships.data)).toMatchSnapshot()
    expect(getCursors(bobMemberships.data.memberships)).toEqual(
      getSortedCursors(bobMemberships.data.memberships),
    )

    const carolMemberships = await client.app.bsky.graph.getMemberships(
      { actor: sc.dids.carol },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(carolMemberships.data)).toMatchSnapshot()
    expect(getCursors(carolMemberships.data.memberships)).toEqual(
      getSortedCursors(carolMemberships.data.memberships),
    )

    const danMemberships = await client.app.bsky.graph.getMemberships(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(danMemberships.data)).toMatchSnapshot()
    expect(getCursors(danMemberships.data.memberships)).toEqual(
      getSortedCursors(danMemberships.data.memberships),
    )
  })

  it('fetches memberships by handle', async () => {
    const byDid = await client.app.bsky.graph.getMemberships(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )
    const byHandle = await client.app.bsky.graph.getMemberships(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice) },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates memberships', async () => {
    const results = (results) => results.flatMap((res) => res.memberships)
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.graph.getMemberships(
        {
          actor: sc.dids.alice,
          before: cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.memberships.length).toBeLessThanOrEqual(2),
    )

    const full = await client.app.bsky.graph.getMemberships(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.memberships.length).toEqual(3)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('includes membership state in getProfile', async () => {
    const profile1 = await client.app.bsky.actor.getProfile(
      { actor: scene },
      { headers: sc.getHeaders(alice) },
    )
    expect(profile1.data.myState?.member).toBeTruthy()
    const profile2 = await client.app.bsky.actor.getProfile(
      { actor: otherScene },
      { headers: sc.getHeaders(alice) },
    )
    expect(profile2.data.myState?.member).toBeFalsy()
  })
})
