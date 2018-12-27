'use strict';

require('dotenv').config();

const launchChrome = require('@serverless-chrome/lambda');
const CDP = require('chrome-remote-interface');
const puppeteer = require('puppeteer');
const AWS = require('aws-sdk');

module.exports.crawling = async (event, context) => {
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

    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SEECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    const s3 = new AWS.S3();
    const response = await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: `${Date.now()}.html`,
      ContentType: 'text/html',
      Body: html
    }).promise();

    console.log({
      result: 'OK',
      s3response: response
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
