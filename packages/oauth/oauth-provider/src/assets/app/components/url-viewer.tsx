import { Component, HTMLAttributes, useMemo } from 'react'

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
  as?: keyof JSX.IntrinsicElements
}

export function UrlViewer({
  url,
  proto = false,
  host = true,
  path = false,
  query = false,
  hash = false,
  as: As = 'span',
  ...attrs
}: UrlRendererProps & HTMLAttributes<Element>) {
  const urlObj = useMemo(() => new URL(url), [url])

  return (
    <Component as={As} {...attrs}>
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
    </Component>
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
