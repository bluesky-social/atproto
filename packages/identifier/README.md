# Identifier

Validation logic for AT identifiers - DIDs & Handles

## Usage

```typescript
import * as identifier from '@atproto/identifier'

isValid('alice.test', ['.test']) // returns true
ensureValid('alice.test', ['.test']) // returns void

isValid('al!ce.test', ['.test']) // returns false
ensureValid('al!ce.test', ['.test']) // throws
```

## License

MIT