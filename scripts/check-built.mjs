import { firefox, chromium } from "@playwright/test";
for (const type of [firefox, chromium]) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage();
    const urls = [];
    const errors = [];
    page.on("request", (r) => urls.push(r.url()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4173/");
    await page.locator('[data-do="modes"]').click();
    await page.locator('[data-do="new:classic"]').click();
    await page.locator('[data-do="random"]').click();
    await page.locator('[data-do="ready"]').click();
    await page.locator(".fire-control").waitFor();
    if (errors.length || urls.some((url) => url.includes(".json")))
      throw Error(JSON.stringify({ errors, urls }));
    console.log(
      `${type.name()}: built menu and battle OK, no standalone JSON requests or JavaScript errors`,
    );
  } finally {
    await browser.close();
  }
}
