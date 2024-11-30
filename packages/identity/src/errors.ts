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

export class PoorlyFormattedDidDocumentError extends Error {
  constructor(
    public did: string,
    public doc: unknown,
  ) {
    super(`Poorly formatted DID Document: ${doc}`)
  }
}

export class UnsupportedDidWebPathError extends Error {
  constructor(public did: string) {
    super(`Unsupported did:web paths: ${did}`)
  }
}
