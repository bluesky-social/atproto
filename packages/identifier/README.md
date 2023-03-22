# Identifier

Validation logic for AT identifiers - DIDs & Handles

## Usage

```typescript
import * as identifier from '@atproto/identifier'

isValidHandle('alice.test') // returns true
ensureValidHandle('alice.test') // returns void

isValidHandle('al!ce.test') // returns false
ensureValidHandle('al!ce.test') // throws

ensureValidDid('did:method:val') // returns void
ensureValidDid(':did:method:val') // throws
```

## License

MIT
