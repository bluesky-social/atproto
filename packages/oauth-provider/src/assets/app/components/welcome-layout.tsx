import { PropsWithChildren } from 'react'

export type WelcomeLayoutProps = {
  name?: string
  logo?: string
  links?: Array<{
    name: string
    href: string
    rel?: string
  }>
  logoAlt?: string
}

export function WelcomeLayout({
  name,
  logo,
  logoAlt = name || 'Logo',
  links,
  children,
}: PropsWithChildren<WelcomeLayoutProps>) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center flex-col bg-white text-black dark:bg-black dark:text-white">
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
        <nav className="w-full max-w-screen-sm overflow-hidden mt-4 border-t border-t-slate-200 flex flex-wrap justify-center">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              rel={link.rel}
              target="_blank"
              className="m-2 md:m-4 text-xs md:text-sm text-primary hover:underline"
            >
              {link.name}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}
