import React, { useMemo, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { pairingUrl, qrRuns } from "./pairing.mjs";
export default function Pairing({
  origin,
  code,
  expiresAt,
  mobile,
  compact,
}: {
  origin: string;
  code: string;
  expiresAt: number;
  mobile: boolean;
  compact: boolean;
}) {
  const link = pairingUrl(origin, code),
    matrix = useMemo(() => qrRuns(link), [link]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000)),
    module = Math.max(3, Math.floor((compact ? 196 : 260) / (matrix.size + 8))),
    size = (matrix.size + 8) * module;
  return (
    <View
      style={{
        flexDirection: mobile ? "column" : "row",
        alignItems: "center",
        gap: mobile ? 16 : 36,
      }}
    >
      <View
        accessibilityRole="image"
        accessibilityLabel="Scan this QR code to connect your TV"
        style={{
          width: size,
          height: size,
          backgroundColor: "#fff",
          padding: module * 4,
          flexShrink: 0,
        }}
      >
        {matrix.rows.map((runs, y) => (
          <View key={y} style={{ height: module, width: matrix.size * module }}>
            {runs.map((run) => (
              <View
                key={run.start}
                style={{
                  position: "absolute",
                  left: run.start * module,
                  width: run.length * module,
                  height: module,
                  backgroundColor: "#000",
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flex: mobile ? undefined : 1, gap: compact ? 8 : 16 }}>
        <Text style={styles.heading}>Scan to connect this TV</Text>
        <Text style={styles.text}>1. Scan with your phone’s camera.</Text>
        <Text style={styles.text}>2. Sign in and choose your location.</Text>
        <Text style={styles.text}>3. Confirm this code and approve.</Text>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.small}>
          Or visit {origin}/tv/connect and enter the code.
        </Text>
        {origin.startsWith("http:") && (
          <Text style={styles.small}>
            Local testing: approve on this computer. Phones need a reachable
            HTTPS service.
          </Text>
        )}
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          Waiting for approval · {Math.floor(seconds / 60)}:
          {String(seconds % 60).padStart(2, "0")} remaining
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: "700", color: "#142e48" },
  text: { fontSize: 18, lineHeight: 25, color: "#24465e" },
  code: { fontSize: 34, letterSpacing: 3, fontWeight: "700", color: "#007bb9" },
  small: { fontSize: 15, lineHeight: 21, color: "#597188" },
  status: { fontSize: 16, color: "#005e99" },
});
