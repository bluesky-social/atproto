import { isEnoentError, readJsonFile } from './fs.js'
import { LexInstaller, LexInstallerOptions } from './lex-installer.js'
import {
  LexiconsManifest,
  lexiconsManifestSchema,
} from './lexicons-manifest.js'

export type LexInstallOptions = LexInstallerOptions & {
  add?: string[]
  save?: boolean
  ci?: boolean
}

export async function install(options: LexInstallOptions) {
  const manifest: LexiconsManifest | undefined = await readJsonFile(
    options.manifest,
  ).then(
    (json) => lexiconsManifestSchema.parse(json),
    (cause: unknown) => {
      if (isEnoentError(cause)) return undefined
      throw new Error('Failed to read lexicons manifest', { cause })
    },
  )

  const additions = new Set(options.add)

  // Perform the installation using the existing manifest as "hint"
  await using installer = new LexInstaller(options)

  await installer.install({ additions, manifest })

  // Verify lockfile
  if (options.ci && (!manifest || !installer.equals(manifest))) {
    throw new Error('Lexicons manifest is out of date')
  }

  // Save changes if requested
  if (options.save) {
    await installer.save()
  }
}
