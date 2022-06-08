import * as ucan from 'ucans'
import * as capability from './capability.js'

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30

export abstract class AuthStore {
  protected abstract getKeypair(): Promise<ucan.EdKeypair>
  abstract addUcan(token: ucan.Chained): Promise<void>
  protected abstract getUcanStore(): Promise<ucan.Store>
  protected abstract clear(): Promise<void>
  protected abstract reset(): Promise<void>

  async getDid(): Promise<string> {
    const keypair = await this.getKeypair()
    return keypair.did()
  }

  async findUcan(scope: string): Promise<ucan.Chained | null> {
    const ucanStore = await this.getUcanStore()
    const cap = capability.adxCapability(scope, 'WRITE')
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

  async hasUcan(scope: string): Promise<boolean> {
    const found = await this.findUcan(scope)
    return found !== null
  }

  async createUcan(
    did: string,
    cap: ucan.Capability,
    lifetime = MONTH_IN_SECONDS,
  ): Promise<ucan.Chained> {
    const keypair = await this.getKeypair()
    const ucanStore = await this.getUcanStore()
    return ucan.Builder.create()
      .issuedBy(keypair)
      .toAudience(did)
      .withLifetimeInSeconds(lifetime)
      .delegateCapability(capability.adxSemantics, cap, ucanStore)
      .build()
  }

  async createAwakeProof(
    audience: string,
    resource: string,
  ): Promise<ucan.Chained> {
    const keypair = await this.getKeypair()
    const fullUcan = await this.findUcan(resource)
    if (!fullUcan) {
      throw new Error("Couldn't find ucan")
    }
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

  async buildUcan(): Promise<ucan.Builder<Record<string, unknown>>> {
    const keypair = await this.getKeypair()
    return ucan.Builder.create().issuedBy(keypair)
  }
}

export default AuthStore
