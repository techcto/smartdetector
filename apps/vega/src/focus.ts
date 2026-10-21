import { findNodeHandle, type View } from "react-native";
import { FocusManager } from "@amazon-devices/react-native-kepler";
// Vega keeps no focus when the focused control unmounts with its screen; move it with the system focus manager.
export function focusView(view: View) {
  FocusManager.focus(findNodeHandle(view));
}
