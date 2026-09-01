import { chromium, expect, test } from '@playwright/test';

import { prisma } from '@/lib/prisma';
import { LoginPage } from '../support/fixtures';
import { team, user } from '../support/helper';

const newHire = {
  employeeName: 'Maya Chen',
  employeeEmail: 'maya.newhire@example.com',
  jobTitle: 'Product Designer',
  startDate: '2026-10-05',
  workLocation: 'London',
  timeZone: 'Europe/London',
  role: 'MEMBER',
  equipmentPackage: 'DESIGN',
};

test('launches a new hire atomically and promotes readiness when the invite is accepted', async ({
  page,
}) => {
  const ownerLogin = new LoginPage(page);
  await ownerLogin.goto();
  await ownerLogin.credentialLogin(user.email, user.password);
  await ownerLogin.loggedInCheck(team.slug);

  const result = await page.evaluate(
    async ({ slug, payload }) => {
      const response = await fetch(`/api/v1/teams/${slug}/new-hire-launches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'playwright-new-hire-launch',
        },
        body: JSON.stringify(payload),
      });
      return { status: response.status, body: await response.json() };
    },
    { slug: team.slug, payload: newHire }
  );

  expect(result.status).toBe(201);
  expect(result.body.data).toMatchObject({
    status: 'READY',
    authenticated: true,
    newHire: { name: newHire.employeeName, role: 'MEMBER' },
    invitation: { status: 'PENDING' },
    equipment: { package: 'DESIGN', status: 'PENDING' },
  });

  await page.goto(`/teams/${team.slug}/members`);
  await expect(
    page.getByRole('heading', { name: 'New-hire readiness' })
  ).toBeVisible();
  await expect(page.getByText(newHire.employeeName)).toBeVisible();
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();

  const launch = await prisma.newHireLaunch.findUniqueOrThrow({
    where: {
      teamId_employeeEmail: {
        teamId: result.body.data.team.id,
        employeeEmail: newHire.employeeEmail,
      },
    },
    include: { invitation: true },
  });
  const inviteeBrowser = await chromium.launch();
  const inviteePage = await inviteeBrowser.newPage();
  const inviteeLogin = new LoginPage(inviteePage);
  await inviteeLogin.gotoInviteLink(
    `${process.env.APP_URL}/invitations/${launch.invitation?.token}`,
    team.name
  );
  await inviteeLogin.createNewAccountViaInvite(
    newHire.employeeName,
    'maya-password-123'
  );
  await inviteeLogin.credentialLogin(
    newHire.employeeEmail,
    'maya-password-123'
  );
  await inviteeLogin.invitationAcceptPromptVisible(team.name);
  await inviteeLogin.acceptInvitation();
  await inviteeBrowser.close();

  await page.reload();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();

  const activated = await prisma.newHireLaunch.findUniqueOrThrow({
    where: { id: launch.id },
    include: { equipmentRequest: { include: { requester: true } } },
  });
  expect(activated.status).toBe('ACTIVE');
  expect(activated.activatedAt).not.toBeNull();
  expect(activated.equipmentRequest?.requester.email).toBe(
    newHire.employeeEmail
  );

  // This scenario runs before the legacy members suite in the serial CI project.
  // Remove its demo person so those tests retain their isolated member counts.
  await prisma.newHireLaunch.delete({ where: { id: launch.id } });
  await prisma.user.delete({ where: { email: newHire.employeeEmail } });
});
