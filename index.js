const puppeteer = require('puppeteer');

const Jimp = require('jimp');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });

  const page = await browser.newPage();
  await page.goto('https://www.boats.com/boats-for-sale/?condition=all-in-stock');
  const elementHandle = await page.waitForSelector('iframe');
const frame = await elementHandle.contentFrame();
  await frame.waitForSelector('[id="captcha__puzzle"]');

  const images = await getCaptchaImages(frame);

    images.captcha.write("./captcha.png");
    images.puzzle.write("./puzzle.png");
})();

async function getCaptchaImages(page) {
    
    const images = await page.$$eval(
      'canvas',
      (canvases) => {
        return canvases.map((canvas) => {
          // This will get the base64 image data from the
          // html canvas. The replace function simply strip
          // the "data:image" prefix.
          return canvas
            .toDataURL()
            .replace(/^data:image\/png;base64,/, '')
        })
      }
    );
  
    // // For each base64 string create a Javascript buffer.
    const buffers = images.map((img) => Buffer.from(img, 'base64'));
    
  
    // And read each buffer into a Jimp image.
    return {
      captcha: await Jimp.read(buffers[0]),
      puzzle: await Jimp.read(buffers[1]),
    };
  
  }