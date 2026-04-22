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

export class MemberAlreadyExistsError extends Error {
  constructor(did: string) {
    super(`Member already exists: ${did}`)
    this.name = 'MemberAlreadyExistsError'
  }
}

export class MemberNotFoundError extends Error {
  constructor(did: string) {
    super(`Member not found: ${did}`)
    this.name = 'MemberNotFoundError'
  }
}
