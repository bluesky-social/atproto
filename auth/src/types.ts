import ucan from 'ucans'

export interface AuthStore {
  getDid: () => Promise<string>
  addUcan: (token: ucan.Chained) => Promise<void>
  findUcan: (scope: string) => Promise<ucan.Chained | null>
  hasUcan: (scope: string) => Promise<boolean>
  createUcan: (
    did: string,
    cap: ucan.Capability,
    lifetime?: number,
  ) => Promise<ucan.Chained>
  createAwakeProof: (audience: string, resouce: string) => Promise<ucan.Chained>
  getUcanStore: () => Promise<ucan.Store> // @TODO: do we need this?
  clear: () => Promise<void>
  reset: () => Promise<void>
}
