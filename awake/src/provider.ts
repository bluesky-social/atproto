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

export class Provider {
  sessionKeys: Record<string, CryptoKey> = {}
  recipientDids: Record<string, string> = {}
  negotiateChannels: Record<string, Channel> = {}

  constructor(
    public announceChannel: Channel,
    public authStore: auth.AuthStore,
    public tempKeypair: CryptoKeyPair,
    public validatePin: ValidatePinFn,
    public onSuccess: onSuccess,
  ) {}

  static async openChannel(
    host: string,
    user: string,
    authStore: auth.AuthStore,
    validatePin: ValidatePinFn,
    onSuccess: onSuccess,
  ): Promise<Provider> {
    const announceChannel = new Channel(host, user)
    const tempKeypair = await crypto.makeEcdhKeypair()
    const provider = new Provider(
      announceChannel,
      authStore,
      tempKeypair,
      validatePin,
      onSuccess,
    )

    provider.announceProvision()

    return provider
  }

  announceProvision() {
    this.announceChannel.sendMessage(messages.provisionAnnounce())
    this.announceChannel.onMessage = async (msg: messages.AwakeMessage) => {
      if (msg.type === 'Awake_Request') {
        this.announceChannel.sendMessage(messages.provisionAnnounce())
      } else if (msg.type === 'Awake_Channel_Did') {
        this.negotiateSession(msg)
      }
    }
  }

  async negotiateSession(reqMsg: messages.ChannelDid) {
    const channelDid = reqMsg.channel_did
    await this.attemptMessage(channelDid, async () => {
      const negotiateChannel = new Channel(
        this.announceChannel.host,
        channelDid,
      )
      this.negotiateChannels[channelDid] = negotiateChannel

      negotiateChannel.onMessage = async (msg: messages.AwakeMessage) => {
        if (msg.type === 'Awake_Share_Pin') {
          this.receivePin(msg, channelDid)
        } else if (msg.type === 'Awake_Terminate') {
          this.closeChannel(channelDid)
          throw new Error(`AWAKE terminated by requester: ${msg.error}`)
        }
      }

      const userPubkey = await crypto.pubkeyFromDid(channelDid)
      const sessionKey = await crypto.deriveSharedKey(
        this.tempKeypair.privateKey,
        userPubkey,
      )
      this.sessionKeys[channelDid] = sessionKey

      const tempDid = await crypto.didForKeypair(this.tempKeypair)
      const sessionUcan = await this.authStore.createAwakeProof(
        tempDid,
        `${this.announceChannel.topic}|*`,
      )

      const encryptedUcan = await crypto.encrypt(
        sessionUcan.encoded(),
        sessionKey,
      )

      negotiateChannel.sendMessage(
        messages.negotiateSession(tempDid, encryptedUcan),
      )
    })
  }

  async receivePin(msg: messages.SharePin, channelDid: string) {
    await this.attemptMessage(channelDid, async () => {
      const sessionKey = this.sessionKeys[channelDid]
      if (!sessionKey) {
        return this.terminate(channelDid, new Error('AWAKE out of sync'))
      }
      const pin = parseInt(await crypto.decrypt(msg.pin, sessionKey))
      if (isNaN(pin)) {
        return this.terminate(channelDid, new Error('Bad pin'))
      }
      const recipientDid = await crypto.decrypt(msg.did, sessionKey)
      this.recipientDids[channelDid] = recipientDid
      this.validatePin({ pin, channelDid })
    })
  }

  async verifyPinAndDelegateCred(channelDid: string) {
    await this.attemptMessage(channelDid, async () => {
      // we're all good
      const recipientDid = this.recipientDids[channelDid]
      const sessionKey = this.sessionKeys[channelDid]
      const negotiateChannel = this.negotiateChannels[channelDid]
      if (!recipientDid || !sessionKey || !negotiateChannel) {
        return this.terminate(channelDid, new Error('AWAKE out of sync'))
      }
      const cap = auth.writeCap(this.announceChannel.topic)
      const token = await this.authStore.createUcan(recipientDid, cap)
      const encrypted = await crypto.encrypt(token.encoded(), sessionKey)
      negotiateChannel.sendMessage(messages.delegateCred(encrypted))
      this.closeChannel(channelDid)
      this.onSuccess(channelDid)
    })
  }

  denyPin(channelDid: string) {
    this.terminate(channelDid, new Error('Pin rejected'))
  }

  async attemptMessage(channelDid: string, fn: () => Promise<void>) {
    try {
      await fn()
    } catch (err: any) {
      console.log('CUAHGT ERR: ', err.toString())
      this.terminate(channelDid, err)
    }
  }

  terminate(channelDid: string, err: Error) {
    const channel = this.negotiateChannels[channelDid]
    if (channel) {
      channel.sendMessage(messages.terminate(err.toString()))
    }
    this.closeChannel(channelDid)
    throw err
  }

  closeChannel(channelDid: string) {
    const channel = this.negotiateChannels[channelDid]
    channel.close()
    delete this.negotiateChannels[channelDid]
  }
}

export default Provider
