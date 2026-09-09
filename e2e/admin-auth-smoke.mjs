/**
 * Wasty Admin (Amplify Next.js) production smoke — auth lock + health.
 *
 * Usage:
 *   npm run e2e:admin
 *   ADMIN_BASE_URL=https://main.dnbgx54tr52ki.amplifyapp.com npm run e2e:admin
 */

const BASE = (process.env.ADMIN_BASE_URL || "https://main.dnbgx54tr52ki.amplifyapp.com").replace(/\/+$/, "");

let passed = 0;
let failed = 0;

function ok(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function fetchFollow(path, init = {}) {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...init,
    headers: {
      ...(init.headers || {}),
    },
  });
}

async function main() {
  console.log(`\nWasty Admin E2E → ${BASE}\n`);

  {
    const res = await fetch(`${BASE}/api/health`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    ok("health responds", res.status === 200 || res.status === 503, `status=${res.status}`);
    ok("health has ok field", typeof json.ok === "boolean");
    ok(
      "health does not leak authBypassEnabled in prod payload",
      json.authBypassEnabled === undefined,
      JSON.stringify(json),
    );
    ok(
      "health does not leak misconfig array in prod payload",
      json.misconfig === undefined,
      JSON.stringify(json),
    );
  }

  {
    const res = await fetchFollow("/dashboard");
    const loc = res.headers.get("location") || "";
    const redirected =
      res.status === 307 || res.status === 302 || res.status === 303 || res.status === 308;
    ok("unauthenticated /dashboard redirects", redirected, `status=${res.status}`);
    ok(
      "redirect targets login",
      /auth.*login|\/login/i.test(loc) || loc.includes("auth"),
      `location=${loc}`,
    );
  }

  {
    const res = await fetchFollow("/dashboard/analytics", {
      headers: {
        Cookie: "wasty_admin_session=dev:owner; wasty_admin_type=owner",
      },
    });
    const loc = res.headers.get("location") || "";
    const redirected =
      res.status === 307 || res.status === 302 || res.status === 303 || res.status === 308;
    ok(
      "forged cookie still blocked from /dashboard/analytics",
      redirected && /auth|login/i.test(loc),
      `status=${res.status} location=${loc}`,
    );
  }

  {
    const res = await fetch(`${BASE}/auth/v2/login`, { redirect: "follow" });
    const text = await res.text();
    ok("login page loads", res.status === 200, `status=${res.status}`);
    ok("login page has sign-in copy", /sign in|wasty/i.test(text));
    ok("login page does not show demo role bypass in prod HTML", !/demo role|switch role/i.test(text));
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
