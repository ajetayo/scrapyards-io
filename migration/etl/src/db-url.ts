// Resolve the connection string for the staging schema.
//
// Order of precedence:
//   1. DATABASE_URL_STAGING — preferred; isolates the load entirely.
//   2. DATABASE_URL — fallback to the Replit dev DB; we still write only into
//      the `scrapyards_staging` schema, never `public`. Logged loudly so it's
//      obvious in CI/output where the load went.
//
// Anything that doesn't look like a postgres URL is rejected so we don't try to
// connect to gibberish (the platform's secrets UI has been seen to store hex
// tokens by mistake).
export function resolveStagingUrl(): string | null {
  const candidates: Array<[string, string | undefined]> = [
    ["DATABASE_URL_STAGING", process.env.DATABASE_URL_STAGING],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ];
  for (const [name, val] of candidates) {
    if (!val) continue;
    if (!/^postgres(ql)?:\/\//i.test(val)) {
      console.warn(`[db-url] ${name} is set but does not look like a postgres URL — ignoring`);
      continue;
    }
    if (name === "DATABASE_URL") {
      if (process.env.ALLOW_DATABASE_URL_FALLBACK !== "1") {
        console.error(
          `[db-url] DATABASE_URL_STAGING is missing or invalid and ALLOW_DATABASE_URL_FALLBACK is not "1".\n` +
            `  Refusing to fall back to DATABASE_URL automatically.\n` +
            `  Either provide a valid postgres:// URL in DATABASE_URL_STAGING, or\n` +
            `  set ALLOW_DATABASE_URL_FALLBACK=1 to acknowledge writing to the dev DB\n` +
            `  (the load is still confined to the scrapyards_staging schema).`
        );
        return null;
      }
      console.warn(`[db-url] WARNING: falling back to DATABASE_URL (ALLOW_DATABASE_URL_FALLBACK=1) — writing ONLY to scrapyards_staging schema; public is untouched.`);
    } else {
      console.log(`[db-url] using ${name}`);
    }
    return val;
  }
  return null;
}
