/* eslint-env node  */

import { TsProjectBuilder } from '@atproto/lex-builder'

Promise.all([
  // For src
  TsProjectBuilder.build({
    in: '../../../lexicons',
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
    format: true,
    pureAnnotations: true,
  }),

  // For tests
  TsProjectBuilder.build({
    in: '../../../lexicons',
    out: './tests/lexicons',
    override: true,
    include: ['app.bsky.*'],
    lib: '@atproto/lex-schema',
  }),
]).catch((err) => {
  console.error('Error building lexicon schemas:', err)
  process.exit(1)
})
