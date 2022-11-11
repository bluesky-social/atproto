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

describe('pds assertion views', () => {
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
      dbPostgresSchema: 'views_assertions',
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

  it('requires an author or subject', async () => {
    const promise = client.app.bsky.graph.getAssertions()
    await expect(promise).rejects.toThrow('Must provide an author or subject')
  })

  it('fetches assertions by author', async () => {
    const sceneAssertions = await client.app.bsky.graph.getAssertions({
      author: sc.scenes[scene].did,
    })

    expect(forSnapshot(sceneAssertions.data)).toMatchSnapshot()
    expect(getCursors(sceneAssertions.data.assertions)).toEqual(
      getSortedCursors(sceneAssertions.data.assertions),
    )

    const otherSceneAssertions = await client.app.bsky.graph.getAssertions({
      author: sc.scenes[otherScene].did,
    })

    expect(forSnapshot(otherSceneAssertions.data)).toMatchSnapshot()
    expect(getCursors(otherSceneAssertions.data.assertions)).toEqual(
      getSortedCursors(otherSceneAssertions.data.assertions),
    )

    const carolSceneAssertions = await client.app.bsky.graph.getAssertions({
      author: sc.scenes[carolScene].did,
    })

    expect(forSnapshot(carolSceneAssertions.data)).toMatchSnapshot()
    expect(getCursors(carolSceneAssertions.data.assertions)).toEqual(
      getSortedCursors(carolSceneAssertions.data.assertions),
    )
  })

  it('fetches assertions by subject', async () => {
    const aliceAssertions = await client.app.bsky.graph.getAssertions({
      subject: sc.accounts[alice].did,
    })

    expect(forSnapshot(aliceAssertions.data)).toMatchSnapshot()
    expect(getCursors(aliceAssertions.data.assertions)).toEqual(
      getSortedCursors(aliceAssertions.data.assertions),
    )
  })

  it('fetches assertions by author & subject', async () => {
    const aliceSceneAssertions = await client.app.bsky.graph.getAssertions({
      author: sc.scenes[scene].did,
      subject: sc.accounts[alice].did,
    })

    expect(forSnapshot(aliceSceneAssertions.data)).toMatchSnapshot()
    expect(getCursors(aliceSceneAssertions.data.assertions)).toEqual(
      getSortedCursors(aliceSceneAssertions.data.assertions),
    )
  })

  it('fetches assertions by author filtered by confirmation status', async () => {
    const sceneAssertionsConfirmed = await client.app.bsky.graph.getAssertions({
      author: sc.scenes[scene].did,
      confirmed: true,
    })

    expect(forSnapshot(sceneAssertionsConfirmed.data)).toMatchSnapshot()
    expect(getCursors(sceneAssertionsConfirmed.data.assertions)).toEqual(
      getSortedCursors(sceneAssertionsConfirmed.data.assertions),
    )

    const sceneAssertionsUnconfirmed =
      await client.app.bsky.graph.getAssertions({
        author: sc.scenes[scene].did,
        confirmed: false,
      })

    expect(forSnapshot(sceneAssertionsUnconfirmed.data)).toMatchSnapshot()
    expect(getCursors(sceneAssertionsUnconfirmed.data.assertions)).toEqual(
      getSortedCursors(sceneAssertionsUnconfirmed.data.assertions),
    )

    const otherSceneAssertionsConfirmed =
      await client.app.bsky.graph.getAssertions({
        author: sc.scenes[otherScene].did,
        confirmed: true,
      })

    expect(forSnapshot(otherSceneAssertionsConfirmed.data)).toMatchSnapshot()
    expect(getCursors(otherSceneAssertionsConfirmed.data.assertions)).toEqual(
      getSortedCursors(otherSceneAssertionsConfirmed.data.assertions),
    )

    const otherSceneAssertionsUnconfirmed =
      await client.app.bsky.graph.getAssertions({
        author: sc.scenes[otherScene].did,
        confirmed: false,
      })

    expect(forSnapshot(otherSceneAssertionsUnconfirmed.data)).toMatchSnapshot()
    expect(getCursors(otherSceneAssertionsUnconfirmed.data.assertions)).toEqual(
      getSortedCursors(otherSceneAssertionsUnconfirmed.data.assertions),
    )

    const carolSceneAssertionsConfirmed =
      await client.app.bsky.graph.getAssertions({
        author: sc.scenes[carolScene].did,
        confirmed: true,
      })

    expect(forSnapshot(carolSceneAssertionsConfirmed.data)).toMatchSnapshot()
    expect(getCursors(carolSceneAssertionsConfirmed.data.assertions)).toEqual(
      getSortedCursors(carolSceneAssertionsConfirmed.data.assertions),
    )

    const carolSceneAssertionsUnconfirmed =
      await client.app.bsky.graph.getAssertions({
        author: sc.scenes[carolScene].did,
        confirmed: true,
      })

    expect(forSnapshot(carolSceneAssertionsUnconfirmed.data)).toMatchSnapshot()
    expect(getCursors(carolSceneAssertionsUnconfirmed.data.assertions)).toEqual(
      getSortedCursors(carolSceneAssertionsUnconfirmed.data.assertions),
    )
  })

  it('fetches assertions by author filtered by type', async () => {
    const sceneAssertionsMember = await client.app.bsky.graph.getAssertions({
      author: sc.scenes[scene].did,
      assertion: 'app.bsky.graph.assertMember',
    })

    expect(forSnapshot(sceneAssertionsMember.data)).toMatchSnapshot()
    expect(getCursors(sceneAssertionsMember.data.assertions)).toEqual(
      getSortedCursors(sceneAssertionsMember.data.assertions),
    )

    const sceneAssertionsCreator = await client.app.bsky.graph.getAssertions({
      author: sc.scenes[scene].did,
      assertion: 'app.bsky.graph.assertCreator',
    })

    expect(forSnapshot(sceneAssertionsCreator.data)).toMatchSnapshot()
    expect(getCursors(sceneAssertionsCreator.data.assertions)).toEqual(
      getSortedCursors(sceneAssertionsCreator.data.assertions),
    )
  })

  it('paginates assertions', async () => {
    const paginator = async (cursor?: string) => {
      const res = await client.app.bsky.graph.getAssertions({
        author: sc.scenes[scene].did,
        before: cursor,
        limit: 2,
      })
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.assertions.length).toBeLessThanOrEqual(2),
    )
  })
})
