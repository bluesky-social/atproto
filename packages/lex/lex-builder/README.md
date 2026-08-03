# @atproto/lex-builder

- [Changelog](./CHANGELOG.md)
- [`@atproto/lex` documentation](https://github.com/bluesky-social/atproto/blob/main/packages/lex/lex/README.md)

Generates TypeScript schemas from [Lexicon](https://atproto.com/specs/lexicon) documents. This is the engine behind the `lex build` command.

```typescript
import { build } from '@atproto/lex-builder'

await build({ lexicons: './lexicons', out: './src/lexicons' })
```

Most projects should use the `lex build` CLI from [`@atproto/lex`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex) rather than calling this package directly.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
