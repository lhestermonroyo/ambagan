type GroupActivity = {
  id: string;
  created_at: string;
  last_updated_at?: string | null;
  mode?: string;
};

const timestamp = (value: string | null | undefined): number => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Older offline snapshots have no activity timestamp; use their creation date. */
export function compareGroupsByActivity(a: GroupActivity, b: GroupActivity): number {
  const activity = (group: GroupActivity) =>
    Math.max(timestamp(group.last_updated_at), timestamp(group.created_at));

  return (
    activity(b) - activity(a) ||
    timestamp(b.created_at) - timestamp(a.created_at) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
    ((a.mode ?? "group") < (b.mode ?? "group") ? -1 : (a.mode ?? "group") > (b.mode ?? "group") ? 1 : 0)
  );
}

/** Copy before sorting so cached/state arrays are never mutated in place. */
export function sortGroupsByActivity<T extends GroupActivity>(groups: T[]): T[] {
  return [...groups].sort(compareGroupsByActivity);
}
