import assert from 'node:assert'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { isRepoRef } from '../src/lexicon/types/com/atproto/admin/defs'
import { REASONMISLEADING } from '../src/lexicon/types/com/atproto/moderation/defs'
import { isMain as isStrongRef } from '../src/lexicon/types/com/atproto/repo/strongRef'
import {
  REVIEWOPEN,
  SubjectStatusView,
  isAccountHosting,
  isRecordHosting,
} from '../src/lexicon/types/tools/ozone/moderation/defs'
import { InputSchema } from '../src/lexicon/types/tools/ozone/moderation/emitEvent'

describe('record and account events on moderation subjects', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_record_and_account_events',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const getSubjectStatus = async (
    subject: string,
  ): Promise<SubjectStatusView | undefined> => {
    const res = await modClient.queryStatuses({
      subject,
    })
    return res.subjectStatuses[0]
  }

  describe('record events', () => {
    const emitRecordEvent = async (
      subject: InputSchema['subject'],
      op: 'create' | 'update' | 'delete',
    ) => {
      return await modClient.emitEvent(
        {
          event: {
            op,
            timestamp: new Date().toISOString(),
            $type: 'tools.ozone.moderation.defs#recordEvent',
          },
          subject,
          createdBy: 'did:example:admin',
        },
        'admin',
      )
    }

    it('saves updated and deleted timestamps and record status', async () => {
      const bobsPostSubject = {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.bob][1].ref.uriStr,
        cid: sc.posts[sc.dids.bob][1].ref.cidStr,
      }

      await sc.createReport({
        reportedBy: sc.dids.carol,
        reasonType: REASONMISLEADING,
        reason: 'misleading',
        subject: bobsPostSubject,
      })

      await emitRecordEvent(bobsPostSubject, 'update')
      const statusAfterUpdate = await getSubjectStatus(bobsPostSubject.uri)
      assert(isRecordHosting(statusAfterUpdate?.hosting))
      expect(statusAfterUpdate.hosting?.updatedAt).toBeTruthy()

      await emitRecordEvent(bobsPostSubject, 'delete')
      const statusAfterDelete = await getSubjectStatus(bobsPostSubject.uri)
      assert(isRecordHosting(statusAfterDelete?.hosting))
      expect(statusAfterDelete.hosting?.deletedAt).toBeTruthy()
      expect(statusAfterDelete.hosting?.status).toEqual('deleted')
      // Ensure that due to delete or update event, review state does not change
      expect(statusAfterDelete.reviewState).toEqual(REVIEWOPEN)
    })
  })
  describe('account/identity events', () => {
    const emitAccountEvent = async (
      subject: InputSchema['subject'],
      active: boolean,
      status?: 'takendown' | 'deleted' | 'deactivated' | 'suspended',
    ) => {
      return await modClient.emitEvent(
        {
          event: {
            status,
            active,
            timestamp: new Date().toISOString(),
            $type: 'tools.ozone.moderation.defs#accountEvent',
          },
          subject,
          createdBy: 'did:example:admin',
        },
        'admin',
      )
    }

    it('saves updated and deleted timestamps and account status', async () => {
      const carolsAccountSubject = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol,
      }

      await sc.createReport({
        reportedBy: sc.dids.carol,
        reasonType: REASONMISLEADING,
        reason: 'misleading',
        subject: carolsAccountSubject,
      })

      await emitAccountEvent(carolsAccountSubject, false, 'deactivated')
      const statusAfterDeactivation = await getSubjectStatus(
        carolsAccountSubject.did,
      )
      assert(isAccountHosting(statusAfterDeactivation?.hosting))
      expect(statusAfterDeactivation.hosting.deactivatedAt).toBeTruthy()
      expect(statusAfterDeactivation.hosting.status).toEqual('deactivated')
      expect(statusAfterDeactivation.reviewState).toEqual(REVIEWOPEN)

      await emitAccountEvent(carolsAccountSubject, true)
      const statusAfterReactivation = await getSubjectStatus(
        carolsAccountSubject.did,
      )
      assert(isAccountHosting(statusAfterReactivation?.hosting))
      expect(statusAfterReactivation.hosting.updatedAt).toBeTruthy()
      expect(statusAfterReactivation.hosting.status).toEqual('active')
      expect(statusAfterReactivation.hosting.deletedAt).toBeFalsy()
    })

    it('gets statuses by hosting properties', async () => {
      await Promise.all([
        emitAccountEvent(
          {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
          false,
          'deactivated',
        ),
        emitAccountEvent(
          {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          false,
          'deleted',
        ),
      ])
      const [
        { subjectStatuses: deactivatedOrDeletedStatuses },
        { subjectStatuses: deletedStatusesInPastDay },
        { subjectStatuses: deletedStatusesBeforeYesterday },
      ] = await Promise.all([
        modClient.queryStatuses({
          hostingStatuses: ['deactivated', 'deleted'],
        }),
        modClient.queryStatuses({
          hostingDeletedAfter: new Date(
            Date.now() - 1000 * 60 * 60 * 24,
          ).toISOString(),
        }),
        modClient.queryStatuses({
          hostingDeletedBefore: new Date(
            Date.now() - 1000 * 60 * 60 * 24,
          ).toISOString(),
        }),
      ])

      expect(deactivatedOrDeletedStatuses.length).toEqual(3)
      expect(deletedStatusesInPastDay.length).toEqual(2)
      assert(isStrongRef(deletedStatusesInPastDay[0]?.subject))
      expect(deletedStatusesInPastDay[0]?.subject.uri).toEqual(
        sc.posts[sc.dids.bob][1].ref.uriStr,
      )
      assert(isRepoRef(deletedStatusesInPastDay[1]?.subject))
      expect(deletedStatusesInPastDay[1]?.subject.did).toEqual(sc.dids.bob)
      expect(deletedStatusesBeforeYesterday.length).toEqual(0)
    })
  })
})
