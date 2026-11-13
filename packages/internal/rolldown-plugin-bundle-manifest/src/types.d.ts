declare module 'mime' {
  declare class Mime {
    getType(path: string): string | null
    getExtension(type: string): string | null
  }

  export = new Mime()
}
