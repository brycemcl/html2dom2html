#!/usr/bin/env node
const path = require('path')
const fs = require('fs').promises
const glob = require('glob')
const puppeteer = require('puppeteer')
const prettier = require('prettier')
const posthtml = require('posthtml')
const args = process.argv.slice(2)
const express = require('express')
const app = express()
app.use('/', express.static(process.cwd()))
const server = app.listen(0, () => {})
const port = server.address().port
const writeDom = async (filePath) => {
  console.log('Working on: ', filePath)
  let noError = true
  let rawDom
  let postDom
  let dom
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(false)
    page.on('response', async (response) => {
      if (
        Number(response.status().toString()[0]) === 3 ||
        Number(response.status().toString()[0]) === 4
      ) {
        noError = false
      }
    })
    await page.goto(
      `http://localhost:${port}${encodeURI(
        filePath.slice(process.cwd().length),
      )}`,
      {
        waitUntil: 'networkidle0',
      },
    )
    rawDom = await page.evaluate(() => {
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
    browser.close()
    if (noError) {
      postDom = posthtml().process(rawDom, { sync: true }).html
      dom = prettier.format(postDom, { parser: 'html' })
    }
  } catch (err) {
    console.log(filePath)
    console.error(err)
    browser.close()
  } finally {
    if (dom) {
      await fs.writeFile(filePath, dom, 'utf8')
    } else if (postDom) {
      await fs.writeFile(filePath, postDom, 'utf8')
    } else if (rawDom) {
      await fs.writeFile(filePath, rawDom, 'utf8')
    }
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
      server.close()
    })()
  }
})
