import { chromium } from 'playwright';

async function test(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const failed = [];

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    failed.push(`${request.url()} -> ${request.failure()?.errorText ?? 'failed'}`);
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const playButton = page.locator('#play-btn');
  if (await playButton.isVisible()) {
    await playButton.click();
  }

  await page.waitForTimeout(1500);

  const score = await page.locator('#score').textContent();
  const canvasBox = await page.locator('#game-canvas').boundingBox();

  console.log(`URL: ${url}`);
  console.log(`Canvas visible: ${canvasBox !== null}`);
  console.log(`Score after play click: ${score}`);
  console.log(`Failed requests: ${failed.length ? failed.join('\n  ') : '(none)'}`);
  console.log(`Errors: ${errors.length ? errors.join('\n  ') : '(none)'}`);
  console.log('---');

  await browser.close();
}

await test('https://zencodergames.github.io/Classics_MsPacman/');
await test('https://zencodergames.github.io/Classics_MsPacman/docs/');
