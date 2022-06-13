import * as ucan from 'ucans'
import AuthStore from './auth-store.js'
import * as builders from './builders.js'

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
    const ucanStore = await ucan.Store.fromTokens(storedUcans)

    return new BrowserStore(keypair, ucanStore)
  }

  static async loadOrCreateKeypair(): Promise<ucan.EdKeypair> {
    const storedKey = localStorage.getItem('adxKey')
    if (storedKey) {
      return ucan.EdKeypair.fromSecretKey(storedKey)
    } else {
      // @TODO: again just stand in since no actual root keys
      const keypair = await ucan.EdKeypair.create({ exportable: true })
      localStorage.setItem('adxKey', await keypair.export())
      return keypair
    }
  }

  // This is for dev purposes, not expected to be used in production
  static async loadRootAuth(privKey: string): Promise<BrowserStore> {
    const keypair = await ucan.EdKeypair.fromSecretKey(privKey, {
      exportable: true,
    })
    const storedUcans = BrowserStore.getStoredUcanStrs()
    if (storedUcans.length === 0) {
      // since this is the root device, we claim full authority
      const fullToken = await builders.claimFull(keypair.did(), keypair)
      storedUcans.push(fullToken.encoded())
    }
    const ucanStore = await ucan.Store.fromTokens(storedUcans)

    return new BrowserStore(keypair, ucanStore)
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
