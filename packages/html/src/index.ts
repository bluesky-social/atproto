import {
  HtmlValue,
  cssEscaper,
  htmlEscaper,
  javascriptEscaper,
  jsonEscaper,
} from './escapers.js'
import { Html } from './html.js'

export { Html }

/**
 * Escapes code to use as a JavaScript string inside a `<script>` tag.
 */
export const javascriptCode = (code: string) =>
  Html.dangerouslyCreate(javascriptEscaper(code))

/**
 * Escapes a value to be used as a JSON string inside a `<script>` tag.
 *
 * @see {@link https://redux.js.org/usage/server-rendering#security-considerations}
 */
export const jsonCode = (value: unknown) =>
  Html.dangerouslyCreate(jsonEscaper(value))

/**
 * Escapes a value to be uses as CSS styles inside a `<style>` tag.
 */
export const cssCode = (code: string) =>
  Html.dangerouslyCreate(cssEscaper(code))

export { type HtmlValue }
export const html = (tpl: TemplateStringsArray, ...val: readonly HtmlValue[]) =>
  Html.dangerouslyCreate(htmlEscaper(tpl, val))
