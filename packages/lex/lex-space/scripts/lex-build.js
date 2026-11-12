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
      'com.atproto.managedspace.policy',
      'com.atproto.memberspace.defs',
      'com.atproto.memberspace.listMembers',
      'com.atproto.memberspace.policy',
      'com.atproto.memberspace.putMembers',
      'com.atproto.memberspace.removeMembers',
      'com.atproto.personalspace.policy',
      'com.atproto.space.applyWrites',
      'com.atproto.space.clearRecords',
      'com.atproto.space.createRecord',
      'com.atproto.space.createSpace',
      'com.atproto.space.defs',
      'com.atproto.space.deleteRecord',
      'com.atproto.space.deleteSpace',
      'com.atproto.space.getBlob',
      'com.atproto.space.getDelegationToken',
      'com.atproto.space.getLatestCommit',
      'com.atproto.space.getRecord',
      'com.atproto.space.getRepo',
      'com.atproto.space.getSpace',
      'com.atproto.space.getSpaceCredential',
      'com.atproto.space.listBlobs',
      'com.atproto.space.listRecords',
      'com.atproto.space.listRepoOps',
      'com.atproto.space.listSpaces',
      'com.atproto.space.listWriters',
      'com.atproto.space.putRecord',
      'com.atproto.space.registerNotify',
      'com.atproto.space.removeWriter',
      'com.atproto.space.unregisterNotify',
      'com.atproto.space.updateSpace',
    ],
    lib: '@atproto/lex-schema',
    pretty: true,
    indexFile: true,
    defaultExport: true,
    importExt: '.js',
  }),

  // For tests
  build({
    lexicons: join(__dirname, '..', '..', '..', '..', 'lexicons'),
    out: join(__dirname, '..', 'tests', 'lexicons'),
    clear: true,
    include: [
      'com.atproto.managedspace.policy',
      'com.atproto.memberspace.policy',
      'com.atproto.memberspace.putMembers',
      'com.atproto.personalspace.policy',
      'com.atproto.server.createAccount',
      'com.atproto.space.createSpace',
      'com.atproto.space.getBlob',
      'com.atproto.space.getDelegationToken',
      'com.atproto.space.getRecord',
      'com.atproto.space.getSpaceCredential',
      'com.atproto.space.listWriters',
    ],
    lib: '@atproto/lex-schema',
    pretty: true,
    indexFile: true,
  }),
]).catch((err) => {
  console.error('Error building lexicon schemas:', err)
  process.exit(1)
})
