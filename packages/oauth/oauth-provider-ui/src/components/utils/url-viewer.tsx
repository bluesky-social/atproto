import { JSX, useMemo } from 'react'
import { Override } from '../../lib/util.ts'

export type UrlPartRenderingOptions = {
  faded?: boolean
  bold?: boolean
}

export type UrlRendererProps = {
  url: string | URL
  proto?: boolean | UrlPartRenderingOptions
  host?: boolean | UrlPartRenderingOptions
  path?: boolean | UrlPartRenderingOptions
  query?: boolean | UrlPartRenderingOptions
  hash?: boolean | UrlPartRenderingOptions
  as?: string
}

export function UrlViewer<As extends keyof JSX.IntrinsicElements = 'span'>({
  url,
  proto = false,
  host = true,
  path = false,
  query = false,
  hash = false,
  as: As = 'span',

  // Element
  ...props
}: Override<JSX.IntrinsicElements[As], UrlRendererProps>) {
  const urlObj = useMemo(() => (url instanceof URL ? url : new URL(url)), [url])

  return (
    <As {...props}>
      {proto && (
        <UrlPartViewer
          value={`${urlObj.protocol}//`}
          {...(proto === true ? null : proto)}
        />
      )}
      {host && (
        <UrlPartViewer
          value={urlObj.host}
          {...(host === true ? { faded: false, bold: true } : host)}
        />
      )}
      {path && (
        <UrlPartViewer
          value={urlObj.pathname}
          {...(path === true ? null : path)}
        />
      )}
      {query && (
        <UrlPartViewer
          value={urlObj.search}
          {...(query === true ? null : query)}
        />
      )}
      {hash && (
        <UrlPartViewer value={urlObj.hash} {...(hash === true ? null : hash)} />
      )}
    </As>
  )
}

function UrlPartViewer({
  value,
  faded = true,
  bold = false,
}: { value: string } & UrlPartRenderingOptions) {
  const Comp = bold ? 'b' : 'span'
  return <Comp className={faded ? 'opacity-50' : ''}>{value}</Comp>
}
