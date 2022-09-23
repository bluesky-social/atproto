# ADX URI API

## Usage

```typescript
import { AdxUri } from '@adxp/uri'

const uri = new AdxUri('adx://bob.com/com.example.post/1234')
uri.protocol   // => 'adx:'
uri.origin     // => 'adx://bob.com'
uri.hostname   // => 'bob.com'
uri.collection // => 'com.example.post'
uri.recordKey  // => '1234'
```

## License

MIT