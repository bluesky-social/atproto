import Channel from './channel.js'
import * as messages from './messages.js'
import * as crypto from './crypto.js'
import * as auth from '@adxp/auth'

export type PinParams = {
  pin: number
  channelDid: string
}

export type ValidatePinFn = (params: PinParams) => void
export type onSuccess = (channelDid: string) => void

const YEAR_IN_SECONDS = 60 * 60 * 24 * 30 * 12

export class Provider {
  sessionKey: CryptoKey | null = null
  negotiateChannel: Channel | null = null
  recipientDid: string | null = null

  constructor(
    public announceChannel: Channel,
    public rootDid: string,
    public authStore: auth.AuthStore,
    public tempKeypair: CryptoKeyPair,
  ) {}

  static async create(
    host: string,
    rootDid: string,
    authStore: auth.AuthStore,
  ): Promise<Provider> {
    const announceChannel = new Channel(host, rootDid)
    const tempKeypair = await crypto.makeEcdhKeypair()
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

    const userPubkey = await crypto.pubkeyFromDid(channelDid)
    this.sessionKey = await crypto.deriveSharedKey(
      this.tempKeypair.privateKey,
      userPubkey,
    )

    const tempDid = await crypto.didForKeypair(this.tempKeypair)
    const sessionUcan = await this.authStore.createAwakeProof(
      tempDid,
      auth.writeCap(this.rootDid),
    )

    const encryptedUcan = await crypto.encrypt(
      sessionUcan.encoded(),
      this.sessionKey,
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
    const pin = parseInt(await crypto.decrypt(msg.pin, this.sessionKey))
    if (isNaN(pin)) {
      throw new Error('Bad pin received from client')
    }
    this.recipientDid = await crypto.decrypt(msg.did, this.sessionKey)
    return pin
  }

  async approvePinAndDelegateCred() {
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
      const encrypted = await crypto.encrypt(token.encoded(), this.sessionKey)
      await this.negotiateChannel.sendMessage(messages.delegateCred(encrypted))
    })
  }

  async denyPin() {
    this.terminate(new Error('Pin rejected'))
  }

  terminate(err: Error) {
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

  close() {
    this.closeNegotiateChannel()
    this.announceChannel.close()
  }

  closeNegotiateChannel() {
    if (this.negotiateChannel) {
      this.negotiateChannel.close()
      this.negotiateChannel = null
    }
  }
}

export default Provider
