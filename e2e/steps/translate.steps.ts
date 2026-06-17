import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { ThaitorWorld } from '../support/world.js';

function inputBox(world: ThaitorWorld) {
  // aria-label is either 'English text to translate' or 'Thai text to look up'.
  return world.page.getByRole('textbox').first();
}

When('I type {string} into the translation box', async function (this: ThaitorWorld, text: string) {
  await inputBox(this).fill(text);
});

When('I submit the translation', async function (this: ThaitorWorld) {
  await this.page
    .getByRole('button', { name: /Translate|Look up/, exact: false })
    .first()
    .click();
});

Then('the translation result should appear', async function (this: ThaitorWorld) {
  // The empty-state placeholder is replaced by the result panel actions.
  await expect(
    this.page.getByRole('button', { name: /Save phrase|Remove from saved/ }).first(),
  ).toBeVisible({ timeout: 10_000 });
});

Then('the result panel should be empty', async function (this: ThaitorWorld) {
  await expect(this.page.getByText('Translation will appear here').first()).toBeVisible();
});

Then('the result should contain Thai script', async function (this: ThaitorWorld) {
  const card = this.page.getByRole('region', { name: 'Translation result' }).first();
  await expect
    .poll(async () => (await card.innerText()).match(/[฀-๿]/) ? 'thai' : 'none', {
      timeout: 15_000,
    })
    .toBe('thai');
});
