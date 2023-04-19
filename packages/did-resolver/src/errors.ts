export class DidNotFoundError extends Error {
  constructor(public did: string) {
    super(`Could not resolve DID: ${did}`)
  }
}

export class PoorlyFormattedDidError extends Error {
  constructor(public did: string) {
    super(`Poorly formatted DID: ${did}`)
  }
}

export class UnsupportedDidMethodError extends Error {
  constructor(public did: string) {
    super(`Unsupported DID method: ${did}`)
  }
}
