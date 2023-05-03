import * as segment from '@segment/analytics-node'
import { AccountCreatedEvt, Analytics } from './types'

export class SegmentAnalytics implements Analytics {
  segment: segment.Analytics

  constructor(writeKey: string) {
    this.segment = new segment.Analytics({
      writeKey,
    })
    this.segment.on('error', (err) => console.error(err)) // TODO: replace with logger
  }

  async accountCreated(evt: AccountCreatedEvt) {
    const { did, handle, email, createdAt, inviteCode } = evt
    await this.segment.identify({
      userId: did,
      traits: {
        username: handle,
        email: email,
        createdAt: createdAt,
        inviteCode: inviteCode,
      },
    })
    await this.segment.track({
      userId: did,
      event: 'Account Created',
      properties: {
        handle,
        email,
        inviteCode,
      },
    })
  }

  async close() {
    await this.segment.closeAndFlush()
  }
}
