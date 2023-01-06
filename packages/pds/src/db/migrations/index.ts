// NOTE this file can be edited by hand, but it is also appended to by the migration:create command.
// It's important that every migration is exported from here with the proper name. We'd simplify
// this with kysely's FileMigrationProvider, but it doesn't play nicely with the build process.

export * as _20221021T162202001Z from './20221021T162202001Z-init'
export * as _20221116T234458063Z from './20221116T234458063Z-duplicate-records'
export * as _20221202T212459280Z from './20221202T212459280Z-blobs'
export * as _20221209T210026294Z from './20221209T210026294Z-banners'
export * as _20221212T195416407Z from './20221212T195416407Z-post-media'
export * as _20221215T220356370Z from './20221215T220356370Z-password-reset-otp'
export * as _20221226T213635517Z from './20221226T213635517Z-mute-init'
export * as _20221220T225614428Z from './20221230T215012029Z-moderation-init'
