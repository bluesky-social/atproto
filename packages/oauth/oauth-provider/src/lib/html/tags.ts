import {
  HtmlValue,
  cssEscaper,
  htmlEscaper,
  javascriptEscaper,
  jsonEscaper,
} from './escapers.js'
import { Html } from './html.js'

export { type HtmlValue }
export const html = (
  tpl: TemplateStringsArray,
  ...val: readonly HtmlValue[]
) =>
  tpl.length === 1 && val.length === 0
    ? // Optimization for static HTML, avoid creating an iterable
      Html.dangerouslyCreate(tpl)
    : Html.dangerouslyCreate(htmlEscaper(tpl, val))

/**
 * Escapes code to use as a JavaScript string inside a `<script>` tag.
 */
export const javascriptCode = (code: string) =>
  Html.dangerouslyCreate(javascriptEscaper(code))

/**
 * Creates an HTML safe JavaScript code block, with JSON serialization of the
 * injected variables.
 *
 * @example
 * ```js
 * const dataOnTheServer = { foo: 'bar' };
 * const clientScript = js`
 *   const data = ${dataOnTheServer};
 *   console.log(data);
 * `
 * console.log(clientScript.toString()); // Output: 'const data = {"foo":"bar"};console.log(data);'
 * ```
 */
export const js = (tpl: TemplateStringsArray, ...val: readonly unknown[]) =>
  tpl.length === 1 && val.length === 0
    ? // Optimization for static JavaScript, avoid un-necessary serialization
      javascriptCode(tpl[0])
    : javascriptCode(String.raw({ raw: tpl }, ...val.map(jsonCode)))

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
export const cssCode = (code?: string) =>
  code ? Html.dangerouslyCreate(cssEscaper(code)) : undefined
