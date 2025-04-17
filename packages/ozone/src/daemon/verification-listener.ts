import { WebSocket } from 'ws'
import { BackgroundQueue } from '../background'
import { Jetstream } from '../jetstream/service'
import { verificationLogger } from '../logger'
import { VerificationService } from '../verification/service'

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

  constructor(
    private verificationService: VerificationService,
    public backgroundQueue: BackgroundQueue,
    private jetstreamUrl: string,
  ) {}

  handleNewVerification(e: any) {
    this.backgroundQueue.add(async () => {
      try {
        const issuer = e.did
        const { record, rkey, collection } = e.commit
        // @TODO: Get better typing here
        const { subject, handle, displayName, createdAt } =
          record as unknown as VerificationRecord
        const uri = `at://${issuer}/${collection}/${rkey}`
        await this.verificationService.create([
          { uri, issuer, subject, handle, displayName, createdAt },
        ])
        await this.updateCursor(e.time_us)
      } catch (err) {
        verificationLogger.error(
          err,
          'Error handling verification create event',
        )
      }
    })
  }

  handleDeletedVerification(e: any) {
    this.backgroundQueue.add(async () => {
      try {
        await this.verificationService.markRevoked({
          uris: [`at://${e.did}/${e.commit.collection}/${e.commit.rkey}`],
        })
        await this.updateCursor(e.time_us)
      } catch (err) {
        verificationLogger.error(
          err,
          'Error handling verification delete event',
        )
      }
    })
  }

  async getCursor() {
    const cursor = await this.verificationService.getFirehoseCursor()
    if (cursor) {
      this.cursor = Number(cursor)
    }
    return this.cursor
  }

  async updateCursor(cursor: number) {
    // Assuming cursors are always incremental, if we have processed an event with higher value cursor, let's not update to a lower value
    if (this.cursor && this.cursor >= cursor) {
      return
    }

    await this.verificationService.updateFirehoseCursor(`${cursor}`)
    this.cursor = cursor
  }

  async start() {
    await this.getCursor()

    this.jetstream = new Jetstream({
      ws: WebSocket,
      endpoint: this.jetstreamUrl,
      cursor: this.cursor || undefined,
      wantedCollections: [this.collection],
    })
    this.jetstream.onCreate(this.collection, (e) => {
      this.handleNewVerification(e)
    })
    this.jetstream.onDelete(this.collection, (e) =>
      this.handleDeletedVerification(e),
    )
    this.jetstream.on('error', (err) => {
      verificationLogger.error(err, 'Error in jetstream')
      this.stop()
    })
    this.jetstream.start()
  }

  stop() {
    this.jetstream?.close()
    this.backgroundQueue.destroy()
    this.destroyed = true
  }
}
