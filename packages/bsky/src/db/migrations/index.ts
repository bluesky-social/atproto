// NOTE this file can be edited by hand, but it is also appended to by the migration:create command.
// It's important that every migration is exported from here with the proper name. We'd simplify
// this with kysely's FileMigrationProvider, but it doesn't play nicely with the build process.

export * as _20230309T045948368Z from './20230309T045948368Z-init'
export * as _20230408T152211201Z from './20230408T152211201Z-notification-init'
export * as _20230417T210628672Z from './20230417T210628672Z-moderation-init'
export * as _20230420T211446071Z from './20230420T211446071Z-did-cache'
export * as _20230427T194702079Z from './20230427T194702079Z-notif-record-index'
export * as _20230605T144730094Z from './20230605T144730094Z-post-profile-aggs'
export * as _20230607T211442112Z from './20230607T211442112Z-feed-generator-init'
export * as _20230608T201813132Z from './20230608T201813132Z-mute-lists'
