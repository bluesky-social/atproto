import { HtmlValue } from './escapers.js'
import { Html } from './html.js'
import { html } from './tags.js'

export type AssetRef = {
  url: string
}

export type Attrs = Record<string, boolean | string | undefined>

/**
 * @see {@link https://developer.mozilla.org/fr/docs/Web/HTML/Attributes/rel}
 */
const ALLOWED_LINK_REL_VALUES = Object.freeze([
  'alternate',
  'author',
  'canonical',
  'dns-prefetch',
  'external',
  'expect',
  'help',
  'icon',
  'license',
  'manifest',
  'me',
  'modulepreload',
  'next',
  'pingback',
  'preconnect',
  'prefetch',
  'preload',
  'prerender',
  'prev',
  'privacy-policy',
  'search',
  'stylesheet',
  'terms-of-service',
] as const)
export type LinkRel = (typeof ALLOWED_LINK_REL_VALUES)[number]
export const isLinkRel = (rel: unknown): rel is LinkRel =>
  (ALLOWED_LINK_REL_VALUES as readonly unknown[]).includes(rel)

export type LinkAttrs = Attrs & {
  href: string
  rel: LinkRel
}
export type MetaAttrs =
  | { name: string; content: string }
  | { 'http-equiv': string; content: string }

const defaultViewport = html`<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>`

export type BuildDocumentOptions = {
  htmlAttrs?: Attrs
  base?: URL
  meta?: readonly MetaAttrs[]
  links?: readonly LinkAttrs[]
  preloads?: readonly AssetRef[]
  head?: HtmlValue
  title?: HtmlValue
  scripts?: readonly (Html | AssetRef | undefined)[]
  styles?: readonly (Html | AssetRef | undefined)[]
  body?: HtmlValue
  bodyAttrs?: Attrs
}

export const buildDocument = ({
  htmlAttrs,
  head,
  title,
  body,
  bodyAttrs,
  base,
  meta,
  links,
  preloads,
  scripts,
  styles,
}: BuildDocumentOptions) => html`<!doctype html>
<html${attrsToHtml(htmlAttrs)}>
  <head>
    <meta charset="UTF-8" />
    ${title && html`<title>${title}</title>`}
    ${base && html`<base href="${base.href}" />`}
    ${meta?.some(isViewportMeta) ? null : defaultViewport}
    ${meta?.map(metaToHtml)}
    ${preloads?.map(linkPreload)}
    ${links?.map(linkToHtml)}
    ${head}
    ${styles?.map(styleToHtml)}
  </head>
  <body${attrsToHtml(bodyAttrs)}>${body}${scripts?.map(scriptToHtml)}</body>
</html>`

function isViewportMeta<T extends MetaAttrs>(
  attrs: T,
): attrs is T & { name: 'viewport' } {
  return 'name' in attrs && attrs.name === 'viewport'
}

function linkToHtml(attrs: LinkAttrs) {
  return html`<link${attrsToHtml(attrs)} />`
}

function metaToHtml(attrs: MetaAttrs) {
  return html`<meta${attrsToHtml(attrs)} />`
}

function* attrsToHtml(attrs?: Attrs) {
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      if (value == null) continue
      else if (value === false) continue
      else if (value === true) yield html` ${name}`
      else yield html` ${name}="${value}"`
    }
  }
}

function linkPreload(asset: AssetRef) {
  const [path] = asset.url.split('?', 2)

  if (path.endsWith('.js')) {
    return html`<link rel="modulepreload" href="${asset.url}" />`
  }

  if (path.endsWith('.css')) {
    return html`<link rel="preload" href="${asset.url}" as="style" />`
  }

  return undefined
}

function scriptToHtml(script?: Html | AssetRef): Html | undefined {
  if (script == null) return undefined
  return script instanceof Html
    ? // prettier-ignore
      html`<script>${script}</script>` // hash validity requires no space around the content
    : html`<script type="module" src="${script.url}"></script>`
}

function styleToHtml(style?: Html | AssetRef): Html | undefined {
  if (style == null) return undefined
  return style instanceof Html
    ? // prettier-ignore
      html`<style>${style}</style>` // hash validity requires no space around the content
    : html`<link rel="stylesheet" href="${style.url}" />`
}
