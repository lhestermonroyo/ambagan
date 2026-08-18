/**
 * Version comparison for the update gate.
 *
 * Deliberately NOT semver: the strings being compared are what the stores
 * actually carry — `CFBundleShortVersionString` on iOS and `versionName` on
 * Android — which are dotted numeric strings with no prerelease or build
 * metadata. Pulling in a semver library to parse "1.4.0" would add a dependency
 * to handle grammar this app never emits.
 *
 * The one rule that matters: compare NUMERICALLY, segment by segment. String
 * comparison puts "1.10.0" below "1.9.0", which would silently stop prompting
 * at exactly the point the version numbers get interesting.
 */

/** Missing segments read as 0, so "1.5" and "1.5.0" compare equal. */
const toSegments = (version: string): number[] =>
  version
    .trim()
    .split(".")
    .map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });

/**
 * -1 if `a` is older than `b`, 1 if newer, 0 if equivalent.
 *
 * Garbage in either argument degrades to 0-segments rather than throwing — a
 * malformed version must never crash the launch path, and "equal" is the safe
 * reading because it prompts nobody.
 */
export const compareVersions = (a: string, b: string): number => {
  const left = toSegments(a);
  const right = toSegments(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l < r ? -1 : 1;
  }

  return 0;
};

/** True when `version` is strictly older than `target`. */
export const isOlderThan = (version: string, target: string): boolean =>
  compareVersions(version, target) < 0;
