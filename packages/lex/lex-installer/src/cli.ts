import type { CommandModule } from 'yargs'

function defineCommandModule<T, U>(
  cmd: CommandModule<T, U>,
): CommandModule<T, U> {
  return cmd
}

const INSTALLER_OPTIONS = {
  manifest: {
    type: 'string',
    default: './lexicons.json',
    normalize: true,
    describe: 'path to lexicons manifest file',
  },
  lexicons: {
    type: 'string',
    default: './lexicons',
    normalize: true,
    describe: 'directory containing lexicon JSON files',
  },
} as const

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
        ...INSTALLER_OPTIONS,
        save: {
          alias: 's',
          type: 'boolean',
          default: true,
          describe:
            'Updates the manifest with installed lexicons (use --no-save to disable)',
        },
        update: {
          type: 'boolean',
          deprecated: 'use the "update" command instead',
          conflicts: ['ci'],
          describe:
            'update all installed lexicons to their latest versions by re-resolving and re-installing them',
        },
        ci: {
          type: 'boolean',
          describe:
            'error if the installed lexicons do not match the CIDs in the lexicons.json manifest',
        },
      })
  },
  handler: async (argv) => {
    const { install } = await import('@atproto/lex-installer')
    await install({
      lexicons: argv.lexicons,
      manifest: argv.manifest,
      //
      additions: argv.nsid,
      save: argv.save,
      ci: argv.ci,
      update: argv.update,
    })
  },
})

export const updateCommand = defineCommandModule({
  command: ['update', 'u'],
  describe: 'Update all installed lexicons to their latest versions',
  builder: (yargs) => {
    return yargs.strict().options({
      ...INSTALLER_OPTIONS,
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
