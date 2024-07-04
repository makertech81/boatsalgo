const puppeteer = require('puppeteer');
const cv = require('opencv-wasm');

class GeeTestIdentifier {
  constructor(debuggerMode = false) {
    this.debuggerMode = debuggerMode;
    this.browser = null;
  }

  async launchBrowser() {
    this.browser = await puppeteer.launch({ headless: false }); // Launch browser in headful mode for debugging
  }

  async solveCaptcha() {
    if (!this.browser) {
      throw new Error('Browser instance not initialized');
    }

    const page = await this.browser.newPage();

    try {
      await page.goto('https://www.boats.com/boats-for-sale/?condition=all-in-stock');

      // Wait for the iframe containing captcha to appear
      const frameSelector = 'iframe';
      await page.waitForSelector(frameSelector);
      const frameElement = await page.$(frameSelector);
      const frame = await frameElement.contentFrame();

      if (!frame) {
        throw new Error('Failed to find captcha iframe');
      }

      // Wait for the captcha puzzle canvas elements to appear
      const puzzleCanvasSelector = '#captcha__puzzle canvas';
      await frame.waitForSelector(puzzleCanvasSelector);
      const canvasElements = await frame.$$(puzzleCanvasSelector);

      if (canvasElements.length < 2) {
        throw new Error('Failed to fetch puzzle images');
      }

      // Fetch imageData from each canvas
      const puzzleImages = await Promise.all(canvasElements.map(async (canvas) => {
        const imageData = await frame.evaluate((canvas) => {
          const ctx = canvas.getContext('2d');
          return ctx.getImageData(0, 0, canvas.width, canvas.height);
        }, canvas);

        return imageData;
      }));

      // Process the images
      const backgroundImgData = puzzleImages[0];
      const puzzleImgData = puzzleImages[1];

      const backgroundMat = this.imageDataToMat(backgroundImgData);
      const puzzleMat = this.imageDataToMat(puzzleImgData);

      const result = this.findPuzzlePiecePosition(backgroundMat, puzzleMat);

      console.log(`Result: ${JSON.stringify(result, null, 2)}`);

      // Optionally, interact with the captcha challenge here

    } catch (err) {
      console.error('Error:', err);
    } finally {
    //   await page.close();
    }
  }

  imageDataToMat(imageData) {
	const mat = cv.matFromImageData(imageData);
    return mat;
  }

  findPuzzlePiecePosition(backgroundMat, puzzleMat) {
    // Implement your OpenCV processing logic here
    // This example assumes template matching for simplicity
    const edgeBackground = new cv.Mat();
    const edgePuzzlePiece = new cv.Mat();

    cv.cvtColor(backgroundMat, edgeBackground, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(puzzleMat, edgePuzzlePiece, cv.COLOR_RGBA2GRAY);

    cv.Canny(edgeBackground, edgeBackground, 100, 200);
    cv.Canny(edgePuzzlePiece, edgePuzzlePiece, 100, 200);

    const res = new cv.Mat();
    cv.matchTemplate(edgeBackground, edgePuzzlePiece, res, cv.TM_CCOEFF_NORMED);

    const { minVal, maxVal, minLoc, maxLoc } = cv.minMaxLoc(res);

    const topLeft = maxLoc;
    const { width: w, height: h } = edgePuzzlePiece.size();
    const bottomRight = new cv.Point(topLeft.x + w, topLeft.y + h);

    const center_x = topLeft.x + Math.floor(w / 2);
    const center_y = topLeft.y + Math.floor(h / 2);

    if (this.debuggerMode) {
      cv.imwrite('input.png', backgroundMat);
      cv.rectangle(backgroundMat, topLeft, bottomRight, new cv.Vec(0, 0, 255), 2);
      cv.line(backgroundMat, new cv.Point(center_x, 0), new cv.Point(center_x, backgroundMat.rows), new cv.Vec(0, 255, 0), 2);
      cv.line(backgroundMat, new cv.Point(0, center_y), new cv.Point(backgroundMat.cols, center_y), new cv.Vec(0, 255, 0), 2);
      cv.imwrite('output.png', backgroundMat);
    }

    return {
      position_from_left: center_x,
      position_from_bottom: backgroundMat.rows - center_y,
      coordinates: [center_x, center_y]
    };
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const identifier = new GeeTestIdentifier();
  await identifier.launchBrowser();
  await identifier.solveCaptcha();
//   await identifier.closeBrowser();
}

main().catch(err => console.error(err));
