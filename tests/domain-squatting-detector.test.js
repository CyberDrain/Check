import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainSquattingDetector } from "../scripts/modules/domain-squatting-detector.js";

async function detector(runtimeConfig) {
  const d = new DomainSquattingDetector();
  await d.initialize(
    { domain_squatting: { protected_domains: [] } },
    { domainSquatting: { enabled: true, ...runtimeConfig.domainSquatting }, urlAllowlist: runtimeConfig.urlAllowlist }
  );
  return d;
}

test("short or unrelated names are not flagged", async () => {
  const d = await detector({ urlAllowlist: ["https://box.com/*", "https://bbc.co.uk/*", "https://www.om.nl/*"] });
  for (const host of ["dropbox.com", "boxing.com", "nbc.com", "abc.com", "www.home-academy.nl"]) {
    assert.equal(d.checkDomain(host), null, host);
  }
});

test("real lookalikes are still flagged", async () => {
  const d = await detector({ urlAllowlist: ["https://box.com/*", "microsoft.com", "paypal.com"] });
  for (const host of ["secure-box.com", "microsoftlogin.com", "microsoft365-login.com", "microsfot.com", "micrsoft.com", "paypal-secure.com"]) {
    assert.equal(d.checkDomain(host)?.detected, true, host);
  }
});

test("protectedDomains replaces the allowlist as the squatting target list", async () => {
  const d = await detector({
    domainSquatting: { protectedDomains: ["contoso.com"] },
    urlAllowlist: ["https://box.com/*", "paypal.com"],
  });
  assert.deepEqual(d.protectedDomains, ["contoso.com"]);
  assert.equal(d.checkDomain("secure-box.com"), null);
  assert.equal(d.checkDomain("contosso.com")?.detected, true);
});

test("allowlisted hosts and their subdomains are never flagged", async () => {
  const d = await detector({
    domainSquatting: { protectedDomains: ["salesforce.com"] },
    urlAllowlist: ["https://client.my.salesforce-setup.com/"],
  });
  assert.equal(d.checkDomain("client.my.salesforce-setup.com"), null);
  assert.equal(d.checkDomain("eu.client.my.salesforce-setup.com"), null);
  assert.equal(d.checkDomain("other.salesforce-setup.com")?.detected, true);
});

test("wildcard allowlist patterns are read as domains", async () => {
  const d = await detector({ urlAllowlist: ["https://*.contoso.com/*", "*.fabrikam.com"] });
  assert.deepEqual(d.allowlistHosts, ["contoso.com", "fabrikam.com"]);
  assert.equal(d.checkDomain("login.contoso.com"), null);
  assert.equal(d.checkDomain("contosso.com")?.detected, true);
});

test("a brand's own glued names are not flagged", async () => {
  const d = await detector({ domainSquatting: { protectedDomains: ["google.com"] } });
  for (const host of ["lh3.googleusercontent.com", "www.googleadservices.com"]) {
    assert.equal(d.checkDomain(host), null, host);
  }
  assert.equal(d.checkDomain("googlelogin.com")?.detected, true);
  assert.equal(d.checkDomain("google-ads.com")?.detected, true);
});
