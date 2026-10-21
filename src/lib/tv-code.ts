// Public user code only; never use this formatter for private device/access tokens.
export function formatTvCode(value: string) {
  const raw = value.toUpperCase().replace(/[\s-]/g, "").slice(0, 10);
  return raw.length > 5 ? raw.slice(0, 5) + "-" + raw.slice(5) : raw;
}
export const completeTvCode = (value: string) =>
  /^[A-F0-9]{5}-[A-F0-9]{5}$/.test(value);
