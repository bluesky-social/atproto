export class RecordAlreadyExistsError extends Error {
  constructor(collection: string, rkey: string) {
    super(`Record already exists: ${collection}/${rkey}`)
    this.name = 'RecordAlreadyExistsError'
  }
}

export class RecordNotFoundError extends Error {
  constructor(collection: string, rkey: string) {
    super(`Record not found: ${collection}/${rkey}`)
    this.name = 'RecordNotFoundError'
  }
}
