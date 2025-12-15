/* eslint-env node  */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '@atproto/lex-builder'

const __dirname = dirname(fileURLToPath(import.meta.url))

Promise.all([
  // For src
  build({
    lexicons: join(__dirname, '..', '..', '..', '..', 'lexicons'),
    out: join(__dirname, '..', 'src', 'lexicons'),
    clear: true,
    include: [
      'com.atproto.repo.createRecord',
      'com.atproto.repo.deleteRecord',
      'com.atproto.repo.getRecord',
      'com.atproto.repo.putRecord',
      'com.atproto.repo.listRecords',
      'com.atproto.repo.uploadBlob',
    ],
    lib: '@atproto/lex-schema',
    pretty: true,
    pureAnnotations: true,
  }),

  // For tests
  build({
    lexicons: join(__dirname, '..', '..', '..', '..', 'lexicons'),
    out: join(__dirname, '..', 'tests', 'lexicons'),
    clear: true,
    include: [
      'app.bsky.*',
      'com.atproto.repo.createRecord',
      'com.atproto.repo.getRecord',
    ],
    lib: '@atproto/lex-schema',
    pretty: true,
  }),
]).catch((err) => {
  console.error('Error building lexicon schemas:', err)
  process.exit(1)
})
