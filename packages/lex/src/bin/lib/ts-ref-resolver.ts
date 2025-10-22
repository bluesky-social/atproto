import { join } from 'node:path'
import { SourceFile } from 'ts-morph'
import { LexiconDocument } from '../../doc/lexicon-document.js'
import { LexiconIndexer } from '../../doc/lexicon-indexer.js'
import { asSafeIdentifier, isReservedWord } from './ts-lang.js'
import { asRelativePath, memoize, ucFirst } from './util.js'

export type ResolvedRef = {
  varName: string
  typeName: string
}

/**
 * Utility class to resolve lexicon references to TypeScript identifiers,
 * generating "import" statements as needed.
 */
export class TsRefResolver {
  constructor(
    private doc: LexiconDocument,
    private file: SourceFile,
    private indexer: LexiconIndexer,
  ) {}

  public readonly resolve = memoize(
    async (ref: string): Promise<ResolvedRef> => {
      const [nsid, hash = 'main'] = ref.split('#')

      // @NOTE: Normalize to ensure proper memoization
      const fullRef = `${nsid}#${hash}`

      if (nsid === '' || nsid === this.doc.id) {
        return this.resolveLocal(hash)
      } else {
        return this.resolveExternal(fullRef)
      }
    },
  )

  #defCounters = new Map<string, number>()
  private nextSafeDefinitionIdentifier(safeIdentifier: string) {
    const count = this.#defCounters.get(safeIdentifier) ?? 0
    this.#defCounters.set(safeIdentifier, count + 1)
    // @NOTE We don't need to check against local declarations in the file here
    // since we are using a naming system that should guarantee no other
    // identifier has a <safeIdentifier>$<number> format.
    return `${safeIdentifier}$${count}`
  }

  public readonly resolveLocal = memoize(
    async (hash: string): Promise<ResolvedRef> => {
      if (!Object.hasOwn(this.doc.defs, hash)) {
        throw new Error(`Definition ${hash} not found in ${this.doc.id}`)
      }

      const identifier = asSafeDefinitionIdentifier(hash)

      const varName = identifier
        ? identifier === hash || !Object.hasOwn(this.doc.defs, identifier)
          ? // Safe identifier can be used as-is as it does not conflict with
            // other definition names
            identifier
          : // In order to keep identifiers stable, we use the safe identifier
            // as base, and append a counter to avoid conflicts
            this.nextSafeDefinitionIdentifier(identifier)
        : // hash only contained unsafe characters, generate a safe one
          this.nextSafeDefinitionIdentifier('def')

      const typeName = ucFirst(varName)

      return {
        varName: isReservedWord(varName) ? `_${varName}` : varName,
        typeName: isReservedWord(typeName) ? `_${typeName}` : typeName,
      }
    },
  )

  /**
   * @note Since this is a memoized function, and is used to generate the name
   * of local variables, we should avoid returning different results for
   * similar, but non strictly equal, inputs (eg. normalized / non-normalized).
   * @see {@link resolve}
   */
  private readonly resolveExternal = memoize(
    async (fullRef: string): Promise<ResolvedRef> => {
      const [nsid, hash] = fullRef.split('#')
      const moduleSpecifier = `${asRelativePath(
        this.file.getDirectoryPath(),
        join('/', ...nsid.split('.')),
      )}.defs.js`

      // Lets first make sure the referenced lexicon exists
      const srcDoc = await this.indexer.get(nsid)
      const srcDef = Object.hasOwn(srcDoc.defs, hash) ? srcDoc.defs[hash] : null
      if (!srcDef) {
        throw new Error(
          `Lexicon reference ${hash} not found (referenced from ${this.doc.id})`,
        )
      }

      // import * as <nsIdentifier> from './<moduleSpecifier>'
      const nsIdentifier = this.getNsIdentifier(nsid, moduleSpecifier)

      return {
        varName: `${nsIdentifier}.${hash}`,
        // @NOTE Prefer the .Record export (instead of .Main) when referencing a
        // record definition:
        typeName: `${nsIdentifier}.${useRecordExport(srcDoc, hash) ? 'Record' : ucFirst(hash)}`,
      }
    },
  )

  private getNsIdentifier(nsid: string, moduleSpecifier: string) {
    const namespaceImportDeclaration =
      this.file.getImportDeclaration(
        (imp) =>
          !imp.isTypeOnly() &&
          imp.getModuleSpecifierValue() === moduleSpecifier &&
          imp.getNamespaceImport() != null,
      ) ||
      this.file.addImportDeclaration({
        moduleSpecifier,
        namespaceImport: this.computeSafeNamespaceIdentifierFor(nsid),
      })

    return namespaceImportDeclaration.getNamespaceImport()!.getText()
  }

