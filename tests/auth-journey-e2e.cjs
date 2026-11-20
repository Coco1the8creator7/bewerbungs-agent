// Exercise account UI states at mobile width without sending real email.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto("https://localhost:8443/account/register");
  assert.equal(await page.locator("input").count(), 3);
  assert.equal(
    await page.locator("#password").getAttribute("autocomplete"),
    "new-password",
  );
  await page.locator("#first_name").fill("Lia");
  await page.locator("#email").fill("lia@example.com");
  await page.locator("#password").fill("short");
  await page
    .getByRole("button", { name: "Kostenloses Konto erstellen", exact: true })
    .click();
  assert.match(await page.locator("#password-error").innerText(), /12 Zeichen/);
  await page
    .getByRole("button", { name: "Passwort anzeigen", exact: true })
    .click();
  assert.equal(await page.locator("#password").getAttribute("type"), "text");
  await page.locator("#password").fill("synthetic journey password");
  let payload;
  await page.route("**/api/auth/register", async (r) => {
    payload = r.request().postDataJSON();
    await r.fulfill({
      json: {
        message:
          "Falls eine Registrierung möglich ist, erhältst du eine E-Mail.",
      },
    });
  });
  await page
    .getByRole("button", { name: "Kostenloses Konto erstellen", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Schau kurz in dein Postfach." })
    .waitFor();
  assert.deepEqual(Object.keys(payload).sort(), [
    "email",
    "first_name",
    "password",
  ]);
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await page.route("**/api/auth/verify-email/resend", (r) =>
    r.fulfill({
      json: {
        message:
          "Falls eine Bestätigung aussteht, erhältst du einen neuen Link.",
      },
    }),
  );
  await page
    .getByRole("button", {
      name: "Bestätigungslink erneut anfordern",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Erneut anfordern in/ }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: /Erneut anfordern in/ })
      .isDisabled(),
    true,
  );
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({
      json: { next: "waiting", email: "lia@example.com", email_verified: true },
    }),
  );
  await page.goto("https://localhost:8443/account/waiting");
  await page
    .getByRole("heading", { name: "E-Mail bestätigt. Fast geschafft." })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Bestätigungslink/ }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Status aktualisieren", exact: true })
    .click();
  await page.getByText(/Die Freischaltung ist noch ausstehend/).waitFor();
  await page.goto("https://localhost:8443/account/verify");
  await page
    .getByRole("button", {
      name: "Neuen Bestätigungslink anfordern",
      exact: true,
    })
    .click();
  await page.getByLabel("E-Mail-Adresse", { exact: true }).waitFor();
  await page.goto("https://localhost:8443/account/reset");
  await page.route("**/api/auth/password-reset/request", (r) =>
    r.fulfill({
      json: {
        message: "Falls die Adresse existiert, erhältst du eine E-Mail.",
      },
    }),
  );
  await page
    .getByLabel("E-Mail-Adresse", { exact: true })
    .fill("lia@example.com");
  await page
    .getByRole("button", { name: "Link anfordern", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Prüfe dein E-Mail-Postfach." })
    .waitFor();
  assert.match(await page.locator("#content").innerText(), /30 Minuten/);
  await page.goto("https://localhost:8443/account/login");
  await page.route("**/api/auth/login", (r) =>
    r.fulfill({ status: 401, json: { detail: "E-Mail oder Passwort falsch" } }),
  );
  await page.locator("#email").fill("lia@example.com");
  await page.locator("#password").fill("synthetic password");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator("#email").inputValue(), "lia@example.com");
  assert.match(
    await page.getByRole("alert").innerText(),
    /E-Mail oder Passwort/,
  );
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Account journey: mobile registration, field errors, password visibility, confirmation, waiting status, broken link and reset passed",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
