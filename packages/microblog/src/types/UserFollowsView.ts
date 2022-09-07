export interface Params {
  user: string
  limit?: number
  before?: string
}

export interface Response {
  subject: {
    did: string
    name: string
    displayName?: string
  }
  follows: {
    did: string
    name: string
    displayName?: string
    createdAt?: string
    indexedAt: string
  }[]
}
