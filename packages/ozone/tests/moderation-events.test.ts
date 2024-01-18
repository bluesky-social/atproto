import {
  TestNetwork,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import { ComAtprotoAdminDefs } from '@atproto/api'
import { forSnapshot } from './_util'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'

describe('moderation-events', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  const seedEvents = async () => {
    const bobsAccount = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
    const alicesAccount = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.alice,
    }
    const bobsPost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }
    const alicesPost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      cid: sc.posts[sc.dids.alice][0].ref.cidStr,
    }

    for (let i = 0; i < 4; i++) {
      await modClient.emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: i % 2 ? REASONSPAM : REASONMISLEADING,
          comment: 'X',
        },
        //   Report bob's account by alice and vice versa
        subject: i % 2 ? bobsAccount : alicesAccount,
        createdBy: i % 2 ? sc.dids.alice : sc.dids.bob,
      })
      await modClient.emitModerationEvent({
        event: {
          $type: 'com.atproto.admin.defs#modEventReport',
          reportType: REASONSPAM,
          comment: 'X',
        },
        //   Report bob's post by alice and vice versa
        subject: i % 2 ? bobsPost : alicesPost,
        createdBy: i % 2 ? sc.dids.alice : sc.dids.bob,
      })
    }
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderation_events',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
    await seedEvents()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('query events', () => {
    it('returns all events for record or repo', async () => {
      const [bobsEvents, alicesPostEvents] = await Promise.all([
        modClient.queryModerationEvents({
          subject: sc.dids.bob,
        }),
        modClient.queryModerationEvents({
          subject: sc.posts[sc.dids.alice][0].ref.uriStr,
        }),
      ])

      expect(forSnapshot(bobsEvents.events)).toMatchSnapshot()
      expect(forSnapshot(alicesPostEvents.events)).toMatchSnapshot()
    })

    it('filters events by types', async () => {
      const alicesAccount = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      }
      await Promise.all([
        modClient.emitModerationEvent({
          event: {
            $type: 'com.atproto.admin.defs#modEventComment',
            comment: 'X',
          },
          subject: alicesAccount,
          createdBy: 'did:plc:moderator',
        }),
        modClient.emitModerationEvent({
          event: {
            $type: 'com.atproto.admin.defs#modEventEscalate',
            comment: 'X',
          },
          subject: alicesAccount,
          createdBy: 'did:plc:moderator',
        }),
      ])
      const [allEvents, reportEvents] = await Promise.all([
        modClient.queryModerationEvents({
          subject: sc.dids.alice,
        }),
        modClient.queryModerationEvents({
          subject: sc.dids.alice,
          types: ['com.atproto.admin.defs#modEventReport'],
        }),
      ])

      expect(allEvents.events.length).toBeGreaterThan(
        reportEvents.events.length,
      )
      expect(
        [...new Set(reportEvents.events.map((e) => e.event.$type))].length,
      ).toEqual(1)

      expect(
        [...new Set(allEvents.events.map((e) => e.event.$type))].length,
      ).toEqual(3)
    })

    it('returns events for all content by user', async () => {
      const [forAccount, forPost] = await Promise.all([
        modClient.queryModerationEvents({
          subject: sc.dids.bob,
          includeAllUserRecords: true,
        }),
        modClient.queryModerationEvents({
          subject: sc.posts[sc.dids.bob][0].ref.uriStr,
          includeAllUserRecords: true,
        }),
      ])

      expect(forAccount.events.length).toEqual(forPost.events.length)
      // Save events are returned from both requests
      expect(forPost.events.map(({ id }) => id).sort()).toEqual(
        forAccount.events.map(({ id }) => id).sort(),
      )
    })

    it('returns paginated list of events with cursor', async () => {
      const allEvents = await modClient.queryModerationEvents({
        subject: sc.dids.bob,
        includeAllUserRecords: true,
      })

      const getPaginatedEvents = async (
        sortDirection: 'asc' | 'desc' = 'desc',
      ) => {
        let defaultCursor: undefined | string = undefined
        const events: ComAtprotoAdminDefs.ModEventView[] = []
        let count = 0
        do {
          // get 1 event at a time and check we get all events
          const data = await modClient.queryModerationEvents({
            limit: 1,
            subject: sc.dids.bob,
            includeAllUserRecords: true,
            cursor: defaultCursor,
            sortDirection,
          })
          events.push(...data.events)
          defaultCursor = data.cursor
          count++
          // The count is a circuit breaker to prevent infinite loop in case of failing test
        } while (defaultCursor && count < 10)

        return events
      }

      const defaultEvents = await getPaginatedEvents()
      const reversedEvents = await getPaginatedEvents('asc')

      expect(allEvents.events.length).toEqual(5)
      expect(defaultEvents.length).toEqual(allEvents.events.length)
      expect(reversedEvents.length).toEqual(allEvents.events.length)
      expect(reversedEvents[0].id).toEqual(defaultEvents[4].id)
    })
  })

  describe('get event', () => {
    it('gets an event by specific id', async () => {
      const res = await modClient.getEvent(1)
      expect(forSnapshot(res)).toMatchSnapshot()
    })
  })
})
