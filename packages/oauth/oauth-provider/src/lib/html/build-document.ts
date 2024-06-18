import { HtmlValue } from './escapers.js'
import { Html } from './html.js'
import { html } from './tags.js'

export type AssetRef = {
  url: string
  sha256: string
}

export type Attrs = Record<string, boolean | string | undefined>
export type LinkAttrs = { href: string } & Attrs
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
  head?: HtmlValue
  title?: HtmlValue
  scripts?: readonly (Html | AssetRef)[]
  styles?: readonly (Html | AssetRef)[]
  body: HtmlValue
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
    ${links?.map(linkToHtml)}
    ${head} ${styles?.map(styleToHtml)}
  </head>
  <body${attrsToHtml(bodyAttrs)}>
    ${body} ${scripts?.map(scriptToHtml)}
  </body>
</html>`

function isViewportMeta<T extends MetaAttrs>(
  attrs: T,
): attrs is T & { name: 'viewport' } {
  return 'name' in attrs && attrs.name === 'viewport'
}

function* linkToHtml(attrs: LinkAttrs) {
  yield html`<link${attrsToHtml(attrs)} />`
}

function* metaToHtml(attrs: MetaAttrs) {
  yield html`<meta${attrsToHtml(attrs)} />`
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

function* scriptToHtml(script: Html | AssetRef) {
  yield script instanceof Html
    ? // prettier-ignore
      html`<script>${script}</script>` // hash validity requires no space around the content
    : html`<script type="module" src="${script.url}?${script.sha256}"></script>`
}

function* styleToHtml(style: Html | AssetRef) {
  yield style instanceof Html
    ? // prettier-ignore
      html`<style>${style}</style>` // hash validity requires no space around the content
    : html`<link rel="stylesheet" href="${style.url}?${style.sha256}" />`
}
