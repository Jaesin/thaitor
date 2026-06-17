import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { ThaitorWorld } from '../support/world.js';

When('I set my display name to {string}', async function (this: ThaitorWorld, name: string) {
  await this.page.getByPlaceholder('Your name').fill(name);
});

When('I save my display name', async function (this: ThaitorWorld) {
  // The "Save" next to the name field.
  await this.page.getByRole('button', { name: 'Save', exact: true }).first().click();
});

Then('I should see the saved confirmation', async function (this: ThaitorWorld) {
  await expect(this.page.getByText('Saved ✓')).toBeVisible();
});

When('I select the {string} theme', async function (this: ThaitorWorld, theme: string) {
  const group = this.page.getByRole('group', { name: 'Theme' });
  await group.getByRole('button', { name: theme, exact: false }).first().click();
});

When('I select the {string} default voice', async function (this: ThaitorWorld, label: string) {
  const group = this.page.getByRole('group', { name: 'Default voice' });
  await group.getByRole('button', { name: label, exact: false }).first().click();
});

Then('the {string} default voice should be selected', async function (this: ThaitorWorld, label: string) {
  const group = this.page.getByRole('group', { name: 'Default voice' });
  await expect(group.getByRole('button', { name: label, exact: false }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
