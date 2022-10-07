import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import * as util from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds notification views', () => {
  let client: AdxServiceClient
  let close: util.CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const server = await util.runTestServer()
    close = server.close
    client = AdxApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await close()
  })

  it('fetches notifications', async () => {
    const notifCount = await client.todo.social.getNotificationCount(
      {},
      undefined,
      { headers: sc.getHeaders(alice) },
    )
    expect(notifCount.data.count).toBe(11)

    const notifRes = await client.todo.social.getNotifications({}, undefined, {
      headers: sc.getHeaders(alice),
    })
    const notifs = notifRes.data.notifications
    expect(notifs.length).toBe(11)

    // @TODO while the exact order of these is not critically important,
    // it's odd to see carol's follow after bob's. In the seed they occur in
    // the opposite ordering.

    expect(notifs[10].reason).toBe('follow')
    expect(notifs[10].author.did).toBe(carol)

    expect(notifs[9].reason).toBe('follow')
    expect(notifs[9].author.did).toBe(bob)

    expect(notifs[8].reason).toBe('mention')
    expect(notifs[8].author.did).toBe(dan)

    expect(notifs[7].reason).toBe('like')
    expect(notifs[7].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[7].author.did).toBe(bob)

    expect(notifs[6].reason).toBe('like')
    expect(notifs[6].reasonSubject).toBe(sc.posts[alice][2].uriRaw)
    expect(notifs[6].author.did).toBe(bob)

    expect(notifs[5].reason).toBe('like')
    expect(notifs[5].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[5].author.did).toBe(carol)

    expect(notifs[4].reason).toBe('like')
    expect(notifs[4].reasonSubject).toBe(sc.posts[alice][2].uriRaw)
    expect(notifs[4].author.did).toBe(carol)

    expect(notifs[3].reason).toBe('like')
    expect(notifs[3].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[3].author.did).toBe(dan)

    expect(notifs[2].reason).toBe('reply')
    expect(notifs[2].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[2].author.did).toBe(bob)

    expect(notifs[1].reason).toBe('reply')
    expect(notifs[1].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[1].author.did).toBe(carol)

    expect(notifs[0].reason).toBe('repost')
    expect(notifs[0].reasonSubject).toBe(sc.posts[alice][1].uriRaw)
    expect(notifs[0].author.did).toBe(dan)

    const noneRead = notifs.every((notif) => !notif.isRead)
    expect(noneRead).toBeTruthy()
  })

  it('updates notifications last seen', async () => {
    await client.todo.social.postNotificationsSeen(
      {},
      { seenAt: new Date().toISOString() },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )

    const notifCount = await client.todo.social.getNotificationCount(
      {},
      undefined,
      { headers: sc.getHeaders(alice) },
    )
    expect(notifCount.data.count).toBe(0)

    const notifs = await client.todo.social.getNotifications({}, undefined, {
      headers: sc.getHeaders(alice),
    })
    const allRead = notifs.data.notifications.every((notif) => notif.isRead)
    expect(allRead).toBeTruthy()
  })
})
