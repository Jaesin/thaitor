import { Given, When } from '@cucumber/cucumber';
import { BASE_URL } from '../support/server.js';
import type { ThaitorWorld } from '../support/world.js';

Given('I open a join link with token {string}', async function (this: ThaitorWorld, token: string) {
  await this.page.goto(`${BASE_URL}/#/join?key=${encodeURIComponent(token)}`, {
    waitUntil: 'domcontentloaded',
  });
});

When('I submit the join form', async function (this: ThaitorWorld) {
  await this.page.getByRole('button', { name: /Join Thaitor|Joining/ }).first().click();
});
