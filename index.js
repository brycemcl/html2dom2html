#!/usr/bin/env node
const path = require('path')
const fs = require('fs').promises
const glob = require('glob')
const puppeteer = require('puppeteer')
const prettier = require('prettier')
const args = process.argv.slice(2)

const writeDom = async (filePath) => {
  console.log('Working on: ', filePath)
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.goto(`file:${filePath}`, {
      waitUntil: 'networkidle0',
    })
    const rawDom = await page.evaluate(() => {
      if (document.doctype) {
        return (
          new XMLSerializer().serializeToString(document.doctype) +
          '\n' +
          document.querySelector('*').outerHTML
        )
      } else {
        return document.querySelector('*').outerHTML
      }
    })
    await fs.writeFile(filePath, rawDom, 'utf8')
    const dom = prettier.format(rawDom, { parser: 'html' })
    await fs.writeFile(filePath, dom, 'utf8')
  } catch (err) {
    console.log(filePath)
    console.error(err)
  } finally {
    await browser.close()
  }
}

const fileGlob = args[0] || '/**/*.html'
const pathJoin = path.join(process.cwd(), fileGlob)
console.log('Searching for: ', pathJoin)
glob(pathJoin, {}, (err, files) => {
  if (err) {
    console.log(err)
  } else {
    ;(async () => {
      for (const file of files) {
        await writeDom(file)
      }
    })()
  }
})
