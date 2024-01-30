import { ServerMailer } from '../mailer'

export class ActivationNotifier {
  constructor(public mailer: ServerMailer) {}

  async sendEmail(email: string, handle: string) {
    await this.mailer.sendAccountActivated({ handle }, { to: email })
  }

  async sendPushNotif(email: string) {}
}
