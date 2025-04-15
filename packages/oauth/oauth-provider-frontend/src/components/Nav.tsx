import { useLingui } from '@lingui/react/macro'
import { AccountSelector } from '#/components/AccountSelector'
import { Link } from '#/components/Link'
import { useCustomizationData } from '#/data/useCustomizationData'

export function Nav() {
  const { t } = useLingui()
  const { logo, name } = useCustomizationData()

  return (
    <>
      <nav className="bg-contrast-0 dark:bg-contrast-25 border-contrast-100 h-15 fixed inset-x-0 top-0 flex items-center justify-between border-b px-4 md:px-6">
        {logo ? (
          <Link to="/account">
            <div style={{ width: 120, height: 30 }}>
              <img
                src={logo}
                alt={name || t`Logo`}
                className="h-full w-full object-contain object-left"
              />
            </div>
          </Link>
        ) : (
          <div />
        )}

        <AccountSelector />
      </nav>
      {/* Spacer */}
      <div className="h-15" />
    </>
  )
}