  #aliasCounter = 0
  private computeSafeNamespaceIdentifierFor(nsid: string) {
    const baseName = nsidToIdentifier(nsid)

    let name = baseName
    while (this.isConflictingIdentifier(name)) {
      name = `${baseName}$$${this.#aliasCounter++}`
    }

    return name
  }

  private isConflictingIdentifier(name: string) {
    return (
      this.conflictsWithKeywords(name) ||
      this.conflictsWithUtils(name) ||
      this.conflictsWithLocalDefs(name) ||
      this.conflictsWithLocalDeclarations(name) ||
      this.conflictsWithImports(name)
    )
  }

  private conflictsWithKeywords(name: string) {
    return isReservedWord(name)
  }

  private conflictsWithUtils(name: string) {
    // Do not allow "Main" as imported ns identifier since it has a special
    // meaning in the context of lexicon definitions.
    if (name === 'Main') return true

    // When "useRecordExport" returns true, an export named "Record" will be
    // used in addition to the hash named export. So we need to make sure both
    // names are not conflicting with local variables.
    if (name === 'Record') return true

    // Utility functions generated for lexicon schemas are prefixed with "$"
    return name.startsWith('$')
  }

  private conflictsWithLocalDefs(name: string) {
    return Object.keys(this.doc.defs).some((hash) => {
      const identifier = asSafeDefinitionIdentifier(hash)

      // A safe identifier will be generated, no risk of conflict.
      if (!identifier) return false

      // The imported name conflicts with a local definition name
      if (identifier === name || `_${identifier}` === name) return true

      // The imported name conflicts with the type name of a local definition
      const typeName = ucFirst(identifier)
      if (typeName === name || `_${typeName}` === name) return true

      return false
    })
  }

  private conflictsWithLocalDeclarations(name: string) {
    return (
      this.file.getVariableDeclarations().some((v) => v.getName() === name) ||
      this.file
        .getVariableStatements()
        .some((vs) => vs.getDeclarations().some((d) => d.getName() === name)) ||
      this.file.getTypeAliases().some((t) => t.getName() === name) ||
      this.file.getInterfaces().some((i) => i.getName() === name) ||
      this.file.getClasses().some((c) => c.getName() === name) ||
      this.file.getFunctions().some((f) => f.getName() === name) ||
      this.file.getEnums().some((e) => e.getName() === name)
    )
  }

  private conflictsWithImports(name: string) {
    return this.file.getImportDeclarations().some(
      (imp) =>
        // import name from '...'
        imp.getDefaultImport()?.getText() === name ||
        // import * as name from '...'
        imp.getNamespaceImport()?.getText() === name ||
        imp.getNamedImports().some(
          (named) =>
            // import { name } from '...'
            // import { foo as name } from '...'
            (named.getAliasNode()?.getText() ?? named.getName()) === name,
        ),
    )
  }
}

/**
 * @see {@link https://atproto.com/specs/nsid NSID syntax spec}
 */
function nsidToIdentifier(nsid: string) {
  // Keep only the last two segments of the nsid for brevity (while keeping
  // some "context"). This will work particularly well for lexicons build with
  // two levels of nsid "grouping" (like app.bsky.*.*, com.atproto.*.*).
  const identifier =
    nsid.includes('.') || nsid.includes('-')
      ? nsid.split('.').slice(-2).map(nsidSegmentToIdentifier).join('')
      : nsid

  if (startsWithDigit(identifier)) {
    return `N${identifier}`
  }
  return identifier
}

function startsWithDigit(str: string) {
  const code = str.charCodeAt(0)
  return code >= 48 && code <= 57 // '0' to '9'
}

function nsidSegmentToIdentifier(segment: string) {
  return segment.split('-').map(ucFirst).join('')
}

export function useRecordExport(doc: LexiconDocument, hash: string) {
  return (
    hash === 'main' &&
    !Object.hasOwn(doc.defs, 'record') &&
    doc.defs[hash]?.type === 'record'
  )
}

function asSafeDefinitionIdentifier(hash: string) {
  // - We don't want leading $ to avoid conflicts with generated utilities
  // - We don't want leading _ to avoid conflicts with names generated to escape
  //   reserved words
  // - We don't want $ in definition names to avoid confusion with generated
  //   safe definition identifiers
  return asSafeIdentifier(hash)
    ?.replace(/^[_$]+/, '') // Remove leading $ and _
    .replaceAll(/[$]+/g, '_') // Remove $ in the middle
    .replaceAll(/_+/g, '_') // collapse multiple underscores (for readability)
}
