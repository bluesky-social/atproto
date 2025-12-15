import assert from 'node:assert'
import { type Browser, type Page } from 'puppeteer'

export class PageHelper implements AsyncDisposable {
  constructor(protected readonly page: Page) {}

  async goto(url: string) {
    await this.page.goto(url)
  }

  async waitForNetworkIdle() {
    await this.page.waitForNetworkIdle()
  }

  async navigationAction(run: () => Promise<unknown>): Promise<void> {
    const promise = this.page.waitForNavigation()
    await run()
    await promise
    await this.waitForNetworkIdle()
  }

  async checkTitle(expected: string) {
    await this.waitForNetworkIdle()
    await expect(this.page.title()).resolves.toBe(expected)
  }

  async clickOn(selector: string) {
    const elementHandle = await this.getVisibleElement(selector)
    await elementHandle.click()
    return elementHandle
  }

  async clickOnButton(text: string) {
    return this.clickOn(`button::-p-text(${text})`)
  }

  async typeIn(selector: string, text: string) {
    const elementHandle = await this.getVisibleElement(selector)
    elementHandle.focus()
    await elementHandle.type(text)
    return elementHandle
  }

  async typeInInput(name: string, text: string) {
    return this.typeIn(`input[name="${name}"]`, text)
  }

  async ensureTextVisibility(text: string, tag = 'p') {
    await this.page.waitForSelector(`${tag}::-p-text(${text})`)
  }

  protected async getVisibleElement(selector: string) {
    const elementHandle = await this.page.waitForSelector(selector)

    expect(elementHandle).not.toBeNull()
    assert(elementHandle)

    await expect(elementHandle.isVisible()).resolves.toBe(true)

    return elementHandle
  }

  async [Symbol.asyncDispose]() {
    return this.page.close()
  }

  static async from(browser: Browser) {
    const page = await browser.newPage()
    return new PageHelper(page)
  }
}
