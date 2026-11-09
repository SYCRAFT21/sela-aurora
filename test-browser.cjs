const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/brave-browser",
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  await page.goto("http://127.0.0.1:3000", {
    waitUntil: "domcontentloaded",
  });

  await page.screenshot({
    path: "unified-mail-test.png",
    fullPage: true,
  });

  console.log("Screenshot berhasil dibuat!");

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});