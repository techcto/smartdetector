import React from 'react';
import { View, useWindowDimensions, type ViewProps } from 'react-native';

// Vega RN 0.72 uses physical pixels. Keep one logical TV coordinate system
// for styles, focus geometry and scrolling, regardless of HDMI resolution.
function useTvViewport() {
  // The notification task runs in a separate process; this process has one
  // interactive surface, so the standard window hook describes this TV screen.
  const metrics = useWindowDimensions();
  const width = metrics.width > 0 ? metrics.width : 960;
  const height = metrics.height > 0 ? metrics.height : 540;
  const scale = Math.min(width / 960, height / 540);
  return { width, height, scale };
}

export function useViewportDimensions() {
  const { width, height, scale } = useTvViewport();
  return { width: width / scale, height: height / scale };
}

export function Viewport({ children, style, ...props }: ViewProps) {
  const { width, height, scale } = useTvViewport();
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <View {...props} style={[style, {
        flex: 0,
        width: width / scale,
        height: height / scale,
        transform: [{ scale }],
      }]}>
        {children}
      </View>
    </View>
  );
}
