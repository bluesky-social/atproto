// NOTE this file can be edited by hand, but it is also appended to by the migration:create command.
// It's important that every migration is exported from here with the proper name. We'd simplify
// this with kysely's FileMigrationProvider, but it doesn't play nicely with the build process.

export * as _20231219T205730722Z from './20231219T205730722Z-init'
export * as _20240116T085607200Z from './20240116T085607200Z-communication-template'
export * as _20240201T051104136Z from './20240201T051104136Z-mod-event-blobs'
export * as _20240208T213404429Z from './20240208T213404429Z-add-tags-column-to-moderation-subject'
export * as _20240228T003647759Z from './20240228T003647759Z-add-label-sigs'
