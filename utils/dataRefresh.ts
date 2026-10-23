/** In-memory change counters: navigating back is not itself a data change. */
export type DataTopic =
  "groups" | "groupDetails" | "settlements" | "contacts" | "recurring";

const revisions = new Map<DataTopic, number>();

export function invalidateData(...topics: readonly DataTopic[]) {
  for (const topic of topics)
    revisions.set(topic, (revisions.get(topic) ?? 0) + 1);
}

export function dataRevision(...topics: readonly DataTopic[]) {
  return topics.map((topic) => revisions.get(topic) ?? 0).join(":");
}

/** Preserve each service's contract and invalidate only after a write succeeds. */
export function withDataInvalidation<T extends object>(
  service: T,
  mutations: Partial<Record<keyof T, readonly DataTopic[]>>
): T {
  const wrapped = { ...service };
  for (const key of Object.keys(mutations) as (keyof T)[]) {
    const action = service[key];
    if (typeof action !== "function") continue;
    wrapped[key] = (async (...args: unknown[]) => {
      const result = await action(...args);
      invalidateData(...mutations[key]!);
      return result;
    }) as T[keyof T];
  }
  return wrapped;
}

/** Coalesce concurrent loads and remember which revision a mounted view holds.
 * Capture the revision before loading so changes during a request aren't lost. */
export function createRefreshGate() {
  const loaded = new Map<string, string>();
  const pending = new Map<
    string,
    { revision: string; promise: Promise<void> }
  >();
  const run = (
    key: string,
    revision: string,
    load: () => Promise<unknown>,
    force = false
  ): Promise<void> => {
    const current = pending.get(key);
    if (current) {
      return current.revision === revision
        ? current.promise
        : current.promise.then(() => run(key, revision, load, force));
    }
    if (!force && loaded.get(key) === revision) return Promise.resolve();
    const promise = load()
      .then(() => {
        loaded.set(key, revision);
      })
      .finally(() => {
        if (pending.get(key)?.promise === promise) pending.delete(key);
      });
    pending.set(key, { revision, promise });
    return promise;
  };
  return { run };
}
