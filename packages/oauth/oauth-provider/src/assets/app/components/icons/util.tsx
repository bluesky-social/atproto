import type { SVGProps } from 'react'

export const makeSvgComponent = (path: string) =>
  function (
    props: Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children' | 'xmlns'>,
  ) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d={path}
        ></path>
      </svg>
    )
  }
