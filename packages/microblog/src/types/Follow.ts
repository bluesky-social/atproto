export interface Record {
  subject: {
    did: string
    name?: string // @TODO: should we include name here?
  }
  createdAt: string
}
