# Handle

Validation logic for AT handles

## Usage

```typescript
import * as handle from '@atproto/handle'

isValid('alice.test', ['.test']) // returns true
ensureValid('alice.test', ['.test']) // returns void

isValid('al!ce.test', ['.test']) // returns false
isValid('al!ce.test', ['.test']) // throws
```

## License

MIT