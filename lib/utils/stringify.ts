export function stringifyAny(value: any, fallback = "") {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") {
    if ("message" in value && typeof (value as any).message === "string") {
      return (value as any).message;
    }
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  }
  return String(value);
}
