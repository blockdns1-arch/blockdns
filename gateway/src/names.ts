export const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

export type HostParse =
  | { kind: "domain"; name: string; suffix: string }
  | { kind: "apex" }
  | { kind: "unsupported" };

export function parseHost(hostHeader: string, suffixes: string[]): HostParse {
  const host = (hostHeader || "").split(":")[0].trim().toLowerCase();
  if (!host) return { kind: "unsupported" };

  for (const suffix of suffixes) {
    if (host === suffix.slice(1)) return { kind: "apex" };

    if (host.endsWith(suffix)) {
      const name = host.slice(0, host.length - suffix.length);
      if (name.length > 0 && !name.includes(".")) {
        if (isValidName(name)) {
          return { kind: "domain", name, suffix };
        }
        return { kind: "unsupported" };
      }
      return { kind: "apex" };
    }
  }

  return { kind: "unsupported" };
}