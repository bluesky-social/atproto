import * as auth from '@adxp/auth'
import * as crypto from '@adxp/crypto'
import Channel from './channel'
import * as messages from './messages'

export class Requester {
  sessionKey: crypto.AesKey | null = null
  negotiateChannel: Channel | null = null

  constructor(
    public announceChannel: Channel | null,
    public rootDid: string,
    public ownDid: string,
    public channelKeypair: crypto.EcdhKeypair,
    public channelDid: string,
    public pin: number,
  ) {}

  static async create(
    host: string,
    rootDid: string,
    ownDid: string,
  ): Promise<Requester> {
    const announceChannel = new Channel(host, rootDid)
    const channelKeypair = await crypto.EcdhKeypair.create()
    const channelDid = await channelKeypair.did()
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
    this.sessionKey = await this.channelKeypair.deriveSharedKey(
      provMsg.prov_did,
    )

    try {
      const decryptedUcan = await this.sessionKey.decrypt(provMsg.ucan)
      // this function validates tokens so we just need to check att on second to the top
      const token = await auth.ucans.validate(decryptedUcan)
      const prf = token.payload.prf[0]
      if (!prf) {
        throw new Error('No proof')
      }
      await auth.verifyFullWritePermission(prf, token.payload.iss, this.rootDid)
    } catch (e: any) {
      throw new Error(`Invalid negotiation proof: ${e.toString()}`)
    }

    const encryptedPin = await this.sessionKey.encrypt(this.pin.toString())
    const encryptedAppDid = await this.sessionKey.encrypt(this.ownDid)
    if (!this.negotiateChannel) {
      throw new Error('AWAKE out of sync: negotiation channel closed')
    }
    this.negotiateChannel.sendMessage(
      messages.sharePin(encryptedPin, encryptedAppDid),
    )
    return this.pin
  }

  async awaitDelegation(): Promise<auth.Ucan> {
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
      const decrypted = await this.sessionKey.decrypt(msg.ucan)
      const token = await auth.ucans.validate(decrypted)
      try {
        // @TODO Add this back in as well
        await auth.verifyFullWritePermission(token, this.ownDid, this.rootDid)
      } catch (err) {
        throw new Error(
          `Token from AWAKE provider does not have correct capability: ${err}`,
        )
      }
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

  close(): void {
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
