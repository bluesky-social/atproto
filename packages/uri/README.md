# ATP URI API

> This package is now deprecated. Please use `@atproto/syntax`, which is the
> successor to this package and provides the same interfaces.

## Usage

```typescript
import { AtUri } from '@atproto/uri'

const uri = new AtUri('at://bob.com/com.example.post/1234')
uri.protocol // => 'at:'
uri.origin // => 'at://bob.com'
uri.hostname // => 'bob.com'
uri.collection // => 'com.example.post'
uri.rkey // => '1234'
```

## License

MIT
