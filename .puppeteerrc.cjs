const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to a directory inside our project on the F drive.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
