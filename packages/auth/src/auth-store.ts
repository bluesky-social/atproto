import * as ucan from './ucans'
import { DidableKey } from './ucans'

import { adxSemantics, parseAdxResource } from './semantics'
import { MONTH_IN_SEC, YEAR_IN_SEC } from './consts'
import { CapWithProof, Signer } from './types'
import { vaguerCap, writeCap } from './capabilities'

export class AuthStore implements Signer {
  protected keypair: DidableKey
  protected ucanStore: ucan.StoreI | null = null
  protected tokens: string[]
  protected controlledDid: string | null

  constructor(keypair: DidableKey, tokens: string[], controlledDid?: string) {
    this.keypair = keypair
    this.tokens = tokens
    this.controlledDid = controlledDid || null
  }

  // Update these for sub classes
  // ----------------

  protected async getKeypair(): Promise<DidableKey> {
    return this.keypair
  }

  async addUcan(token: ucan.Ucan): Promise<void> {
    const ucanStore = await this.getUcanStore()
    await ucanStore.add(token)
  }

  async getUcanStore(): Promise<ucan.StoreI> {
    if (!this.ucanStore) {
      this.ucanStore = await ucan.Store.fromTokens(adxSemantics, this.tokens)
    }
    return this.ucanStore
  }

  async clear(): Promise<void> {
    // noop
  }

  async reset(): Promise<void> {
    // noop
  }

  // ----------------

  async keypairDid(): Promise<string> {
    const keypair = await this.getKeypair()
    return keypair.did()
  }

  async did(): Promise<string> {
    if (this.controlledDid) {
      return this.controlledDid
    }
    return this.keypairDid()
  }

  async canSignForDid(did: string): Promise<boolean> {
    if (did === this.controlledDid) return true
    if (did === (await this.keypairDid())) return true
    return false
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    const keypair = await this.getKeypair()
    return keypair.sign(data)
  }

  async findProof(cap: ucan.Capability): Promise<ucan.DelegationChain | null> {
    const ucanStore = await this.getUcanStore()
    // we only handle adx caps right now
    const resource = parseAdxResource(cap.with)
    if (resource === null) return null
    const res = await ucan.first(
      ucanStore.findWithCapability(await this.did(), cap, resource.did),
    )
    if (!res) return null
    return res
  }

  async findUcan(cap: ucan.Capability): Promise<ucan.Ucan | null> {
    const chain = await this.findProof(cap)
    if (chain === null) return null
    return chain.ucan
  }

  async hasUcan(cap: ucan.Capability): Promise<boolean> {
    const found = await this.findUcan(cap)
    return found !== null
  }

  async createUcan(
    audience: string,
    cap: ucan.Capability,
    lifetime = MONTH_IN_SEC,
  ): Promise<ucan.Ucan> {
    const keypair = await this.getKeypair()
    const ucanStore = await this.getUcanStore()
    return ucan.Builder.create()
      .issuedBy(keypair)
      .toAudience(audience)
      .withLifetimeInSeconds(lifetime)
      .delegateCapability(cap, ucanStore)
      .build()
  }

  // Creates a UCAN that permissions all required caps
  // We find the vaguest proof possible for each cap to avoid unnecessary duplication
  async createUcanForCaps(
    audience: string,
    caps: ucan.Capability[],
    lifetime = MONTH_IN_SEC,
  ): Promise<ucan.Ucan> {
    // @TODO make sure to dedupe proofs
    const proofs: CapWithProof[] = []
    for (const cap of caps) {
      const proof = await this.vaguestProofForCap(cap)
      if (proof === null) {
        throw new Error(`Could not find a ucan for capability: ${cap.with}`)
      }
      proofs.push(proof)
    }

    const keypair = await this.getKeypair()

    let builder = ucan.Builder.create()
      .issuedBy(keypair)
      .toAudience(audience)
      .withLifetimeInSeconds(lifetime)

    for (const prf of proofs) {
      builder = builder.delegateCapability(prf.cap, prf.prf, adxSemantics)
    }

    return builder.build()
  }

  // Finds the most general proof for the given cap
  // (And thus most likely to overlap with other proofs)
  async vaguestProofForCap(cap: ucan.Capability): Promise<CapWithProof | null> {
    const prf = await this.findProof(cap)
    if (prf === null) return null
    const vauger = vaguerCap(cap)
    if (vauger === null) return { cap, prf }
    const vaugerPrf = await this.vaguestProofForCap(vauger)
    if (vaugerPrf === null) return { cap, prf }
    return vaugerPrf
  }

  // Claim a fully permissioned Ucan & add to store
  // Mainly for dev purposes
  async claimFull(): Promise<ucan.Ucan> {
    const keypair = await this.getKeypair()
    const ownDid = await this.did()
    const token = await ucan.Builder.create()
      .issuedBy(keypair)
      .toAudience(ownDid)
      .withLifetimeInSeconds(YEAR_IN_SEC)
      .claimCapability(writeCap(ownDid))
      .build()
    await this.addUcan(token)
    return token
  }
}

export default AuthStore
