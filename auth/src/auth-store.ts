import * as ucan from 'ucans'
import * as capability from './capability.js'
import * as builders from './builders.js'
import { MONTH_IN_SEC } from './consts.js'

export abstract class AuthStore {
  protected abstract getKeypair(): Promise<ucan.EdKeypair>
  abstract addUcan(token: ucan.Chained): Promise<void>
  abstract getUcanStore(): Promise<ucan.Store>
  abstract clear(): Promise<void>
  abstract reset(): Promise<void>

  async getDid(): Promise<string> {
    const keypair = await this.getKeypair()
    return keypair.did()
  }

  async findUcan(cap: ucan.Capability): Promise<ucan.Chained | null> {
    const ucanStore = await this.getUcanStore()
    // we only handle adx caps right now
    const adxCap = capability.adxSemantics.tryParsing(cap)
    if (adxCap === null) return null
    const res = await ucanStore.findWithCapability(
      await this.getDid(),
      capability.adxSemantics,
      adxCap,
      ({ originator, expiresAt, notBefore }) => {
        if (expiresAt * 1000 < Date.now()) return false
        if (notBefore && notBefore * 1000 > Date.now()) return false
        return originator === adxCap.did
      },
    )
    if (res.success) {
      return res.ucan
    } else {
      return null
    }
  }

  async hasUcan(cap: ucan.Capability): Promise<boolean> {
    const found = await this.findUcan(cap)
    return found !== null
  }

  async createUcan(
    audience: string,
    cap: ucan.Capability,
    lifetime = MONTH_IN_SEC,
  ): Promise<ucan.Chained> {
    const keypair = await this.getKeypair()
    const ucanStore = await this.getUcanStore()
    return ucan.Builder.create()
      .issuedBy(keypair)
      .toAudience(audience)
      .withLifetimeInSeconds(lifetime)
      .delegateCapability(capability.adxSemantics, cap, ucanStore)
      .build()
  }

  async createAwakeProof(
    audience: string,
    cap: ucan.Capability,
  ): Promise<ucan.Chained> {
    const keypair = await this.getKeypair()
    const fullUcan = await this.findUcan(cap)
    if (!fullUcan) {
      throw new Error("Couldn't find ucan")
    }
    // gotta do the old fashioned API to build a token with no att
    const sessionUcan = await ucan.build({
      issuer: keypair,
      audience: audience,
      lifetimeInSeconds: 60 * 5,
      proofs: [fullUcan.encoded()],
    })
    const encoded = ucan.encode(sessionUcan)
    const chained = await ucan.Chained.fromToken(encoded)
    return chained
  }

  // Claim a fully permissioned Ucan & add to store
  // Mainly for dev purposes
  async claimFull(): Promise<void> {
    const keypair = await this.getKeypair()
    const token = await builders.claimFull(await keypair.did(), keypair)
    await this.addUcan(token)
  }
}

export default AuthStore
