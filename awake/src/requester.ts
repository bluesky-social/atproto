import Channel from './channel.js'
import * as messages from './messages.js'
import * as crypto from './crypto.js'
import * as ucan from 'ucans'
import * as auth from '@adxp/auth'

export class Requester {
  sessionKey: CryptoKey | null = null
  negotiateChannel: Channel | null = null

  constructor(
    public announceChannel: Channel | null,
    public rootDid: string,
    public ownDid: string,
    public channelKeypair: CryptoKeyPair,
    public channelDid: string,
    public pin: number,
  ) {}

  static async create(
    host: string,
    rootDid: string,
    ownDid: string,
  ): Promise<Requester> {
    const announceChannel = new Channel(host, rootDid)
    const channelKeypair = await crypto.makeEcdhKeypair()
    const channelDid = await crypto.didForKeypair(channelKeypair)
    // 6 digit pin
    const pin = Math.floor(Math.random() * 1000000)
    const requester = new Requester(
      announceChannel,
      rootDid,
      ownDid,
      channelKeypair,
      channelDid,
      pin,
    )
    return requester
  }

  async findProvider(): Promise<number> {
    return this.attempt(async () => {
      if (!this.announceChannel) {
        throw new Error('AWAKE out of sync: no announce channel')
      }
      this.announceChannel.sendMessage(messages.request())
      await this.announceChannel.awaitMessage(['Awake_Provision_Announce'])
      return this.announceChannelDid()
    })
  }

  private async announceChannelDid(): Promise<number> {
    if (!this.announceChannel) {
      throw new Error('AWAKE out of sync: no announce channel')
    }

    this.negotiateChannel = new Channel(
      this.announceChannel.host,
      this.channelDid,
    )

    // move to negotiation channel
    const negotiateMsgPromise = this.negotiateChannel.awaitMessage([
      'Awake_Negotiate_Session',
    ])
    this.announceChannel.sendMessage(messages.channelDid(this.channelDid))
    const negotiateMsg = await negotiateMsgPromise

    return this.sendPin(negotiateMsg)
  }

  private async sendPin(provMsg: messages.NegotiateSession): Promise<number> {
    const providerPubkey = await crypto.pubkeyFromDid(provMsg.prov_did)
    this.sessionKey = await crypto.deriveSharedKey(
      this.channelKeypair.privateKey,
      providerPubkey,
    )

    try {
      const decryptedUcan = await crypto.decrypt(provMsg.ucan, this.sessionKey)
      // this function validates tokens so we just need to check att on second to the top
      const token = await ucan.Chained.fromToken(decryptedUcan)
      const prf = token.proofs()[0]
      if (!prf) {
        throw new Error('No proof')
      }
      const neededCap = auth.writeCap(this.rootDid)
      await auth.checkUcan(
        prf,
        auth.hasValidCapability(this.rootDid, neededCap),
      )
    } catch (e: any) {
      throw new Error(`Invalid negotiation proof: ${e.toString()}`)
    }

    const encryptedPin = await crypto.encrypt(
      this.pin.toString(),
      this.sessionKey,
    )
    const encryptedAppDid = await crypto.encrypt(this.ownDid, this.sessionKey)
    if (!this.negotiateChannel) {
      throw new Error('AWAKE out of sync: negotiation channel closed')
    }
    this.negotiateChannel.sendMessage(
      messages.sharePin(encryptedPin, encryptedAppDid),
    )
    return this.pin
  }

  async awaitDelegation(): Promise<ucan.Chained> {
    return this.attempt(async () => {
      if (!this.negotiateChannel) {
        throw new Error('AWAKE out of sync: negotiation channel closed')
      }
      const msg = await this.negotiateChannel.awaitMessage([
        'Awake_Delegate_Cred',
      ])
      if (!this.sessionKey) {
        throw new Error('AWAKE out of sync: no session key')
      }
      const decrypted = await crypto.decrypt(msg.ucan, this.sessionKey)
      const token = await ucan.Chained.fromToken(decrypted)
      this.close()
      return token
    })
  }

  // catch errors so we can notify other party if we errored out
  private async attempt<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const val = await fn()
      return val
    } catch (err: any) {
      if (this.negotiateChannel) {
        this.negotiateChannel.sendMessage(messages.terminate(err.toString()))
      }
      throw err
    }
  }

  close() {
    if (this.negotiateChannel) {
      this.negotiateChannel.close()
      this.negotiateChannel = null
    }
    if (this.announceChannel) {
      this.announceChannel.close()
      this.announceChannel.onMessage = null
    }
  }
}

export default Requester
