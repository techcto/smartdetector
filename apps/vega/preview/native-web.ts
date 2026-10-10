export {
  AppState,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native-web";
// React Native Web does not implement TV hardware Back. Escape emulates it.
export const BackHandler = {
  addEventListener(_event: string, callback: () => boolean) {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && callback()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", listener);
    return { remove: () => window.removeEventListener("keydown", listener) };
  },
};
