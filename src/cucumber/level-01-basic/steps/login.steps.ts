import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../support/world';

// The feature uses a few phrasings for the same action, so the bodies are shared
// rather than repeated per expression. Cucumber matches an expression against the
// whole step text, so these must not carry stray leading or trailing spaces.
async function loginAs(this: CustomWorld, username: string, password: string): Promise<void> {
    await this.loginPage.loginAs(username, password);
}

async function expectLoginError(this: CustomWorld, fragment: string): Promise<void> {
    await expect(this.page.locator('[data-test="error"]')).toContainText(fragment);
}

Given('I am on TTACart Login page', async function (this: CustomWorld) {
    await this.loginPage.open();
});

When('I am a {string} with password {string}', loginAs);
When('I login as {string} with password {string}', loginAs);
When('I login as {string} with {string}', loginAs);

Then('I should land on products page', async function (this: CustomWorld) {
    await this.inventoryPage.assertLoaded();
});

Then('I should see the login error as {string}', expectLoginError);
Then('I should see login error containing {string}', expectLoginError);
