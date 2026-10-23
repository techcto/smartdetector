export async function nativeMessaging(operation, timeoutMs = 12000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('timeout')), timeoutMs); }),
    ]);
  } catch {
    throw Error('Amazon messaging is unavailable on this device. Background alerts remain off. In-app alerts still work; try again on a supported Fire TV with Amazon messaging enabled.');
  } finally { clearTimeout(timer); }
}
export function refreshSummary(devices, events, now = new Date()) {
  return `Updated ${now.toLocaleTimeString()}: ${devices} devices, ${events} events. Refreshes automatically every 5 seconds while open.`;
}
