import { PropsWithChildren } from 'react'

export type LayoutWelcomeProps = {
  name?: string
  logo?: string
  links?: Array<{
    title: string
    href: string
    rel?: string
  }>
  logoAlt?: string
}

export function LayoutWelcome({
  name,
  logo,
  logoAlt = name || 'Logo',
  links,
  children,
}: PropsWithChildren<LayoutWelcomeProps>) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="w-full max-w-screen-sm overflow-hidden flex-grow flex flex-col items-center justify-center">
        {logo && (
          <img
            src={logo}
            alt={logoAlt}
            className="w-16 h-16 md:w-24 md:h-24 mb-8"
          />
        )}

        {name && (
          <h1 className="text-2xl md:text-4xl mb-8 mx-4 text-center font-bold">
            {name}
          </h1>
        )}

        {children}
      </div>

      {links != null && links.length > 0 && (
        <nav className="w-full max-w-screen-sm overflow-hidden mt-4 border-t border-t-slate-200 dark:border-t-slate-700 flex flex-wrap justify-center">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              rel={link.rel}
              target="_blank"
              className="m-2 md:m-4 text-xs md:text-sm text-primary hover:underline"
            >
              {link.title}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}
