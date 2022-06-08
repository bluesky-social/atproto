import * as auth from '@adxp/auth'
import * as ucan from 'ucans'

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30

// @TODO: Stand in since we don't have actual root keys
// ---------------
const PRIV_KEY =
  'aghhYelL58I8vwVWt7W5cs+Y4uYYWQma6jX0MjkCt7cOdiciXp5JJcOtoWHCgljZhLFV/h0E9zdeYXoSZ0rCgA=='

const isRootKey = (): boolean => {
  console.log(process.env.REACT_APP_ROOT_KEY)
  return process.env.REACT_APP_ROOT_KEY === 'true'
}
// ---------------

export class BrowserStore implements auth.AuthStore {
  private keypair: ucan.EdKeypair
  private ucanStore: ucan.Store

  constructor(keypair: ucan.EdKeypair, ucanStore: ucan.Store) {
    this.keypair = keypair
    this.ucanStore = ucanStore
  }

  static async load(): Promise<BrowserStore> {
    const keypair = await BrowserStore.loadOrCreateKeypair()

    const storedUcans = BrowserStore.getStoredUcanStrs()
    if (storedUcans.length === 0 && isRootKey()) {
      // if this is the root device, we claim full authority
      const fullToken = await auth.claimFull(keypair.did(), keypair)
      storedUcans.push(fullToken.encoded())
    }
    const ucanStore = await ucan.Store.fromTokens(storedUcans)

    return new BrowserStore(keypair, ucanStore)
  }

  static async loadOrCreateKeypair(): Promise<ucan.EdKeypair> {
    const storedKey = localStorage.getItem('adxKey')
    if (storedKey) {
      return ucan.EdKeypair.fromSecretKey(storedKey)
    } else {
      // @TODO: again just stand in since no actual root keys
      const keypair = isRootKey()
        ? await ucan.EdKeypair.fromSecretKey(PRIV_KEY, { exportable: true })
        : await ucan.EdKeypair.create({ exportable: true })
      localStorage.setItem('adxKey', await keypair.export())
      return keypair
    }
  }

  static getStoredUcanStrs(): string[] {
    const storedStr = localStorage.getItem('adxUcans')
    if (!storedStr) return []
    return storedStr.split(',')
  }

  static setStoredUcanStrs(ucans: string[]): void {
    localStorage.setItem('adxUcans', ucans.join(','))
  }

  async getDid(): Promise<string> {
    return this.keypair.did()
  }

  async addUcan(token: ucan.Chained): Promise<void> {
    this.ucanStore.add(token)
    const storedUcans = BrowserStore.getStoredUcanStrs()
    BrowserStore.setStoredUcanStrs([...storedUcans, token.encoded()])
  }

  async findUcan(scope: string): Promise<ucan.Chained | null> {
    const cap = auth.adxCapability(scope, 'WRITE')
    const adxCap = auth.adxSemantics.tryParsing(cap)
    if (adxCap === null) return null
    const res = await this.ucanStore.findWithCapability(
      await this.getDid(),
      auth.adxSemantics,
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
    return ucan.Builder.create()
      .issuedBy(this.keypair)
      .toAudience(did)
      .withLifetimeInSeconds(lifetime)
      .delegateCapability(auth.adxSemantics, cap, this.ucanStore)
      .build()
  }

  async createAwakeProof(
    audience: string,
    resource: string,
  ): Promise<ucan.Chained> {
    const fullUcan = await this.findUcan(resource)
    if (!fullUcan) {
      throw new Error("Couldn't find ucan")
    }
    const sessionUcan = await ucan.build({
      issuer: this.keypair,
      audience: audience,
      lifetimeInSeconds: 60 * 5,
      proofs: [fullUcan.encoded()],
    })
    const encoded = ucan.encode(sessionUcan)
    const chained = await ucan.Chained.fromToken(encoded)
    return chained
  }

  async getUcanStore(): Promise<ucan.Store> {
    return this.ucanStore
  }

  async clear(): Promise<void> {
    localStorage.clear()
  }

  async reset(): Promise<void> {
    this.clear()
    this.keypair = await BrowserStore.loadOrCreateKeypair()
    this.ucanStore = await ucan.Store.fromTokens([])
  }
}

export default BrowserStore
