/* eslint-env node  */

import { LexBuilder } from '@atproto/lex-builder'

Promise.all([
  // For src
  LexBuilder.build({
    lexicons: '../../../lexicons',
    out: './src/lexicons',
    override: true,
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
  LexBuilder.build({
    lexicons: '../../../lexicons',
    out: './tests/lexicons',
    override: true,
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
