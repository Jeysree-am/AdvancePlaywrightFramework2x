import { After, AfterStep, Before } from "@cucumber/cucumber";
import { chromium } from "@playwright/test";
import { BASE_URL, type CustomWorld } from "./world";

// HEADED=1 (set by the cucumber:* npm scripts through cross-env) opens a visible
// browser. Anything else — including CI=true — runs headless, which is the same
// convention playwright.config.ts uses for the Playwright suite.
const HEADED = process.env.HEADED === "1";

// Same switch the Playwright suite uses (src/utils/visualStep.ts): when it is on,
// every step is captured and ttaFormatter writes the images into the TTA report.
const ATTACH_SCREENSHOTS = process.env.ATTACH_SCREENSHOTS?.toLowerCase() === "true";

Before(async function (this: CustomWorld) {
    this.browser = await chromium.launch({ headless: !HEADED });
    this.context = await this.browser.newContext({ baseURL: BASE_URL });
    this.page = await this.context.newPage();
    this.initPages();
});

AfterStep(async function (this: CustomWorld) {
    // `page` is unset when the browser never launched (a failing Before hook).
    if (!ATTACH_SCREENSHOTS || !this.page) return;
    await this.attach(await this.page.screenshot(), "image/png");
});

After(async function (this: CustomWorld) {
    await this.context?.close();
    await this.browser?.close();
});
