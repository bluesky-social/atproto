import { join, resolve } from 'node:path'
import type { Filter } from '@atproto/lex-builder'
import { buildFilter } from '@atproto/lex-builder'
import { cidForLex } from '@atproto/lex-cbor'
import type { LexiconDocument } from '@atproto/lex-document'
import { lexiconDocumentSchema } from '@atproto/lex-document'
import type { AtUriString, NSID } from '@atproto/syntax'
import { isEnoentError, readJsonFile } from './fs.js'
import type {
  FileUriString,
  LexiconResolverConfig,
} from './lexicons-manifest.js'

/** The CID type produced by {@link cidForLex}. */
export type Cid = Awaited<ReturnType<typeof cidForLex>>

/**
 * A lexicon document resolved from a local file, along with the information
 * needed to install (symlink) and lock it.
 */
export type ResolvedLexicon<
  TUri extends AtUriString | FileUriString = AtUriString | FileUriString,
> = {
  uri: TUri
  cid: Cid
  lexicon: LexiconDocument
}

/**
 * A pluggable, local source for resolving a lexicon by its NSID. Resolvers are
 * consulted (in order) as overrides before the network fallback.
 *
 * @see {@link DirectoryResolver}
 */
export interface LexiconResolver {
  /**
   * @returns the resolved lexicon, or `null` if this resolver does not provide
   *   the given NSID (so the next resolver / network fallback can be tried).
   */
  resolve(nsid: NSID): Promise<ResolvedLexicon | null>
}

abstract class BaseResolver implements LexiconResolver {
  constructor(protected readonly filter: Filter) {}

  async resolve(nsid: NSID): Promise<ResolvedLexicon | null> {
    return this.filter(nsid.toString()) ? this.doResolve(nsid) : null
  }

  protected abstract doResolve(nsid: NSID): Promise<ResolvedLexicon | null>
}

/**
 * Resolves lexicons from a local directory laid out by NSID
 * (e.g. `app.bsky.feed.post` → `<dir>/app/bsky/feed/post.json`).
 *
 * An optional {@link Filter} gates which NSIDs this resolver answers for,
 * mirroring the include/exclude semantics of {@link buildFilter}.
 */
export class DirectoryResolver extends BaseResolver implements LexiconResolver {
  constructor(
    protected readonly directory: string,
    filter: Filter,
  ) {
    super(filter)
  }

  protected async doResolve(nsid: NSID): Promise<ResolvedLexicon | null> {
    const id = nsid.toString()

    const path = `${join(this.directory, ...id.split('.'))}.json`
    const resolved = await readLexiconFile(path).catch((err) => {
      if (isEnoentError(err)) return null
      throw err
    })
    if (!resolved) return null

    // Defensive: a file at the NSID-derived path must actually declare that
    // NSID. If not, skip it and let the next resolver / network handle it.
    if (resolved.lexicon.id !== id) return null

    return resolved
  }
}

/**
 * Reads and parses a lexicon document from disk, computing its CID.
 *
 * @param path - Path to the JSON lexicon file
 */
export async function readLexiconFile(
  path: string,
): Promise<ResolvedLexicon<FileUriString>> {
  path = resolve(path) // Make the path absolute
  const json = await readJsonFile(path)
  const lexicon = lexiconDocumentSchema.parse(json)
  const cid = await cidForLex(lexicon)
  return { uri: `file://${path}`, cid, lexicon }
}

/**
 * Builds the ordered list of local resolvers declared in the manifest's
 * `resolvers` array. Paths are resolved relative to `manifestDir` (the directory
 * containing the manifest file).
 */
export function createResolvers(
  configs: readonly LexiconResolverConfig[] | undefined,
  manifestDir: string,
): LexiconResolver[] {
  if (!configs?.length) return []
  return configs.map((config) => {
    const filter = buildFilter({
      include: config.include,
      exclude: config.exclude,
    })
    switch (config.type) {
      case 'directory':
        return new DirectoryResolver(resolve(manifestDir, config.path), filter)
      default:
        throw new Error(
          `Unsupported lexicon resolver type: ${(config as { type: string }).type}`,
        )
    }
  })
}
