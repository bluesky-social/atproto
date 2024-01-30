import { Timestamp } from '@bufbuild/protobuf'
import { CourierClient } from '../courier'
import { ServerMailer } from '../mailer'

export class ActivationNotifier {
  constructor(
    public mailer: ServerMailer,
    public courierClient: CourierClient,
  ) {}

  async sendEmail(email: string, handle: string) {
    await this.mailer.sendAccountActivated({ handle }, { to: email })
  }

  async sendPushNotif(did: string) {
    await this.courierClient.pushNotifications({
      notifications: [
        {
          id: `${did}-account-activated`,
          recipientDid: did,
          title: 'Great news!',
          message: 'Your Bluesky account is ready to go',
          collapseKey: 'account-activated',
          alwaysDeliver: true,
          timestamp: Timestamp.fromDate(new Date()),
        },
      ],
    })
  }
}
