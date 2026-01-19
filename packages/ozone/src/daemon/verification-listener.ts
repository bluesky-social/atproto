import { Selectable } from 'kysely'
import { lexicons } from '@atproto/api'
import { BackgroundQueue } from '../background'
import { Database } from '../db'
import { Verification } from '../db/schema/verification'
import { CommitCreateEvent, Jetstream } from '../jetstream/service'
import { verificationLogger } from '../logger'
import { ModerationServiceCreator } from '../mod-service'
import { RepoSubject } from '../mod-service/subject'
import { VerificationService } from '../verification/service'
import { REVOCATION_TAG } from '../verification/util'

type VerificationRecord = {
  subject: string
  handle: string
  displayName: string
  createdAt: string
}

export class VerificationListener {
  destroyed = false
  private cursor?: number
  private jetstream: Jetstream | null = null
  private collection = 'app.bsky.graph.verification'
  public backgroundQueue = new BackgroundQueue(this.db, { concurrency: 1 })
  private verificationService = VerificationService.creator()(this.db)

  constructor(
    private db: Database,
    private modService: ModerationServiceCreator,
    private jetstreamUrl: string,
    private verifierIssuersToIndex?: string[],
    private tagRevokedVerifications?: boolean,
  ) {}

  // When the queue has capacity, this method returns true which means we can continue to handle events
  // otherwise, it will close jetstream connection and wait for all previously queued events to be processed first
  // and then start jetstream listener again before returning false. At that point, the previous listeners should
  // have updates the cursor in db to the last processed event and the new listener will start from that cursor
  async ensureCoolDown() {
    const { waitingCount, runningCount } = this.backgroundQueue.getStats()
    if (waitingCount > 50 || runningCount > 50) {
      verificationLogger.warn(`Background queue is full, pausing listener`)
      this.jetstream?.close()
      await this.backgroundQueue.processAll()
      await this.start()
      return false
    }
    return true
  }

  handleNewVerification(
    issuer: string,
    uri: string,
    cid: string,
    record: VerificationRecord,
    cursor: number,
  ) {
    this.backgroundQueue.add(async () => {
      try {
        const { subject, handle, displayName, createdAt } = record
        await this.verificationService.create([
          { uri, cid, issuer, subject, handle, displayName, createdAt },
        ])
        await this.updateCursor(cursor)
      } catch (err) {
        verificationLogger.error(
          err,
          'Error handling verification create event',
        )
      }
    })
  }

  async tagRevocations(verifications: Selectable<Verification>[]) {
    if (!this.tagRevokedVerifications) return

    for (const verification of verifications) {
      this.db.transaction(async (dbTxn) => {
        const modService = this.modService(dbTxn)
        const subject = new RepoSubject(verification.subject)
        const status = await modService.getStatus(subject)

        // If tag already exists, no need to proceed further
        if (status?.tags?.includes(REVOCATION_TAG)) {
          return
        }

        // log the tag event which also applies the necessary state changes to moderation subject
        await modService.logEvent({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: [REVOCATION_TAG],
            remove: [],
            comment: 'Verification record deletion received via jetstream',
          },
          subject,
          modTool: {
            name: 'ozone-verification-listener',
            meta: {
              isAutomated: true,
            },
          },
          createdBy: verification.revokedBy || verification.subject,
        })
      })
    }
  }

  handleDeletedVerification(uri: string, cursor: number) {
    this.backgroundQueue.add(async () => {
      try {
        const revocations = await this.verificationService.markRevoked({
          uris: [uri],
        })
        await this.tagRevocations(revocations)
        await this.updateCursor(cursor)
      } catch (err) {
        verificationLogger.error(
          err,
          'Error handling verification delete event',
        )
      }
    })
  }

  async getCursor() {
    await this.verificationService.createFirehoseCursor()
    const cursor = await this.verificationService.getFirehoseCursor()
    if (cursor) {
      this.cursor = cursor
    }
    return this.cursor
  }

  async updateCursor(cursor: number) {
    // Assuming cursors are always incremental, if we have processed an event with higher value cursor, let's not update to a lower value
    if (this.cursor && this.cursor >= cursor) {
      return
    }

    // This will only update if the cursor is higher than the current one in db
    const updatedCursor =
      await this.verificationService.updateFirehoseCursor(cursor)

    if (updatedCursor) {
      this.cursor = updatedCursor
    }
  }

  async start() {
    await this.getCursor()

    this.jetstream = new Jetstream({
      endpoint: this.jetstreamUrl,
      cursor: this.cursor || undefined,
      wantedCollections: [this.collection],
      wantedDids: this.verifierIssuersToIndex?.length
        ? this.verifierIssuersToIndex
        : undefined,
    })

    await this.jetstream.start({
      onCreate: {
        [this.collection]: async (e: CommitCreateEvent<VerificationRecord>) => {
          const recordValidity = lexicons.validate(
            this.collection,
            e.commit.record,
          )

          if (!recordValidity.success) {
            verificationLogger.error(
              recordValidity.error,
              'Invalid verification record in the firehose',
            )
            return
          }

          const hasCapacity = await this.ensureCoolDown()
          if (hasCapacity) {
            const issuer = e.did
            const { record, rkey, collection, cid } = e.commit
            const uri = `at://${issuer}/${collection}/${rkey}`
            this.handleNewVerification(issuer, uri, cid, record, e.time_us)
          }
        },
      },
      onDelete: {
        [this.collection]: async (e) => {
          const hasCapacity = await this.ensureCoolDown()
          if (hasCapacity) {
            this.handleDeletedVerification(
              `at://${e.did}/${e.commit.collection}/${e.commit.rkey}`,
              e.time_us,
            )
          }
        },
      },
    })
  }

  stop() {
    this.jetstream?.close()
    this.backgroundQueue.destroy()
    this.destroyed = true
  }
}
