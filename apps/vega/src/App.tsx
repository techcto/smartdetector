import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  useWindowDimensions,
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
  focusRef,
  onLayout,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  preferred?: boolean;
  focusRef?: React.Ref<View>;
  onLayout?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={focusRef}
      onLayout={onLayout}
      accessibilityRole="button"
      disabled={disabled}
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[s.button, focused && s.focus, disabled && s.disabled]}
    >
      <Text style={s.buttonText}>{children}</Text>
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
      style={[s.evidence, large && { height: 360 }]}
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
                    Number.isFinite,
                  ) &&
                  d.box.x >= 0 &&
                  d.box.y >= 0 &&
                  d.box.width > 0 &&
                  d.box.height > 0 &&
                  d.box.x + d.box.width <= 1.001 &&
                  d.box.y + d.box.height <= 1.001,
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
  const searchInput = useRef<TextInput>(null),
    scroller = useRef<ScrollView>(null);
  const stopVoice = useRef<(() => void) | null>(null);
  const [voiceNote, setVoiceNote] = useState("");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") { stopVoice.current?.(); stopVoice.current = null; }
    });
    return () => { stopVoice.current?.(); subscription.remove(); };
  }, []);
  const { width: screenWidth } = useWindowDimensions();
  const mobile = screenWidth < 700;
  const client = useMemo(() => createClient(SERVICE_ORIGIN), []);
  // Display tokens and evidence are memory-only; restarting requires pairing again.
  const [token, setToken] = useState(""),
    [pair, setPair] = useState<Pair | null>(null),
    [feed, setFeed] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshEpoch, setRefreshEpoch] = useState(0),
    [deviceId, setDeviceId] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [frame, setFrame] = useState(0),
    [query, setQuery] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [results, setResults] = useState<Event[] | null>(null),
    [searchNote, setSearchNote] = useState(""),
    [notice, setNotice] = useState<Event | null>(null),
    [alerts, setAlerts] = useState(true),
    [settingsOpen, setSettingsOpen] = useState(false),
    [disconnectPrompt, setDisconnectPrompt] = useState(false),
    [link, setLink] = useState<ReturnType<typeof externalLink> | null>(null);
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
    stopVoice.current?.(); stopVoice.current = null; setVoiceNote("");
    epoch.current++;
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setToken("");
    setPair(null);
    setFeed(null);
    setSelectedId("");
    setDeviceId("");
    setResults(null);
    setQuery("");
    setSubmitted("");
    setSearchNote("");
    setNotice(null);
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
    return false;
  }, [link, selectedId, deviceId, submitted, disconnectPrompt, settingsOpen]);
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
      Math.max(5, Math.min(30, pair.interval || 5)) * 1000,
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
        if (fresh && allowAlerts.current) setNotice(fresh);
        seen.current = new Set(next.incidents.map((i: Event) => i.id));
        setNotice((n) =>
          n && next.incidents.some((i: Event) => i.id === n.id) ? n : null,
        );
        setFeed(next);
        setResults(search?.items ?? null);
        setSearchNote(
          search
            ? search.matched +
                " matching events" +
                (search.truncated ? " · limited; narrow your search" : "")
            : "",
        );
        setSelectedId((id) =>
          (search?.items ?? next.incidents).some((i: Event) => i.id === id)
            ? id
            : "",
        );
        setError("");
      } catch (e) {
        if (!disposed && !c.signal.aborted) {
          setResults(null);
          setSelectedId("");
          if (e instanceof AccessRevoked) reset();
          setError(
            e instanceof AccessRevoked
              ? e.message
              : "Feed or search unavailable. Retrying automatically.",
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
  const device = feed?.devices.find((d) => d.id === deviceId),
    events: Event[] = eventsForDevice(
      results ?? feed?.incidents ?? [],
      deviceId,
    ),
    selected = events.find((i) => i.id === selectedId);
  // Vega cannot open a browser; show the address so it can be opened on a phone or computer.
  function show(page: ExternalPage, from: React.RefObject<View | null>, id?: string) {
    returnTo.current = settingsOpen ? settingsBack : from;
    focusNext.current = linkBack;
    setLink(externalLink(SERVICE_ORIGIN, page, id));
    scroller.current?.scrollTo({ y: 0, animated: false });
  }
  function open(event: Event) {
    setSelectedId(event.id);
    setFrame(0);
    setNotice(null);
  }
  return (
    <View style={s.app}>
      <View
        style={[
          s.header,
          { flexWrap: "wrap" },
          mobile && { paddingHorizontal: 16, paddingVertical: 12 },
        ]}
      >
        <Image source={brandMark} accessibilityLabel="SmartDetector shield" style={{ width: 36, height: 36 }} />
        <View>
          <Text style={s.brand}>SmartDetector</Text>
          <Text style={s.muted}>Console · Native Vega app</Text>
        </View>
        {!!token && (
          <View style={[s.actions, mobile && { width: "100%" }]}>
            <Action
              onPress={() => {
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
              Security center
            </Action>
            <Action
              onPress={() => {
                setAlerts((a) => !a);
                setNotice(null);
              }}
            >
              Alerts {alerts ? "on" : "off"}
            </Action>
            <Action
              focusRef={settingsButton} onLayout={land(settingsButton)}
              onPress={() => {
                focusNext.current = settingsBack;
                setLink(null);
                setSettingsOpen(true);
              }}
            >
              Console settings
            </Action>
            <Action onPress={() => setRefreshEpoch((n) => n + 1)}>Refresh</Action>
          </View>
        )}
      </View>
      <ScrollView
        ref={scroller}
        contentContainerStyle={[
          s.body,
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
            <Text selectable style={[s.url, mobile && { fontSize: 22 }]}>{link.url}</Text>
            <Text style={s.paragraph}>{link.detail}</Text>
            <Action preferred focusRef={linkBack} onLayout={land(linkBack)} onPress={() => void back()}>← Back</Action>
          </View>
        ) : !token ? (
          <View>
            <Text style={[s.title, mobile && { fontSize: 28 }]}>
              Your devices. One perspective.
            </Text>
            <Text style={s.paragraph}>
              Connect this TV without entering your password or an API key.
            </Text>
            <Text style={s.paragraph}>1. Get a pairing code below.</Text>
            <Text style={s.paragraph}>
              2. On your phone, sign in at {SERVICE_ORIGIN}/tv/connect.
            </Text>
            <Text style={s.paragraph}>
              3. Select the intended location and approve this display.
            </Text>
            <Action focusRef={pairingButton} onLayout={land(pairingButton)} onPress={() => show("pairing", pairingButton)}>
              Open pairing approval
            </Action>
            {pair ? (
              <>
                <Text
                  style={[s.code, mobile && { fontSize: 36, letterSpacing: 2 }]}
                >
                  {pair.userCode}
                </Text>
                <Text style={s.muted}>
                  Waiting for approval · expires{" "}
                  {new Date(pair.expiresAt).toLocaleTimeString()}
                </Text>
                <Action
                  onPress={() => {
                    epoch.current++;
                    setPair(null);
                    setError("");
                  }}
                >
                  Cancel pairing
                </Action>
              </>
            ) : (
              <Action preferred disabled={busy} onPress={() => void begin()}>
                {busy ? "Connecting…" : "Get pairing code"}
              </Action>
            )}
            <Text style={s.note}>
              Read-only access. Pair again after closing the app. Revoke a
              display permanently under Devices → Fire TV on your phone.
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
              <Action preferred onPress={() => setDisconnectPrompt(false)}>Keep connected</Action>
              <Action onPress={reset}>Disconnect and require pairing again</Action>
            </View>
          </View>
        ) : settingsOpen ? (
          <View style={s.panel}>
            <Text style={s.heading}>Console settings</Text>
            <Action onPress={() => show("privacy", settingsBack)}>Privacy policy</Action>
            <Action onPress={() => show("dataDeletion", settingsBack)}>Delete saved data</Action>
            <Action onPress={() => show("accountDeletion", settingsBack)}>Request account deletion</Action>
            <Action preferred focusRef={settingsBack} onLayout={land(settingsBack)} onPress={() => void back()}>Back to console</Action>
            <Text style={s.paragraph}>Disconnect only when you want to pair this console again. Normal browsing does not require disconnecting.</Text>
            <Action onPress={() => setDisconnectPrompt(true)}>Disconnect this console…</Action>
          </View>
        ) : (
          <>
            {(selectedId || deviceId || submitted) && (
              <Action
                preferred
                onPress={() => {
                  back();
                }}
              >
                ← Back
              </Action>
            )}
            <Text style={[s.title, mobile && { fontSize: 28 }]}>
              {selected
                ? "Event review"
                : (device?.name ?? "Your location, in perspective.")}
            </Text>
            <Text style={s.muted}>
              {feed
                ? "Updated " + new Date(feed.updatedAt).toLocaleTimeString()
                : "Connecting…"}{" "}
              · saved evidence · refreshes every five seconds
            </Text>
            {selected ? (
              <View style={[s.panel, mobile && { padding: 12 }]}>
                <Evidence
                  large={!mobile}
                  image={
                    selected.frames?.[frame]?.preview ?? selected.thumbnail
                  }
                  detections={selected.frames?.[frame]?.detections}
                />
                <View style={s.actions}>
                  {selected.frames?.map((f, i) => (
                    <Action key={i} onPress={() => setFrame(i)}>
                      {i === frame ? "● " : ""}
                      {(f.at_ms / 1000).toFixed(1)}s
                    </Action>
                  ))}
                </View>
                <Text style={s.heading}>{selected.summary}</Text>
                <Text style={s.paragraph}>
                  {selected.deviceId} · {new Date(selected.at).toLocaleString()}{" "}
                  · {selected.state}
                </Text>
                <Text style={s.note}>
                  Sampled images, not continuous video. Green: measured
                  detections. Amber: advisory AI grounding. No identity or
                  threat certainty is implied.
                </Text>
                {!deviceId && (
                  <Action onPress={() => { setDeviceId(selected.deviceId); setSelectedId(""); setFrame(0); setSubmitted(""); setResults(null); }}>
                    Browse this device’s events
                  </Action>
                )}
              </View>
            ) : (
              <>
                {device && (
                  <View style={[s.panel, mobile && { padding: 12 }]}>
                    <Evidence large={!mobile} image={events[0]?.frames?.[0]?.preview ?? events[0]?.thumbnail} detections={events[0]?.frames?.[0]?.detections} />
                    <Text style={s.heading}>{events[0]?.summary ?? "Waiting for the first event"}</Text>
                    <Text style={s.muted}>Latest retained evidence · {device.status}</Text>
                    {events[0] && <Action onPress={() => open(events[0])}>Review latest event</Action>}
                    {device.liveView && <Action focusRef={liveButton} onLayout={land(liveButton)} onPress={() => show("liveView", liveButton, device.id)}>Open camera live view in web console</Action>}
                  </View>
                )}
                {!deviceId && feed && <Text style={s.paragraph}>{feed.devices.length} connected devices · {feed.incidents.length} recent events</Text>}
                {!deviceId && (
                  <>
                    <Text style={s.heading}>Devices</Text>
                    <View style={s.grid}>
                      {feed?.devices.map((d) => (
                        <View
                          key={d.id}
                          style={[s.card, mobile && { width: "100%" }]}
                        >
                          <Evidence
                            image={
                              feed.incidents.find((i) => i.deviceId === d.id)
                                ?.thumbnail
                            }
                          />
                          <Text style={s.heading}>{d.name}</Text>
                          <Text style={s.muted}>{d.status}</Text>
                          <Action
                            onPress={() => {
                              setDeviceId(d.id);
                              setSubmitted("");
                              setResults(null);
                              setQuery("");
                            }}
                          >
                            Browse device
                          </Action>
                        </View>
                      ))}
                    </View>
                    {feed && !feed.devices.length && (
                      <View style={s.panel}>
                        <Text style={s.heading}>Add your first device</Text>
                        <Text style={s.paragraph}>
                          No cameras are connected to this location. Open Devices on your phone or browser, select this same location, and connect your Ring account to discover shared cameras.
                        </Text>
                        <Action focusRef={devicesButton} onLayout={land(devicesButton)} onPress={() => show("devices", devicesButton)}>
                          Add device
                        </Action>
                      </View>
                    )}
                  </>
                )}
                <View style={[s.panel, mobile && { padding: 12 }]}>
                  <Text style={s.heading}>Search saved events</Text>
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
                    <Action onPress={() => {
                      stopVoice.current?.(); stopVoice.current = null;
                      searchInput.current?.focus();
                      setVoiceNote("Use voice dictation if your TV keyboard offers it. Review the text, then select Search. Otherwise type your query.");
                    }}>TV keyboard / voice</Action>
                    {browserVoiceAvailable && <Action onPress={() => {
                      stopVoice.current?.();
                      setVoiceNote("Listening for up to 15 seconds. Your browser/OS speech service may process audio.");
                      try { stopVoice.current = startBrowserVoice((text) => { setQuery(text); setSubmitted(""); setResults(null); }, setVoiceNote); }
                      catch (error) { setVoiceNote(error instanceof Error ? error.message : "Voice input unavailable. Use the keyboard."); }
                    }}>Use browser mic</Action>}
                    {browserVoiceAvailable && <Action onPress={() => { stopVoice.current?.(); stopVoice.current = null; setVoiceNote("Microphone stopped. Review the text, then select Search."); }}>Stop microphone</Action>}
                    <Action
                      disabled={!query.trim()}
                      onPress={() => setSubmitted(query.trim())}
                    >
                      Search
                    </Action>
                    <Action
                      onPress={() => {
                        stopVoice.current?.(); stopVoice.current = null; setVoiceNote("");
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
                    TV dictation depends on the system keyboard. The remote Alexa button is not captured by this app. Browser microphone recognition, when available, may use your browser/OS provider. Only submitted search text is sent to SmartDetector; this app does not retain audio.
                  </Text>
                  {!!voiceNote && <Text accessibilityLiveRegion="polite" style={s.muted}>{voiceNote}</Text>}
                  {!!searchNote && <Text style={s.muted}>{searchNote}</Text>}
                </View>
                <Text style={s.heading}>
                  {submitted
                    ? "Search results"
                    : device
                      ? "Device history"
                      : "Recent events"}
                </Text>
                <View style={s.grid}>
                  {events.map((event) => (
                    <View
                      key={event.id}
                      style={[s.card, mobile && { width: "100%" }]}
                    >
                      <Evidence
                        image={event.thumbnail}
                        detections={event.frames?.[0]?.detections}
                      />
                      <Text numberOfLines={3} style={s.paragraph}>
                        {event.summary}
                      </Text>
                      <Text style={s.muted}>
                        {new Date(event.at).toLocaleString()}
                      </Text>
                      <Action onPress={() => open(event)}>Review event</Action>
                    </View>
                  ))}
                </View>
                {feed && !events.length && (
                  <View style={s.panel}>
                    <Text style={s.heading}>{submitted ? "No matching saved events" : "Waiting for camera events"}</Text>
                    <Text style={s.paragraph}>
                      {submitted
                        ? "Try another search or clear the filters to browse saved activity."
                        : "Connected cameras will appear here with real images as events arrive. Trigger motion or a doorbell press on a shared camera. This console refreshes every five seconds; it does not generate sample events."}
                    </Text>
                    <Action focusRef={ringButton} onLayout={land(ringButton)} onPress={() => show("ring", ringButton)}>
                      {feed.devices.length ? "Manage camera connection" : "Add Ring connection"}
                    </Action>
                  </View>
                )}
                {device?.liveView && (
                  <Text style={s.note}>
                    Native Ring live video is not available yet. Use the web
                    console for live viewing; this app reviews retained event
                    frames.
                  </Text>
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
        <Text style={s.note}>
          Use remote arrows, Select and Back. Alerts appear only while this app
          is open. Clear saved history in SmartDetector Settings.
        </Text>
      </ScrollView>
      {notice && token && !disconnectPrompt && (
        <View
          style={[
            s.notice,
            mobile && { left: 12, right: 12, width: undefined, padding: 16 },
          ]}
        >
          <Text style={s.heading}>New event</Text>
          <Text numberOfLines={2} style={s.paragraph}>
            {notice.summary}
          </Text>
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
    </View>
  );
}
export default App;

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: "#dce5ed",
    gap: 16,
  },
  mark: { backgroundColor: "#007bb9", padding: 12, borderRadius: 12 },
  markText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  brand: { fontSize: 22, fontWeight: "900", letterSpacing: -0.6, color: "#142e48" },
  body: { padding: 40, paddingBottom: 80 },
  title: {
    fontSize: 36,
    fontWeight: "600",
    color: "#142e48",
    marginVertical: 22,
  },
  heading: {
    fontSize: 23,
    fontWeight: "600",
    color: "#142e48",
    marginVertical: 14,
  },
  paragraph: {
    fontSize: 18,
    lineHeight: 28,
    color: "#24465e",
    marginVertical: 8,
  },
  muted: { fontSize: 15, color: "#597188" },
  note: { fontSize: 15, lineHeight: 24, color: "#597188", marginVertical: 18 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginVertical: 12,
  },
  button: {
    backgroundColor: "#edf5fc",
    borderWidth: 3,
    borderColor: "transparent",
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  buttonText: { fontSize: 18, color: "#005e99", fontWeight: "600" },
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
    marginVertical: 24,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginVertical: 16 },
  card: {
    width: 320,
    borderWidth: 1,
    borderColor: "#dce5ed",
    borderRadius: 12,
    padding: 16,
  },
  evidence: {
    height: 200,
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
  boxLabel: {
    fontSize: 11,
    color: "#fff",
    backgroundColor: "#163c4d",
    alignSelf: "flex-start",
  },
});
