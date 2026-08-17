// Resolves which Postgres schema an Edge Function invocation targets, from the
// deployed function name in the request URL: a `…-dev` deployment → the `dev`
// schema, anything else → `public`. This lets ONE shared handler back both the
// prod (`<name>`) and dev (`<name>-dev`) deployments, so the two never drift.
// See the dev/prod schema split — the app appends `-dev` in dev builds via
// utils/supabase.ts `edgeFn()`, and dev cron hits the `-dev` URLs.
export const schemaFromRequest = (req: Request): "dev" | "public" => {
  const name = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  return name.endsWith("-dev") ? "dev" : "public";
};
