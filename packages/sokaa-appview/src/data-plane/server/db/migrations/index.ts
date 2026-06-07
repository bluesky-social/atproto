// Migration registry for Kysely's Migrator. Each file exports up/down; this
// barrel registers them under stable keys (leading _ because export names cannot
// start with a digit). We avoid Kysely's FileMigrationProvider because it does
// not play nicely with the TypeScript build — same pattern as packages/bsky.

export * as _20260607T000000000Z from './20260607T000000000Z-init'
