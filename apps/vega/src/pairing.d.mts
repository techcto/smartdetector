export function pairingUrl(origin: string, code: string): string;
export function qrRuns(value: string): {
  size: number;
  rows: { start: number; length: number }[][];
};
