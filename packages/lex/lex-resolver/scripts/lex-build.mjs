/* eslint-env node  */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '@atproto/lex-builder'

const __dirname = dirname(fileURLToPath(import.meta.url))

build({
  lexicons: join(__dirname, '..', '..', '..', '..', 'lexicons'),
  out: join(__dirname, '..', 'src', 'lexicons'),
  clear: true,
  include: ['com.atproto.sync.getRecord'],
  lib: '@atproto/lex-schema',
  pretty: true,
  pureAnnotations: true,
  indexFile: true,
}).catch((err) => {
  console.error('Error building lexicon schemas:', err)
  process.exit(1)
})
