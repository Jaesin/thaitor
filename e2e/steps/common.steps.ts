import { Given, When, Then } from '@cucumber/cucumber';
import { expect, type Locator } from '@playwright/test';
import type { ThaitorWorld } from '../support/world.js';

// Friendly screen name -> hash route.
const ROUTES: Record<string, string> = {
  today: '/',
  home: '/',
  translate: '/translate',
  play: '/play',
  deck: '/deck',
  phrasebook: '/deck',
  settings: '/settings',
  join: '/join',
  'tone trace': '/trace',
  trace: '/trace',
};

function routeFor(name: string): string {
  const key = name.trim().toLowerCase();
  const route = ROUTES[key];
  if (!route) throw new Error(`Unknown screen "${name}". Known: ${Object.keys(ROUTES).join(', ')}`);
  return route;
}

// Resolve a clickable thing by accessible name, falling back to plain text.
function clickable(world: ThaitorWorld, name: string): Locator {
  const page = world.page;
  return page
    .getByRole('button', { name, exact: false })
    .or(page.getByRole('link', { name, exact: false }))
    .or(page.getByRole('tab', { name, exact: false }))
    .or(page.getByRole('switch', { name, exact: false }))
    .first();
}

Given('I open the app', async function (this: ThaitorWorld) {
  await this.goto('/');
});

Given('I am on the {string} screen', async function (this: ThaitorWorld, screen: string) {
  await this.goto(routeFor(screen));
});

When('I navigate to the {string} screen', async function (this: ThaitorWorld, screen: string) {
  await this.goto(routeFor(screen));
});

When('I tap the {string} tab', async function (this: ThaitorWorld, label: string) {
  await this.page.getByRole('link', { name: label, exact: false }).first().click();
});

When('I tap {string}', async function (this: ThaitorWorld, name: string) {
  await clickable(this, name).click();
});

When('I wait for the result', async function (this: ThaitorWorld) {
  await this.page.waitForLoadState('networkidle');
});

Then('I should see {string}', async function (this: ThaitorWorld, text: string) {
  await expect(this.page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
});

Then('I should not see {string}', async function (this: ThaitorWorld, text: string) {
  await expect(this.page.getByText(text, { exact: false }).first()).toBeHidden();
});

Then('the heading should be {string}', async function (this: ThaitorWorld, text: string) {
  await expect(
    this.page.getByRole('heading', { name: text, exact: false }).first(),
  ).toBeVisible();
});

Then('I should be on the {string} route', async function (this: ThaitorWorld, screen: string) {
  const expected = routeFor(screen);
  await expect
    .poll(async () => new URL(this.page.url()).hash, { timeout: 5_000 })
    .toContain(expected === '/' ? '#/' : `#${expected}`);
});

Then('I should see a {string} button', async function (this: ThaitorWorld, name: string) {
  await expect(this.page.getByRole('button', { name, exact: false }).first()).toBeVisible();
});

Then('I should see a {string} link', async function (this: ThaitorWorld, name: string) {
  await expect(this.page.getByRole('link', { name, exact: false }).first()).toBeVisible();
});
