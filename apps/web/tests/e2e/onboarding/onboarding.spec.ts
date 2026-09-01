import { expect, test } from '@playwright/test';

const blueprint = {
  businessName: 'Conversational Demo Co',
  teamSize: '11-50',
  timeZone: 'America/Los_Angeles',
  primaryGoal: 'BOTH',
  vacationAllowanceDays: 20,
  sickAllowanceDays: 10,
  personalAllowanceDays: 3,
};

test('carries a public blueprint through signup into an authenticated workspace receipt', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'tiv_onboarding_blueprint',
      value: encodeURIComponent(JSON.stringify(blueprint)),
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ]);

  await page.goto('/auth/join?callbackUrl=%2Fonboarding');
  const company = page.locator('input[name="team"]');
  await expect(company).toHaveValue(blueprint.businessName);
  await expect(company).toHaveAttribute('readonly', '');
  await expect(
    page.getByText('Loaded from the workspace blueprint you created with Mark.')
  ).toBeVisible();

  await page.getByPlaceholder('Your Name').fill('Onboarding Owner');
  await page.locator('input[name="email"]').fill('onboarding@example.com');
  await page.getByPlaceholder('Password').fill('password');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await page.waitForURL('/onboarding');
  await expect(
    page.getByRole('heading', {
      name: `Finish setting up ${blueprint.businessName}`,
    })
  ).toBeVisible();
  await expect(page.getByText('Confirmation required')).toBeVisible();

  const result = await page.evaluate(async (payload) => {
    const response = await fetch('/api/v1/onboarding/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'playwright-onboarding-demo',
      },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  }, blueprint);

  expect(result.status).toBe(200);
  expect(result.body.data).toMatchObject({
    status: 'READY',
    authenticated: true,
    team: { name: blueprint.businessName },
  });

  await page.reload();
  await expect(
    page.getByRole('heading', { name: `${blueprint.businessName} is ready` })
  ).toBeVisible();
  await expect(page.getByText('Workspace ready')).toBeVisible();
  await expect(page.getByText('20 days')).toBeVisible();
  await expect(page.getByText('10 days')).toBeVisible();
  await expect(page.getByText('3 days')).toBeVisible();
});
