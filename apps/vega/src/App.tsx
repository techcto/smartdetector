import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { refreshSummary } from "./settings-feedback.mjs";
import {
  AppState,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AccessRevoked,
  createClient,
  displayDevices,
  eventsForDevice,
  externalLink,
  newAlert,
  safePreview,
  type ExternalPage,
} from "./client.mjs";
import { SERVICE_ORIGIN } from "./config";
import { browserVoiceAvailable, startBrowserVoice } from "./voice";
import { focusView } from "./focus";
import { brandMark } from "./brand";
import { Viewport, useViewportDimensions } from "./viewport";
import {
  backgroundAlertsAvailable,
  configureBackgroundAlerts,
} from "./notifications";
import Pairing from "./PairingScreen";
type Box = {
  label: string;
  advisory?: boolean;
  source?: string;
  box: { x: number; y: number; width: number; height: number };
};
type Frame = { at_ms: number; preview: string; detections?: Box[] };
type Event = {
  id: string;
  deviceId: string;
  at: string;
  summary: string;
  state: string;
  thumbnail?: string;
  frames?: Frame[];
  notify?: boolean;
};
type Device = { id: string; name: string; status: string; liveView?: boolean };
type Feed = { updatedAt: string; devices: Device[]; incidents: Event[] };
type Pair = {
  userCode: string;
  deviceCode: string;
  expiresAt: number;
  interval: number;
};
function Action({
  children,
  onPress,
  disabled = false,
  preferred = false,
  onFocused,
  navigation = false,
  selected = false,
  label,
  focusRef,
  onLayout,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  preferred?: boolean;
  onFocused?: () => void;
  navigation?: boolean;
  selected?: boolean;
  label?: string;
  focusRef?: React.Ref<View>;
  onLayout?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={focusRef}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled,
        selected: navigation ? selected : undefined,
      }}
      disabled={disabled}
      hasTVPreferredFocus={preferred}
      onFocus={() => {
        setFocused(true);
        onFocused?.();
      }}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[
        s.button,
        navigation && s.navButton,
        selected && s.navSelected,
        focused && s.focus,
        disabled && s.disabled,
      ]}
    >
      <Text style={s.buttonText}>{children}</Text>
    </Pressable>
  );
}
function MediaCard({
  children,
  width,
  label,
  onPress,
  onFocused,
}: {
  children: React.ReactNode;
  width: number;
  label: string;
  onPress: () => void;
  onFocused: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocused();
      }}
      onBlur={() => setFocused(false)}
      style={[s.card, { width }, focused && s.focus]}
    >
      {children}
    </Pressable>
  );
}
function Evidence({
  image,
  detections = [],
  large = false,
}: {
  image?: string;
  detections?: Box[];
  large?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 }),
    [ratio, setRatio] = useState(16 / 9),
    uri = safePreview(image);
  const width = Math.min(size.width, size.height * ratio),
    height = width / ratio;
  return (
    <View
      style={[s.evidence, large && { height: 240 }]}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {uri ? (
        <>
          <Image
            source={{ uri }}
            resizeMode="contain"
            style={StyleSheet.absoluteFill}
            onLoad={(e) => {
              const v = e.nativeEvent.source;
              if (v?.width && v?.height) setRatio(v.width / v.height);
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width,
              height,
              left: (size.width - width) / 2,
              top: (size.height - height) / 2,
            }}
          >
            {detections
              .slice(0, 20)
              .filter(
                (d) =>
                  d.box &&
                  [d.box.x, d.box.y, d.box.width, d.box.height].every(
                    Number.isFinite
                  ) &&
                  d.box.x >= 0 &&
                  d.box.y >= 0 &&
                  d.box.width > 0 &&
                  d.box.height > 0 &&
                  d.box.x + d.box.width <= 1.001 &&
                  d.box.y + d.box.height <= 1.001
              )
              .map((d, i) => (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: d.box.x * width,
                    top: d.box.y * height,
                    width: d.box.width * width,
                    height: d.box.height * height,
                    borderWidth: 2,
                    borderColor:
                      d.advisory || d.source === "bedrock"
                        ? "#b07500"
                        : "#078355",
                  }}
                >
                  <Text style={s.boxLabel}>
                    {d.label}
                    {d.advisory || d.source === "bedrock" ? " · AI" : ""}
                  </Text>
                </View>
              ))}
          </View>
        </>
      ) : (
        <Text style={s.muted}>No retained image</Text>
      )}
    </View>
  );
}
export function App() {
  const searchInput = useRef<TextInput>(null);
  const stopVoice = useRef<(() => void) | null>(null);
  const [voiceNote, setVoiceNote] = useState("");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        stopVoice.current?.();
        stopVoice.current = null;
      }
    });
    return () => {
      stopVoice.current?.();
      subscription.remove();
    };
  }, []);
  const { width: screenWidth, height: screenHeight } = useViewportDimensions();
  const compact = screenHeight < 750;
  const [section, setSection] = useState<"devices" | "events" | "search">(
    "devices"
  );
  const cameraRail = useRef<ScrollView>(null),
    eventRail = useRef<ScrollView>(null),
    frameRail = useRef<ScrollView>(null),
    bodyScroll = useRef<ScrollView>(null);
  const cameraY = useRef(0),
    eventY = useRef(0);
  const mobile = screenWidth < 700;
  const cardWidth = mobile
    ? Math.min(340, screenWidth - 32)
    : Math.min(248, Math.floor((screenWidth - 40) / 4.3));
  const client = useMemo(() => createClient(SERVICE_ORIGIN), []);
  // Display tokens and evidence are memory-only; restarting requires pairing again.
  const [token, setToken] = useState(""),
    [pair, setPair] = useState<Pair | null>(null),
    [feed, setFeed] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshEpoch, setRefreshEpoch] = useState(0),
    [refreshStatus, setRefreshStatus] = useState(""),
    [deviceId, setDeviceId] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [frame, setFrame] = useState(0),
    [query, setQuery] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [results, setResults] = useState<Event[] | null>(null),
    [searchNote, setSearchNote] = useState(""),
    [notice, setNotice] = useState<Event | null>(null),
    [alerts, setAlerts] = useState(true),
    [backgroundAlerts, setBackgroundAlerts] = useState(false),
    [notificationBusy, setNotificationBusy] = useState(false),
    [notificationStatus, setNotificationStatus] = useState(""),
    [settingsOpen, setSettingsOpen] = useState(false),
    [disconnectPrompt, setDisconnectPrompt] = useState(false),
    [link, setLink] = useState<ReturnType<typeof externalLink> | null>(null);
  useEffect(() => {
    bodyScroll.current?.scrollTo({ y: 0, animated: false });
  }, [
    section,
    selectedId,
    deviceId,
    settingsOpen,
    disconnectPrompt,
    submitted,
  ]);
  const seen = useRef<Set<string> | null>(null),
    epoch = useRef(0),
    controllers = useRef(new Set<AbortController>()),
    active = useRef(AppState.currentState === "active"),
    allowAlerts = useRef(alerts);
  allowAlerts.current = alerts;
  // Vega keeps no focus when the focused control unmounts with its screen, so each
  // screen change names the control to focus. FocusManager moves it once that control's
  // native view exists: immediately if it is already laid out, otherwise on its layout.
  const focusNext = useRef<React.RefObject<View | null> | null>(null),
    returnTo = useRef<React.RefObject<View | null> | null>(null),
    linkBack = useRef<View>(null),
    settingsBack = useRef<View>(null),
    settingsButton = useRef<View>(null),
    pairingButton = useRef<View>(null),
    liveButton = useRef<View>(null),
    devicesButton = useRef<View>(null),
    ringButton = useRef<View>(null),
    laidOut = useRef(new WeakSet<View>());
  useEffect(() => {
    const target = focusNext.current?.current;
    if (!target || !laidOut.current.has(target)) return;
    focusNext.current = null;
    focusView(target);
  });
  function land(ref: React.RefObject<View | null>) {
    return () => {
      const view = ref.current;
      if (!view) return;
      laidOut.current.add(view);
      if (focusNext.current !== ref) return;
      focusNext.current = null;
      focusView(view);
    };
  }
  function controller() {
    const c = new AbortController();
    controllers.current.add(c);
    return c;
  }
  const reset = useCallback(() => {
    stopVoice.current?.();
    stopVoice.current = null;
    setVoiceNote("");
    epoch.current++;
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setToken("");
    setPair(null);
    setFeed(null);
    setRefreshStatus("");
    setSelectedId("");
    setDeviceId("");
    setResults(null);
    setQuery("");
    setSubmitted("");
    setSearchNote("");
    setNotice(null);
    setBackgroundAlerts(false);
    setNotificationStatus("");
    setSettingsOpen(false);
    setDisconnectPrompt(false);
    setLink(null);
    setBusy(false);
    seen.current = null;
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      active.current = state === "active";
      if (!active.current) {
        controllers.current.forEach((c) => c.abort());
        setNotice(null);
      }
    });
    return () => {
      sub.remove();
      epoch.current++;
      controllers.current.forEach((c) => c.abort());
    };
  }, []);
  const back = useCallback(() => {
    if (link) {
      focusNext.current = returnTo.current;
      returnTo.current = null;
      setLink(null);
      return true;
    }
    if (disconnectPrompt) {
      setDisconnectPrompt(false);
      return true;
    }
    if (settingsOpen) {
      focusNext.current = settingsButton;
      setSettingsOpen(false);
      return true;
    }
    if (selectedId) {
      setSelectedId("");
      setFrame(0);
      return true;
    }
    if (submitted) {
      setSubmitted("");
      setResults(null);
      return true;
    }
    if (deviceId) {
      setDeviceId("");
      setQuery("");
      return true;
    }
    if (section !== "devices") {
      setSection("devices");
      return true;
    }
    return false;
  }, [
    link,
    section,
    selectedId,
    deviceId,
    submitted,
    disconnectPrompt,
    settingsOpen,
  ]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", back);
    return () => sub.remove();
  }, [back]);
  async function begin() {
    const generation = ++epoch.current,
      c = controller();
    setBusy(true);
    setError("");
    try {
      const p = await client.begin(c.signal);
      if (generation !== epoch.current || c.signal.aborted) return;
      if (
        typeof p.userCode !== "string" ||
        !/^[A-F0-9]{5}-[A-F0-9]{5}$/.test(p.userCode) ||
        typeof p.deviceCode !== "string" ||
        !Number.isFinite(p.expiresAt)
      )
        throw Error("Invalid pairing response");
      setPair(p);
    } catch {
      if (generation === epoch.current && !c.signal.aborted)
        setError("Pairing unavailable. Try again.");
    } finally {
      controllers.current.delete(c);
      if (generation === epoch.current) setBusy(false);
    }
  }
  const pairingStarted = useRef(false);
  useEffect(() => {
    if (!pairingStarted.current) {
      pairingStarted.current = true;
      void begin();
    }
  }, []);

  useEffect(() => {
    if (!pair || token) return;
    let disposed = false,
      running = false;
    const poll = async () => {
      if (disposed || running || !active.current) return;
      if (Date.now() >= pair.expiresAt) {
        setPair(null);
        setError("Code expired. Get a new code.");
        return;
      }
      running = true;
      const c = controller();
      try {
        const value = await client.poll(pair.deviceCode, c.signal);
        if (disposed || c.signal.aborted) return;
        if (typeof value.token === "string") {
          setToken(value.token);
          setPair(null);
          setError("");
        } else if (value.error && value.error !== "authorization_pending") {
          setPair(null);
          setError("Pairing expired or invalid. Get a new code.");
        }
      } catch {
        if (!disposed && !c.signal.aborted)
          setError("Waiting for service connection…");
      } finally {
        controllers.current.delete(c);
        running = false;
      }
    };
    const timer = setInterval(
      () => void poll(),
      Math.max(5, Math.min(30, pair.interval || 5)) * 1000
    );
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [pair, token, client]);
  useEffect(() => {
    if (!token) return;
    let disposed = false,
      running = false;
    const owned = new Set<AbortController>();
    const refresh = async () => {
      if (disposed || running || !active.current) return;
      running = true;
      const c = controller();
      owned.add(c);
      try {
        const [next, search] = await Promise.all([
          client.feed(token, c.signal),
          submitted
            ? client.search(token, submitted, deviceId, c.signal)
            : Promise.resolve(null),
        ]);
        if (disposed || c.signal.aborted) return;
        if (
          !Array.isArray(next.devices) ||
          !Array.isArray(next.incidents) ||
          (search && !Array.isArray(search.items))
        )
          throw Error("Invalid feed");
        next.devices = displayDevices(next.devices);
        next.incidents = next.incidents.slice(0, 50);
        const fresh = newAlert(seen.current, next.incidents);
        if (fresh && allowAlerts.current) {
          setNotice(fresh);
        }
        seen.current = new Set(next.incidents.map((i: Event) => i.id));
        setNotice((n) =>
          n && next.incidents.some((i: Event) => i.id === n.id) ? n : null
        );
        setFeed(next);
        setRefreshStatus(refreshSummary(next.devices.length, next.incidents.length));
        setResults(search?.items ?? null);
        setSearchNote(
          search
            ? search.matched +
                " matching events" +
                (search.truncated ? " · limited; narrow your search" : "")
            : ""
        );
        setSelectedId((id) =>
          (search?.items ?? next.incidents).some((i: Event) => i.id === id)
            ? id
            : ""
        );
        setError("");
      } catch (e) {
        if (!disposed && !c.signal.aborted) {
          setRefreshStatus("Refresh failed. Check your connection; retrying automatically.");
          setResults(null);
          setSelectedId("");
          if (e instanceof AccessRevoked) reset();
          setError(
            e instanceof AccessRevoked
              ? e.message
              : "Feed or search unavailable. Retrying automatically."
          );
        }
      } finally {
        controllers.current.delete(c);
        owned.delete(c);
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000),
      wake = AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh();
      });
    return () => {
      disposed = true;
      owned.forEach((c) => c.abort());
      clearInterval(timer);
      wake.remove();
    };
  }, [token, client, submitted, deviceId, reset, refreshEpoch]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 15000);
    return () => clearTimeout(timer);
  }, [notice]);
  const noticeImage =
    safePreview(notice?.thumbnail) ?? safePreview(notice?.frames?.[0]?.preview);
  const device = feed?.devices.find((d) => d.id === deviceId),
    events: Event[] = eventsForDevice(
      results ?? feed?.incidents ?? [],
      deviceId
    ),
    selected = events.find((i) => i.id === selectedId);
  // Vega cannot open a browser; show the address so it can be opened on a phone or computer.
  function show(
    page: ExternalPage,
    from: React.RefObject<View | null>,
    id?: string
  ) {
    returnTo.current = settingsOpen ? settingsBack : from;
    focusNext.current = linkBack;
    setLink(externalLink(SERVICE_ORIGIN, page, id));
    bodyScroll.current?.scrollTo({ y: 0, animated: false });
  }
  function open(event: Event) {
    setSelectedId(event.id);
    setFrame(0);
    setNotice(null);
  }
  return (
    <Viewport style={s.app}>
      <View
        style={[
          s.header,
          { flexWrap: "wrap" },
          mobile && { paddingHorizontal: 16, paddingVertical: 12 },
        ]}
      >
        <Image
          source={brandMark}
          accessibilityLabel="SmartDetector shield"
          style={{ width: 26, height: 26 }}
        />
        <View>
          <Text style={s.brand}>SmartDetector</Text>
        </View>
        {!!token && (
          <View
            style={[
              s.actions,
              { marginVertical: 0 },
              mobile && { width: "100%" },
            ]}
          >
            <Action
              navigation
              selected={section === "devices" && !settingsOpen}
              onPress={() => {
                setSection("devices");
                setSelectedId("");
                setDeviceId("");
                setSubmitted("");
                setResults(null);
                setQuery("");
                setSettingsOpen(false);
                setDisconnectPrompt(false);
                setLink(null);
              }}
            >
              Devices
            </Action>
            <Action
              navigation
              selected={section === "events" && !settingsOpen}
              onPress={() => {
                setSettingsOpen(false);
                setDisconnectPrompt(false);
                setSection("events");
                setDeviceId("");
                setSelectedId("");
                setSubmitted("");
              }}
            >
              History
            </Action>
            <Action
              navigation
              label="Search events"
              selected={section === "search" && !settingsOpen}
              onPress={() => {
                setSettingsOpen(false);
                setDisconnectPrompt(false);
                setSection("search");
                setDeviceId("");
                setSelectedId("");
                setSubmitted("");
              }}
            >
              Search
            </Action>
            <Action
              navigation
              focusRef={settingsButton}
              onLayout={land(settingsButton)}
              label="Console settings"
              selected={settingsOpen}
              onPress={() => {
                focusNext.current = settingsBack;
                setLink(null);
                setSettingsOpen(true);
              }}
            >
              Settings
            </Action>
            {(selectedId || deviceId || submitted) && (
              <Action
                navigation
                onPress={() => {
                  back();
                }}
              >
                ← Back
              </Action>
            )}
          </View>
        )}
      </View>
      <ScrollView
        ref={bodyScroll}
        contentContainerStyle={[
          s.body,
          !mobile && { padding: 20, paddingBottom: 16 },
          mobile && { padding: 16, paddingBottom: 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {link ? (
          <View style={s.panel}>
            <Text style={s.heading}>{link.title}</Text>
            <Text style={s.paragraph}>
              This TV can't open web pages. On your phone or computer, go to:
            </Text>
            <Text selectable style={[s.url, mobile && { fontSize: 22 }]}>
              {link.url}
            </Text>
            <Text style={s.paragraph}>{link.detail}</Text>
            <Action
              preferred
              focusRef={linkBack}
              onLayout={land(linkBack)}
              onPress={() => void back()}
            >
              ← Back
            </Action>
          </View>
        ) : !token ? (
          <View style={{ gap: 12 }}>
            {pair ? (
              <Pairing
                origin={SERVICE_ORIGIN}
                code={pair.userCode}
                expiresAt={pair.expiresAt}
                mobile={mobile}
                compact={compact}
              />
            ) : (
              <>
                <Text style={s.title}>Connect your TV</Text>
                <Text style={s.paragraph}>
                  Scan a QR code with your phone to sign in and approve this
                  display.
                </Text>
                <Action preferred disabled={busy} onPress={() => void begin()}>
                  {busy ? "Preparing your code…" : "Get pairing code"}
                </Action>
              </>
            )}
            {pair && (
              <View style={s.actions}>
                <Action
                  onPress={() => {
                    epoch.current++;
                    setPair(null);
                    setError("");
                  }}
                >
                  Cancel pairing
                </Action>
              </View>
            )}
            <Text style={s.muted}>
              Read-only display access. Your password stays on your phone.
            </Text>
          </View>
        ) : disconnectPrompt ? (
          <View style={s.panel}>
            <Text style={s.heading}>Disconnect this console?</Text>
            <Text style={s.paragraph}>
              This clears credentials and evidence from app memory. To revoke
              the server connection, use Devices → Fire TV in SmartDetector.
            </Text>
            <View style={s.actions}>
              <Action preferred onPress={() => setDisconnectPrompt(false)}>
                Keep connected
              </Action>
              <Action
                disabled={notificationBusy}
                onPress={() =>
                  void (async () => {
                    setNotificationBusy(true);
                    try {
                      if (backgroundAlerts)
                        await configureBackgroundAlerts(token, false);
                      reset();
                    } catch {
                      setNotificationStatus(
                        "Could not disable background alerts. Try again or revoke this display on the website."
                      );
                    } finally {
                      setNotificationBusy(false);
                    }
                  })()
                }
              >
                Disconnect and require pairing again
              </Action>
            </View>
            {!!notificationStatus && (
              <Text style={s.muted}>{notificationStatus}</Text>
            )}
          </View>
        ) : settingsOpen ? (
          <View style={s.panel}>
            <Text style={s.heading}>Console settings</Text>
            <View style={s.actions}>
              <Action onPress={() => setAlerts((a) => !a)}>
                In-app alerts {alerts ? "on" : "off"}
              </Action>
              <Action onPress={() => { setRefreshStatus("Refreshing devices and events…"); setRefreshEpoch((n) => n + 1); }}>
                Refresh now
              </Action>
            </View>
            {!!refreshStatus && <Text style={s.muted}>{refreshStatus}</Text>}
            {backgroundAlertsAvailable && (
              <View style={s.actions}>
                <Action
                  disabled={notificationBusy}
                  onPress={() =>
                    void (async () => {
                      setNotificationBusy(true);
                      try {
                        await configureBackgroundAlerts(
                          token,
                          !backgroundAlerts
                        );
                        setBackgroundAlerts(!backgroundAlerts);
                        setNotificationStatus(
                          backgroundAlerts
                            ? "Background alerts disabled"
                            : "Background alerts enabled until display access expires. OS settings control presentation."
                        );
                      } catch (e) {
                        setNotificationStatus(
                          e instanceof Error
                            ? e.message
                            : "Background alerts unavailable"
                        );
                      } finally {
                        setNotificationBusy(false);
                      }
                    })()
                  }
                >
                  Background TV alerts {backgroundAlerts ? "on" : "off"}
                </Action>
              </View>
            )}
            {!!notificationStatus && (
              <Text style={s.muted}>{notificationStatus}</Text>
            )}
            <View style={s.actions}>
              <Action onPress={() => show("privacy", settingsBack)}>
                Privacy policy
              </Action>
              <Action onPress={() => show("dataDeletion", settingsBack)}>
                Delete saved data
              </Action>
              <Action onPress={() => show("accountDeletion", settingsBack)}>
                Request account deletion
              </Action>
            </View>
            <View style={s.actions}>
              <Action
                preferred
                focusRef={settingsBack}
                onLayout={land(settingsBack)}
                onPress={() => void back()}
              >
                Back to console
              </Action>

              <Action onPress={() => setDisconnectPrompt(true)}>
                Disconnect this console…
              </Action>
            </View>
            <Text style={s.muted}>
              Disconnect only to pair this console again. Revoke access under
              Devices → Fire TV.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[s.title, mobile && { fontSize: 28 }]}>
              {selected
                ? "Event review"
                : device?.name ??
                  (section === "search"
                    ? submitted
                      ? "Search results"
                      : "Search saved events"
                    : section === "events"
                    ? "Recent events"
                    : "Your devices")}
            </Text>
            <Text style={s.muted}>
              {feed
                ? "Updated " + new Date(feed.updatedAt).toLocaleTimeString()
                : "Connecting…"}{" "}
              · saved activity
              {feed
                ? ` · ${feed.devices.length} camera${
                    feed.devices.length === 1 ? "" : "s"
                  } · ${feed.incidents.length} events`
                : ""}
            </Text>
            {selected ? (
              <View
                style={[
                  s.panel,
                  !mobile && { flexDirection: "row", gap: 20 },
                  mobile && { padding: 12 },
                ]}
              >
                <View style={!mobile ? { flex: 1 } : undefined}>
                  <Evidence
                    large={!mobile}
                    image={
                      selected.frames?.[frame]?.preview ?? selected.thumbnail
                    }
                    detections={selected.frames?.[frame]?.detections}
                  />
                </View>
                <View style={!mobile ? { flex: 1 } : undefined}>
                  <ScrollView
                    ref={frameRail}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.actions}
                  >
                    {selected.frames?.slice(0, 12).map((f, i) => (
                      <Action
                        key={i}
                        onFocused={() =>
                          frameRail.current?.scrollTo({
                            x: i * 82,
                            animated: true,
                          })
                        }
                        onPress={() => setFrame(i)}
                      >
                        {i === frame ? "● " : ""}
                        {(f.at_ms / 1000).toFixed(1)}s
                      </Action>
                    ))}
                  </ScrollView>
                  <Text numberOfLines={2} style={s.heading}>
                    {selected.summary}
                  </Text>
                  <Text style={s.paragraph}>
                    {selected.deviceId} ·{" "}
                    {new Date(selected.at).toLocaleString()} · {selected.state}
                  </Text>
                  <Text numberOfLines={3} style={s.muted}>
                    Sampled images, not continuous video. Green: measured
                    objects; amber: advisory AI. Not an identity or threat
                    determination.
                  </Text>
                  {!deviceId && section === "devices" && (
                    <Action
                      onPress={() => {
                        setDeviceId(selected.deviceId);
                        setSelectedId("");
                        setFrame(0);
                        setSubmitted("");
                        setResults(null);
                      }}
                    >
                      Browse this device’s events
                    </Action>
                  )}
                </View>
              </View>
            ) : (
              <>
                {device && section !== "events" && section !== "search" && (
                  <View
                    style={[
                      s.panel,
                      !mobile && { flexDirection: "row", gap: 20 },
                      mobile && { padding: 12 },
                    ]}
                  >
                    <View style={!mobile ? { flex: 1 } : undefined}>
                      <Evidence
                        large={!mobile}
                        image={
                          events[0]?.frames?.[0]?.preview ??
                          events[0]?.thumbnail
                        }
                        detections={events[0]?.frames?.[0]?.detections}
                      />
                    </View>
                    <View style={!mobile ? { flex: 1 } : undefined}>
                      <Text numberOfLines={2} style={s.heading}>
                        {events[0]?.summary ?? "Waiting for the first event"}
                      </Text>
                      <Text style={s.muted}>
                        Latest retained evidence · {device.status}
                      </Text>
                      <View style={s.actions}>
                        <Action onPress={() => setSection("events")}>
                          Device history
                        </Action>
                        {events[0] && (
                          <Action onPress={() => open(events[0])}>
                            Review latest event
                          </Action>
                        )}
                        {device.liveView && (
                          <Action
                            focusRef={liveButton}
                            onLayout={land(liveButton)}
                            onPress={() =>
                              show("liveView", liveButton, device.id)
                            }
                          >
                            Live view in web console
                          </Action>
                        )}
                      </View>
                      <Text numberOfLines={2} style={s.muted}>
                        Saved event images are shown here. Live video opens in
                        the web console.
                      </Text>
                    </View>
                  </View>
                )}
                {!deviceId && section === "devices" && (
                  <>
                    <Text style={s.heading}>Cameras</Text>
                    <ScrollView
                      ref={cameraRail}
                      onLayout={(e) => {
                        cameraY.current = e.nativeEvent.layout.y;
                      }}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.rail}
                    >
                      {feed?.devices.map((d, index) => (
                        <MediaCard
                          key={d.id}
                          width={cardWidth}
                          label="Browse device"
                          onPress={() => {
                            setDeviceId(d.id);
                            setSubmitted("");
                            setResults(null);
                            setQuery("");
                          }}
                          onFocused={() => {
                            cameraRail.current?.scrollTo({
                              x: index * (cardWidth + 16),
                              animated: true,
                            });
                            bodyScroll.current?.scrollTo({
                              y: Math.max(0, cameraY.current - 40),
                              animated: true,
                            });
                          }}
                        >
                          <Evidence
                            image={
                              feed.incidents.find((i) => i.deviceId === d.id)
                                ?.thumbnail
                            }
                          />
                          <Text numberOfLines={1} style={s.cardTitle}>
                            {d.name}
                          </Text>
                          <Text style={s.muted}>{d.status}</Text>
                        </MediaCard>
                      ))}
                    </ScrollView>
                    {feed && !feed.devices.length && (
                      <View style={s.panel}>
                        <Text style={s.heading}>Add your first device</Text>
                        <Text style={s.paragraph}>
                          No cameras are connected to this location. Open
                          Devices on your phone or browser, select this same
                          location, and connect your Ring account to discover
                          shared cameras.
                        </Text>
                        <Action
                          focusRef={devicesButton}
                          onLayout={land(devicesButton)}
                          onPress={() => show("devices", devicesButton)}
                        >
                          Add device
                        </Action>
                      </View>
                    )}
                  </>
                )}
                {section === "search" && !submitted && (
                  <View style={[s.panel, mobile && { padding: 12 }]}>
                    <TextInput
                      ref={searchInput}
                      returnKeyType="search"
                      accessibilityLabel="Search saved events"
                      value={query}
                      maxLength={400}
                      onChangeText={setQuery}
                      onSubmitEditing={() => {
                        if (query.trim()) setSubmitted(query.trim());
                      }}
                      placeholder="Show me people at my front door today"
                      placeholderTextColor="#687c90"
                      style={s.input}
                    />
                    <View style={s.actions}>
                      <Action
                        onPress={() => {
                          stopVoice.current?.();
                          stopVoice.current = null;
                          searchInput.current?.focus();
                          setVoiceNote(
                            "Use voice dictation if your TV keyboard offers it. Review the text, then select Search. Otherwise type your query."
                          );
                        }}
                      >
                        TV keyboard / voice
                      </Action>
                      {browserVoiceAvailable && (
                        <Action
                          onPress={() => {
                            stopVoice.current?.();
                            setVoiceNote(
                              "Listening for up to 15 seconds. Your browser/OS speech service may process audio."
                            );
                            try {
                              stopVoice.current = startBrowserVoice((text) => {
                                setQuery(text);
                                setSubmitted("");
                                setResults(null);
                              }, setVoiceNote);
                            } catch (error) {
                              setVoiceNote(
                                error instanceof Error
                                  ? error.message
                                  : "Voice input unavailable. Use the keyboard."
                              );
                            }
                          }}
                        >
                          Use browser mic
                        </Action>
                      )}
                      {browserVoiceAvailable && (
                        <Action
                          onPress={() => {
                            stopVoice.current?.();
                            stopVoice.current = null;
                            setVoiceNote(
                              "Microphone stopped. Review the text, then select Search."
                            );
                          }}
                        >
                          Stop microphone
                        </Action>
                      )}
                      <Action
                        disabled={!query.trim()}
                        onPress={() => setSubmitted(query.trim())}
                      >
                        Search
                      </Action>
                      <Action
                        onPress={() => {
                          stopVoice.current?.();
                          stopVoice.current = null;
                          setVoiceNote("");
                          setQuery("");
                          setSubmitted("");
                          setResults(null);
                          setSearchNote("");
                        }}
                      >
                        Clear
                      </Action>
                    </View>
                    <Text style={s.note}>
                      Use TV keyboard dictation when available. Browser speech
                      may use your OS/cloud provider; review the words before
                      Search. SmartDetector does not retain audio.
                    </Text>
                    {!!voiceNote && (
                      <Text accessibilityLiveRegion="polite" style={s.muted}>
                        {voiceNote}
                      </Text>
                    )}
                    {!!searchNote && <Text style={s.muted}>{searchNote}</Text>}
                  </View>
                )}
                {(section === "events" ||
                  !!submitted ||
                  (section === "devices" && !deviceId)) && (
                  <>
                    {section === "devices" && (
                      <Text style={s.heading}>
                        {submitted
                          ? "Search results"
                          : device
                          ? "Device history"
                          : "Recent events"}
                      </Text>
                    )}
                    {events.length > 0 && (
                      <ScrollView
                        ref={eventRail}
                        onLayout={(e) => {
                          eventY.current = e.nativeEvent.layout.y;
                        }}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.rail}
                      >
                        {events.map((event, index) => (
                          <MediaCard
                            key={event.id}
                            width={cardWidth}
                            label="Review event"
                            onPress={() => open(event)}
                            onFocused={() => {
                              eventRail.current?.scrollTo({
                                x: index * (cardWidth + 16),
                                animated: true,
                              });
                              bodyScroll.current?.scrollTo({
                                y: Math.max(0, eventY.current - 40),
                                animated: true,
                              });
                            }}
                          >
                            <Evidence
                              image={event.thumbnail}
                              detections={event.frames?.[0]?.detections}
                            />
                            <Text numberOfLines={2} style={s.cardTitle}>
                              {event.summary}
                            </Text>
                            <Text style={s.muted}>
                              {new Date(event.at).toLocaleString()}
                            </Text>
                          </MediaCard>
                        ))}
                      </ScrollView>
                    )}
                    {feed && !events.length && (
                      <View style={{ paddingVertical: 8, gap: 4 }}>
                        <Text style={s.cardTitle}>
                          {submitted
                            ? "No matching saved events"
                            : "Waiting for camera events"}
                        </Text>
                        <Text style={s.muted}>
                          {submitted
                            ? "Try another search or clear the filters to browse saved activity."
                            : "Camera activity will appear here when events arrive. Refreshes automatically."}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
      </ScrollView>
      {notice && token && !disconnectPrompt && (
        <View
          style={[
            s.notice,
            mobile && { left: 12, right: 12, width: undefined, padding: 16 },
          ]}
        >
          <View style={s.noticeContent}>
            {noticeImage && (
              <Image
                source={{ uri: noticeImage }}
                accessibilityLabel="Saved image from this event"
                resizeMode="cover"
                style={s.noticeImage}
              />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={s.heading}>
                {feed?.devices.find((d) => d.id === notice.deviceId)?.name ??
                  "New event"}
              </Text>
              <Text numberOfLines={3} style={s.paragraph}>
                {notice.summary}
              </Text>
              <Text style={s.muted}>
                Saved event · {new Date(notice.at).toLocaleTimeString()}
              </Text>
            </View>
          </View>
          <View style={s.actions}>
            <Action
              onPress={() => {
                setSubmitted("");
                setResults(null);
                setDeviceId("");
                open(notice);
              }}
            >
              Review event
            </Action>
            <Action onPress={() => setNotice(null)}>Dismiss</Action>
          </View>
        </View>
      )}
    </Viewport>
  );
}
export default App;

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: "#dce5ed",
    gap: 12,
  },
  mark: { backgroundColor: "#007bb9", padding: 12, borderRadius: 12 },
  markText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  brand: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: "#142e48",
  },
  body: { padding: 40, paddingBottom: 80 },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#142e48",
    marginVertical: 6,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#142e48",
    marginVertical: 6,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: "#24465e",
    marginVertical: 8,
  },
  muted: { fontSize: 12, color: "#597188" },
  note: { fontSize: 13, lineHeight: 20, color: "#597188", marginVertical: 10 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 8,
  },
  button: {
    backgroundColor: "#edf5fc",
    borderWidth: 3,
    borderColor: "transparent",
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#142e48",
    marginTop: 8,
    marginBottom: 4,
  },
  navButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 0,
    borderRadius: 4,
  },
  navSelected: { borderBottomColor: "#007bb9" },
  buttonText: { fontSize: 15, color: "#005e99", fontWeight: "600" },
  focus: { borderColor: "#007bb9", backgroundColor: "#d9edff" },
  disabled: { opacity: 0.45 },
  url: {
    fontSize: 32,
    fontWeight: "700",
    color: "#007bb9",
    marginVertical: 18,
  },
  code: {
    fontSize: 60,
    fontWeight: "700",
    letterSpacing: 6,
    color: "#007bb9",
    marginVertical: 10,
  },
  rail: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 8,
    paddingRight: 24,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginVertical: 8 },
  card: {
    width: 220,
    borderWidth: 2,
    borderColor: "#dce5ed",
    borderRadius: 8,
    padding: 8,
  },
  evidence: {
    height: 112,
    backgroundColor: "#edf2f7",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    borderWidth: 1,
    borderColor: "#dce5ed",
    padding: 24,
    borderRadius: 12,
    marginVertical: 22,
  },
  input: {
    borderWidth: 2,
    borderColor: "#93adbf",
    padding: 16,
    fontSize: 20,
    color: "#142e48",
    borderRadius: 8,
  },
  error: { fontSize: 18, color: "#b3283f", marginVertical: 16 },
  notice: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 440,
    padding: 24,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#007bb9",
    borderRadius: 12,
  },
  noticeContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  noticeImage: {
    width: 128,
    height: 96,
    borderRadius: 6,
    backgroundColor: "#eaf0f5",
  },
  boxLabel: {
    fontSize: 11,
    color: "#fff",
    backgroundColor: "#163c4d",
    alignSelf: "flex-start",
  },
});
