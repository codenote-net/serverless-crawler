'use strict';

require('dotenv').config();

const launchChrome = require('@serverless-chrome/lambda');
const CDP = require('chrome-remote-interface');
const puppeteer = require('puppeteer');

module.exports.hello = async (event, context) => {
  let slsChrome = null;
  let browser = null;
  let page = null;

  try {
    // launch serverless-chrome
    slsChrome = await launchChrome();

    // puppeteer connects to serverless-chrome via Web Socket
    browser = await puppeteer.connect({
      ignoreHTTPSErrors: true,
      browserWSEndpoint: (await CDP.Version()).webSocketDebuggerUrl
    });

    page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);

    await page.setJavaScriptEnabled(false);
    await page.goto(
      process.env.SCRAPE_URL, {
        waitUntil: 'networkidle2'
      }
    );

    // get the entire document HTML
    const html = await page.evaluate(() => {
      return document.getElementsByTagName('html')[0].innerHTML
    });

    console.log({
      result: 'OK',
      html: html
    });
  } catch (err) {
    console.error(err);
    console.log({
      result: 'NG'
    });
  } finally {
    if (page) {
      await page.close();
    }

    if (browser) {
      await browser.disconnect();
    }

    if (slsChrome) {
      await slsChrome.kill();
    }
  }
};
