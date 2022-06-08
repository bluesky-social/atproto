import Channel from './channel.js'
import * as messages from './messages.js'
import * as crypto from './crypto.js'
import * as ucan from 'ucans'
import * as auth from '@adxp/auth'

type ShowPinFn = (pin: number) => void

export class Requester {
  sessionKey: CryptoKey | null = null
  negotiateChannel: Channel | null = null

  constructor(
    public announceChannel: Channel,
    public authStore: auth.AuthStore,
    public channelKeypair: CryptoKeyPair,
    public channelDid: string,
    public pin: number,
    public showPin: ShowPinFn,
    public onFinish: () => void | Promise<void>,
  ) {}

  static async openChannel(
    host: string,
    user: string,
    authStore: auth.AuthStore,
    showPin: ShowPinFn,
    onFinish: () => void | Promise<void>,
  ): Promise<Requester> {
    const announceChannel = new Channel(host, user)
    const channelKeypair = await crypto.makeEcdhKeypair()
    const channelDid = await crypto.didForKeypair(channelKeypair)
    // 6 digit pin
    const pin = Math.floor(Math.random() * 1000000)
    const requester = new Requester(
      announceChannel,
      authStore,
      channelKeypair,
      channelDid,
      pin,
      showPin,
      onFinish,
    )

    requester.sendRequest()

    return requester
  }

  sendRequest() {
    this.announceChannel.sendMessage(messages.request())
    this.announceChannel.onMessage = async (msg) => {
      if (
        msg.type === 'Awake_Provision_Announce' &&
        this.negotiateChannel === null
      ) {
        this.announceChannelDid()
      }
    }
  }

  async announceChannelDid() {
    await this.attemptMessage(async () => {
      this.negotiateChannel = new Channel(
        this.announceChannel.host,
        this.channelDid,
      )

      this.announceChannel.sendMessage(messages.channelDid(this.channelDid))

      this.negotiateChannel.onMessage = async (msg: messages.AwakeMessage) => {
        if (msg.type === 'Awake_Negotiate_Session') {
          await this.sendPin(msg)
          this.showPin(this.pin)
        } else if (msg.type === 'Awake_Delegate_Cred') {
          await this.receiveCred(msg)
        } else if (msg.type === 'Awake_Terminate') {
          this.closeNegotiateChannel()
          throw new Error(`AWAKE terminated by provider: ${msg.error}`)
        }
      }
    })
  }

  async sendPin(provMsg: messages.NegotiateSession) {
    await this.attemptMessage(async () => {
      if (!this.negotiateChannel) {
        throw new Error('AWAKE out of sync: No negotiation channel open')
      }
      const providerPubkey = await crypto.pubkeyFromDid(provMsg.prov_did)
      this.sessionKey = await crypto.deriveSharedKey(
        this.channelKeypair.privateKey,
        providerPubkey,
      )

      try {
        const decryptedUcan = await crypto.decrypt(
          provMsg.ucan,
          this.sessionKey,
        )
        // this function validates tokens so we just need to check att on second to the top
        const token = await ucan.Chained.fromToken(decryptedUcan)
        const prf = token.proofs()[0]
        if (!prf) {
          throw new Error('No proof')
        }
        const neededCap = auth.writeCap(this.announceChannel.topic)
        await auth.checkUcan(
          prf,
          auth.hasValidCapability(this.announceChannel.topic, neededCap),
        )
      } catch (e: any) {
        throw new Error(`Invalid negotiation proof: ${e.toString()}`)
      }

      const encryptedPin = await crypto.encrypt(
        this.pin.toString(),
        this.sessionKey,
      )
      const appDid = await this.authStore.getDid()
      const encryptedAppDid = await crypto.encrypt(appDid, this.sessionKey)
      this.negotiateChannel.sendMessage(
        messages.sharePin(encryptedPin, encryptedAppDid),
      )
    })
  }

  async receiveCred(provMsg: messages.DelegateCred) {
    await this.attemptMessage(async () => {
      if (!this.sessionKey) {
        throw new Error('AWAKE out of sync')
      }
      const decrypted = await crypto.decrypt(provMsg.ucan, this.sessionKey)
      const token = await ucan.Chained.fromToken(decrypted)
      await this.authStore.addUcan(token)
      this.closeNegotiateChannel()
      this.closeAnnounceChannel()
      this.onFinish()
    })
  }

  async attemptMessage(fn: () => Promise<void>) {
    try {
      await fn()
    } catch (err: any) {
      if (this.negotiateChannel) {
        this.negotiateChannel.sendMessage(messages.terminate(err.toString()))
      }
      this.closeNegotiateChannel()
      throw err
    }
  }

  closeNegotiateChannel() {
    if (this.negotiateChannel) {
      this.negotiateChannel.close()
      this.negotiateChannel = null
    }
  }

  closeAnnounceChannel() {
    if (this.announceChannel) {
      this.announceChannel.close()
      this.announceChannel.onMessage = null
    }
  }
}

export default Requester
