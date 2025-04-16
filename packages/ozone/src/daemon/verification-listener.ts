import { VerificationService } from '../verification/service'
import { WebSocket } from 'ws'
import { verificationLogger } from '../logger'

type VerificationRecord = {
  subject: string
  handle: string
  displayName: string
  createdAt: string
}

export class VerificationListener {
  destroyed = false
  private jetstream: any = null
  private collection = 'app.bsky.graph.verification'

  constructor(
    private verificationService: VerificationService,
    private jetstreamUrl: string,
  ) {}

  async handleNewVerification(e: any) {
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
    } catch (err) {
      verificationLogger.error(err, 'Error handling verification create event')
    }
  }

  async handleDeletedVerification(e: any) {
    try {
      await this.verificationService.markRevoked({
        uris: [`at://${e.did}/${e.commit.collection}/${e.commit.rkey}`],
      })
    } catch (err) {
      verificationLogger.error(err, 'Error handling verification delete event')
    }
  }

  async start() {
    const { Jetstream } = await import('@skyware/jetstream')

    this.jetstream = new Jetstream({
      ws: WebSocket,
      endpoint: this.jetstreamUrl,
      wantedCollections: [this.collection],
    })
    this.jetstream.onCreate(this.collection, async (e) =>
      this.handleNewVerification(e),
    )
    this.jetstream.onDelete(this.collection, async (e) =>
      this.handleDeletedVerification(e),
    )
    this.jetstream.start()
  }

  stop() {
    this.jetstream?.close()
    this.destroyed = true
  }
}
