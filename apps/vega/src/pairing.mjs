import qrcode from "qrcode-generator";
import { serviceOrigin } from "./client.mjs";
export function pairingUrl(origin, code) {
  if (!/^[A-F0-9]{5}-[A-F0-9]{5}$/.test(code))
    throw Error("Invalid pairing code");
  return serviceOrigin(origin) + "/tv/connect?code=" + encodeURIComponent(code);
}
// Encode locally: only the public user code goes into QR, never device/access tokens.
export function qrRuns(value) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const size = qr.getModuleCount();
  return {
    size,
    rows: Array.from({ length: size }, (_, y) => {
      const runs = [];
      let start = -1;
      for (let x = 0; x <= size; x++) {
        const dark = x < size && qr.isDark(y, x);
        if (dark && start < 0) start = x;
        if (!dark && start >= 0) {
          runs.push({ start, length: x - start });
          start = -1;
        }
      }
      return runs;
    }),
  };
}
