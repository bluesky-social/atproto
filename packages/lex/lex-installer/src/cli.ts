import type { CommandModule } from 'yargs'

function defineCommandModule<T, U>(
  cmd: CommandModule<T, U>,
): CommandModule<T, U> {
  return cmd
}

export const installCommand = defineCommandModule({
  command: ['install [nsid..]', 'i [nsid..]'],
  describe: 'Fetch and install lexicon documents',
  builder: (yargs) => {
    return yargs
      .strict()
      .positional('nsid', {
        type: 'string',
        describe: 'NSID of the lexicon to install',
        array: true,
      })
      .options({
        manifest: {
          type: 'string',
          default: './lexicons.json',
          describe: 'path to lexicons.json manifest file',
        },
        save: {
          alias: 's',
          type: 'boolean',
          default: true,
          describe:
            'Updates lexicons.json with installed lexicons (use --no-save to disable)',
        },
        update: {
          type: 'boolean',
          default: false,
          deprecated: 'use the "update" command instead',
          describe:
            'update all installed lexicons to their latest versions by re-resolving and re-installing them',
        },
        ci: {
          type: 'boolean',
          default: false,
          describe:
            'error if the installed lexicons do not match the CIDs in the lexicons.json manifest',
        },
        lexicons: {
          type: 'string',
          demandOption: true,
          default: './lexicons',
          describe: 'directory containing lexicon JSON files',
        },
      })
  },
  handler: async (argv) => {
    const { install } = await import('@atproto/lex-installer')
    await install({
      add: argv.nsid,
      save: argv.save,
      ci: argv.ci,
      update: argv.update,
      lexicons: argv.lexicons,
      manifest: argv.manifest,
    })
  },
})

export const updateCommand = defineCommandModule({
  command: ['update', 'u'],
  describe: 'Update all installed lexicons to their latest versions',
  builder: (yargs) => {
    return yargs.strict().options({
      manifest: {
        type: 'string',
        default: './lexicons.json',
        describe: 'path to lexicons.json manifest file',
      },
      lexicons: {
        type: 'string',
        demandOption: true,
        default: './lexicons',
        describe: 'directory containing lexicon JSON files',
      },
    })
  },
  handler: async (argv) => {
    const { update } = await import('@atproto/lex-installer')
    await update({
      lexicons: argv.lexicons,
      manifest: argv.manifest,
    })
  },
})
