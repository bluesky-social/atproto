import * as ucan from 'ucans'
import AuthStore from './auth-store.js'
import * as builders from './builders.js'

// @TODO: Stand in since we don't have actual root keys
// ---------------
const PRIV_KEY =
  'aghhYelL58I8vwVWt7W5cs+Y4uYYWQma6jX0MjkCt7cOdiciXp5JJcOtoWHCgljZhLFV/h0E9zdeYXoSZ0rCgA=='

const isRootKey = (): boolean => {
  console.log(process.env.REACT_APP_ROOT_KEY)
  return process.env.REACT_APP_ROOT_KEY === 'true'
}
// ---------------

export class BrowserStore extends AuthStore {
  private keypair: ucan.EdKeypair
  private ucanStore: ucan.Store

  constructor(keypair: ucan.EdKeypair, ucanStore: ucan.Store) {
    super()
    this.keypair = keypair
    this.ucanStore = ucanStore
  }

  static async load(): Promise<BrowserStore> {
    const keypair = await BrowserStore.loadOrCreateKeypair()

    const storedUcans = BrowserStore.getStoredUcanStrs()
    if (storedUcans.length === 0 && isRootKey()) {
      // if this is the root device, we claim full authority
      const fullToken = await builders.claimFull(keypair.did(), keypair)
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

  protected async getKeypair(): Promise<ucan.EdKeypair> {
    return this.keypair
  }

  async addUcan(token: ucan.Chained): Promise<void> {
    this.ucanStore.add(token)
    const storedUcans = BrowserStore.getStoredUcanStrs()
    BrowserStore.setStoredUcanStrs([...storedUcans, token.encoded()])
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
