export class AccessRevoked extends Error {}
type Detection = {
  label: string;
  advisory?: boolean;
  source?: string;
  box: { x: number; y: number; width: number; height: number };
};
type Incident = {
  id: string;
  deviceId: string;
  at: string;
  summary: string;
  state: string;
  thumbnail?: string;
  frames?: { at_ms: number; preview: string; detections?: Detection[] }[];
  notify?: boolean;
};
type Device = {
  id: string;
  name: string;
  status: string;
  liveView?: boolean;
  platform?: string;
  providerKey?: string;
};
export function serviceOrigin(value: string): string;
export function safePreview(value: unknown): string | undefined;
export function displayDevices<T extends Device>(devices: T[]): T[];
export function eventsForDevice<T extends { deviceId: string }>(
  events: T[],
  id: string,
): T[];
export function newAlert<T extends { id: string; notify?: boolean }>(
  previous: Set<string> | null,
  events: T[],
): T | undefined;
export function createClient(
  origin: string,
  fetcher?: typeof fetch,
): {
  begin(
    signal?: AbortSignal,
  ): Promise<{
    userCode: string;
    deviceCode: string;
    expiresAt: number;
    interval: number;
  }>;
  poll(
    deviceCode: string,
    signal?: AbortSignal,
  ): Promise<{ token?: string; error?: string }>;
  feed(
    token: string,
    signal?: AbortSignal,
  ): Promise<{ updatedAt: string; devices: Device[]; incidents: Incident[] }>;
  search(
    token: string,
    query: string,
    deviceId?: string,
    signal?: AbortSignal,
  ): Promise<{ items: Incident[]; matched: number; truncated?: boolean }>;
};
