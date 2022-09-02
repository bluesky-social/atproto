export interface Record {
  subject: {
    //@TODO: maybe "creator" instead?
    did: string
    name?: string // @TODO: should we include name here?
  }
  createdAt: string
}
