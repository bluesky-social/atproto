export type LexInstallerOptions = {
  // Define any options needed for the installer
  nsid?: string[]
  save?: boolean
}

export class LexInstaller {
  static async install(options: LexInstallerOptions) {
    // Installation logic here
    console.log('Installing lex with options:', options)
  }
}
