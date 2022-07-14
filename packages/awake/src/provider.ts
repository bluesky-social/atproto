import * as auth from '@adxp/auth'
import * as crypto from '@adxp/crypto'
import Channel from './channel'
import * as messages from './messages'

export type PinParams = {
  pin: number
  channelDid: string
}

export type ValidatePinFn = (params: PinParams) => void
export type onSuccess = (channelDid: string) => void

const YEAR_IN_SECONDS = 60 * 60 * 24 * 30 * 12

export class Provider {
  sessionKey: crypto.AesKey | null = null
  negotiateChannel: Channel | null = null
  recipientDid: string | null = null

  constructor(
    public announceChannel: Channel,
    public rootDid: string,
    public authStore: auth.AuthStore,
    public tempKeypair: crypto.EcdhKeypair,
  ) {}

  static async create(
    host: string,
    rootDid: string,
    authStore: auth.AuthStore,
  ): Promise<Provider> {
    const announceChannel = new Channel(host, rootDid)
    const tempKeypair = await crypto.EcdhKeypair.create()
    const provider = new Provider(
      announceChannel,
      rootDid,
      authStore,
      tempKeypair,
    )

    return provider
  }

  async attemptProvision(): Promise<number> {
    return this.attempt(async () => {
      const promise = new Promise<number>((resolve) => {
        this.announceChannel.onMessage = async (msg: any) => {
          if (msg.type === 'Awake_Request') {
            this.announceChannel.sendMessage(messages.provisionAnnounce())
          } else if (msg.type === 'Awake_Channel_Did') {
            const pin = await this.negotiateSession(msg)
            this.announceChannel.onMessage = null
            resolve(pin)
          }
        }
      })

      this.announceChannel.sendMessage(messages.provisionAnnounce())
      return promise
    })
  }

  private async negotiateSession(reqMsg: messages.ChannelDid): Promise<number> {
    const channelDid = reqMsg.channel_did
    this.negotiateChannel = new Channel(this.announceChannel.host, channelDid)

    this.sessionKey = await this.tempKeypair.deriveSharedKey(channelDid)

    const tempDid = await this.tempKeypair.did()
    const sessionUcan = await this.authStore.createAwakeProof(
      tempDid,
      auth.writeCap(this.rootDid),
    )

    const encryptedUcan = await this.sessionKey.encrypt(
      auth.ucans.encode(sessionUcan),
    )

    this.negotiateChannel.sendMessage(
      messages.negotiateSession(tempDid, encryptedUcan),
    )

    return this.receivePin()
  }

  private async receivePin(): Promise<number> {
    if (!this.negotiateChannel || !this.sessionKey) {
      throw new Error('AWAKE out of sync')
    }
    const msg = await this.negotiateChannel.awaitMessage(['Awake_Share_Pin'])
    const pin = parseInt(await this.sessionKey.decrypt(msg.pin))
    if (isNaN(pin)) {
      throw new Error('Bad pin received from client')
    }
    this.recipientDid = await this.sessionKey.decrypt(msg.did)
    return pin
  }

  async approvePinAndDelegateCred(): Promise<void> {
    return this.attempt(async () => {
      if (!this.recipientDid || !this.sessionKey || !this.negotiateChannel) {
        throw new Error('AWAKE out of sync')
      }
      const cap = auth.writeCap(this.rootDid)
      const token = await this.authStore.createUcan(
        this.recipientDid,
        cap,
        YEAR_IN_SECONDS,
      )
      const encrypted = await this.sessionKey.encrypt(auth.ucans.encode(token))
      await this.negotiateChannel.sendMessage(messages.delegateCred(encrypted))
    })
  }

  async denyPin(): Promise<void> {
    this.terminate(new Error('Pin rejected'))
  }

  terminate(err: Error): void {
    if (this.negotiateChannel) {
      this.negotiateChannel.sendMessage(messages.terminate(err.toString()))
    }
  }

  // catch errors so we can notify other party if we errored out
  private async attempt<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const val = await fn()
      return val
    } catch (err: any) {
      this.terminate(err)
      throw err
    }
  }

  close(): void {
    this.closeNegotiateChannel()
    this.announceChannel.close()
  }

  closeNegotiateChannel(): void {
    if (this.negotiateChannel) {
      this.negotiateChannel.close()
      this.negotiateChannel = null
    }
  }
}

export default Provider
