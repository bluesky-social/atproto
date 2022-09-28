import * as crypto from '@adxp/crypto'
import * as ucan from './ucans'
import AuthStore from './auth-store'

export class BrowserStore extends AuthStore {
  static async load(): Promise<BrowserStore> {
    const keypair = await BrowserStore.loadOrCreateKeypair()

    const storedUcans = BrowserStore.getStoredUcanStrs()

    return new BrowserStore(keypair, storedUcans)
  }

  static async loadOrCreateKeypair(): Promise<crypto.EcdsaKeypair> {
    // @TODO these should be persisted as non-exportable keys to IDB
    const storedKey = localStorage.getItem('adxKey')
    if (storedKey) {
      const jwk = JSON.parse(storedKey)
      return crypto.EcdsaKeypair.import(jwk)
    } else {
      // @TODO: again just stand in since no actual root keys
      const keypair = await crypto.EcdsaKeypair.create({ exportable: true })
      const jwk = await keypair.export()
      localStorage.setItem('adxKey', JSON.stringify(jwk))
      return keypair
    }
  }

  // This is for dev purposes, not expected to be used in production
  static async loadRootAuth(jwk: JsonWebKey): Promise<BrowserStore> {
    const keypair = await crypto.EcdsaKeypair.import(jwk, {
      exportable: true,
    })
    localStorage.setItem('adxKey', JSON.stringify(jwk))
    const storedUcans = BrowserStore.getStoredUcanStrs()
    const authStore = new BrowserStore(keypair, storedUcans)
    if (storedUcans.length === 0) {
      // since this is the root device, we claim full authority
      await authStore.claimFull()
    }
    return authStore
  }

  static getStoredUcanStrs(): string[] {
    const storedStr = localStorage.getItem('adxUcans')
    if (!storedStr) return []
    return storedStr.split(',')
  }

  static setStoredUcanStrs(ucans: string[]): void {
    localStorage.setItem('adxUcans', ucans.join(','))
  }

  async addUcan(token: ucan.Ucan): Promise<void> {
    const storedUcans = BrowserStore.getStoredUcanStrs()
    BrowserStore.setStoredUcanStrs([...storedUcans, ucan.encode(token)])
    const store = await this.getUcanStore()
    await store.add(token)
  }

  async clear(): Promise<void> {
    localStorage.clear()
  }

  async reset(): Promise<void> {
    this.clear()
    this.keypair = await BrowserStore.loadOrCreateKeypair()
    this.tokens = []
    this.ucanStore = null
  }
}

export default BrowserStore
