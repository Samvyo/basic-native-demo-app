# AI Agent (and friends) — Implementation Plan for `basic-native-demo-app`

## Why this document exists

We recently ported a set of features into `samvyo-demo-flutter-app` (see `SDK_PARITY_INTEGRATION_PLAN.md` there) to prove out AI-Agent-consent, bulk mute, and better error/reconnect logging against the **Flutter SDK**. Those same capabilities already exist in **`react-native-sdk`** (this app's SDK) — they were added there first, and Flutter caught up to match. But nobody has wired them into `App.js` yet, so right now they're unreachable from this app: new SDK events just fall into whatever `default`/no-op branch already exists, same problem the Flutter demo had before we fixed it there.

This doc explains, **feature by feature**, what to add to `App.js`, why it works the way it does, and gives a full working code example for each — written so someone new to this codebase (or to event-driven SDKs in general) can follow along and actually implement it.

Every method/event name below was checked directly against `react-native-sdk/lib/RNSdk.js` — nothing here is guessed from the Flutter side.

---

## Before you start: one thing outside your control

AI Agent is gated behind a per-organization `aiEnabled` flag in `samvyo-app-autoscaler`. It currently defaults to **off** for most orgs. If you wire everything below correctly and "nothing happens" when you start the agent, check that flag for your test org before assuming your code is wrong.

---

## The mental model, in one paragraph

If you've only worked with things like `fetch()` before, the SDK will feel different: instead of "ask a question, get an answer," most of this is "tell the SDK what you want (`startAiAgent(...)`), then **separately** listen for what happens next (`sdkInstance.on('aiAgentStarted', ...)`)." That's because the real answer doesn't come back instantly — it has to go to the server, maybe out to another participant who needs to click "Allow," and back. This pattern (`sdkInstance.on(eventName, callback)`) is called an **event emitter**, and `App.js` already uses it everywhere — look at the block starting `sdkInstanceRef.current.on('newPeer', ...)` around line 338. Everything below follows that exact same shape.

---

## Priority order

| # | Feature | Effort | Why this order |
|---|---|---|---|
| 1 | Bulk moderator mute | Smallest | One button, one method call — good warm-up, but see the blocker note in §2 |
| 2 | Resilience/observability logging | Small | Pure visibility, zero new UI, catches real bugs during testing |
| 3 | AI Agent consent UI | Largest | The main feature — four small pieces, each independent |
| 4 | Duplicate-message safety check | Trivial | Only needed if you notice it happening (see below) |

---

## 1. Resilience/observability logging (do this first — it's free)

**What it is:** The SDK already handles reconnects, session expiry, and role changes correctly on its own — you don't have to write any recovery logic. The problem is you currently can't *see* any of it happening, so if something goes wrong during testing, you have no way to tell "the SDK silently failed" from "the SDK worked and I just don't have a log line for it."

**What to do:** Add a few more `.on(...)` listeners next to the ones already in `App.js`, that just call `console.log`. No state, no UI.

```js
// Add these inside the same block as the existing sdkInstanceRef.current.on('newPeer', ...) calls

sdkInstanceRef.current.on('terminalClose', ({code, category, reason}) => {
  console.log('Connection closed', {code, category, reason});
  Alert.alert('Connection closed', category);
});

sdkInstanceRef.current.on('sessionExpired', ({code, reason}) => {
  console.log('Session expired', {code, reason});
  Alert.alert('Session expired', 'Please rejoin the room');
});
```

Both `terminalClose` and `sessionExpired` are confirmed present in `RNSdk.js` (`this.emit("terminalClose"`, `this.emit("sessionExpired"`) — safe to paste as-is.

> **Beginner note:** these are things that can happen *to* you without you doing anything — your session times out, the WebSocket drops for a reason that isn't a normal reconnect. Because the SDK already tells the rest of the app about these via events, you don't need to poll or guess; you just need to be listening.

**One from the Flutter list that does NOT exist here yet:** `participantTypeChanged` (a role-change event — "you've been promoted/demoted"). I checked (`grep -n participantTypeChang lib/RNSdk.js`, `grep -n roleChang`) and there's no equivalent event, under any name, in `react-native-sdk` right now. This is a genuine feature gap, not a naming difference — skip it here until the SDK adds it, same as bulk mute in §2.

---

## 2. Bulk moderator mute — ✅ unblocked (2026-08-24)

**What it is:** A moderator clicks one button and every other participant's mic gets forced off.

**Status update:** the SDK-side blocker described in the original version of this section is resolved. `muteAllParticipants()` was added to `react-native-sdk` (commit `fe9ba56`, docs in `7429a15`, `PARITY.md` updated), matches the JS SDK's `{id: "allMicOff", peerId, roomName}` message exactly, and is now committed on `enhancement/v3-changes` with a clean rebuilt `dist/`. The demo app's `lib/rnsdk.cjs.js`/`lib/rnsdk.esm.js` have been re-synced from that build, so `muteAllParticipants` is available to call from `App.js` right now.

The *receiving* half was already working in this app before this fix — check `App.js` around line 397 and 441, `peerMuted` and `micForcedOff` are already wired up. So both halves are now in place; only the button in §"wiring it up" below is left to add.

**Wiring it up in `App.js`:**

```js
const muteAllParticipants = () => {
  sdkInstanceRef.current.muteAllParticipants();
  Alert.alert('Muted everyone');
};

// In your moderator-only controls section (wherever isModeratorRole is already checked):
{isModeratorRole && (
  <Button title="Mute All" onPress={muteAllParticipants} />
)}
```

---

## 3. AI Agent consent UI (the main feature)

This is four *independent* pieces. You can build and test them one at a time — none of them depend on the others being done first.

### 3a. Starting/stopping the agent (moderator only)

**The idea:** A moderator picks which camera/mic streams they want an AI to analyze, and applies that selection. There's a subtlety worth understanding before you write any code: **an empty selection and "no selection made yet" are different things**, and the SDK treats them differently on purpose.

- `startAiAgent()` (no arguments) → analyze the **whole room**.
- `startAiAgent({targets: []})` → the server **refuses**. An empty array means "the moderator deliberately picked nobody," and the SDK won't silently widen that to "everybody" — that would mean paying for AI analysis on streams nobody actually asked for.
- To stop entirely, call `stopAiAgent()` — don't call `startAiAgent({targets: []})` expecting it to act like "stop."

```js
const [aiRows, setAiRows] = useState([]);      // [{peerId, displayName, mediaTag, kind, selected, consent}]
const [aiTicked, setAiTicked] = useState(new Set()); // Set of "peerId:mediaTag" strings

const loadAiSelectableStreams = async () => {
  // This asks the SERVER who's currently publishing — it's not something
  // we can figure out ourselves from local state, because the server is
  // the only one who reliably knows what every peer in the room is sending.
  const rows = await sdkInstanceRef.current.requestAiSelectableStreams();
  setAiRows(rows);
  // Pre-tick whatever the server says is already selected, so reopening
  // the picker doesn't look like everything was reset.
  setAiTicked(new Set(rows.filter(r => r.selected).map(r => `${r.peerId}:${r.mediaTag}`)));
};

const toggleAiRow = (peerId, mediaTag) => {
  const key = `${peerId}:${mediaTag}`;
  setAiTicked(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
};

const applyAiSelection = () => {
  if (aiTicked.size === 0) {
    // Empty selection = "turn it off", sent as stopAiAgent(), NOT
    // startAiAgent({targets: []}) — see the note above for why.
    sdkInstanceRef.current.stopAiAgent();
    return;
  }
  // Group the ticked "peerId:mediaTag" keys back into
  // [{peerId, mediaTags: [...]}] — the shape startAiAgent expects.
  const byPeer = {};
  aiTicked.forEach(key => {
    const [peerId, mediaTag] = key.split(':');
    (byPeer[peerId] ??= []).push(mediaTag);
  });
  const targets = Object.entries(byPeer).map(([peerId, mediaTags]) => ({peerId, mediaTags}));
  sdkInstanceRef.current.startAiAgent({targets});
};
```

**Listen for the result** — `startAiAgent()` only confirms the *request* was sent, not that it succeeded. The real outcome arrives as an event, per-target rather than as a single count, because "2 of 3 attached" tells you nothing about which one failed:

```js
sdkInstanceRef.current.on('aiAgentStarted', ({attached, requested, wholeRoom, targets}) => {
  console.log('AI agent started', {attached, requested, wholeRoom, targets});
  // targets is [{peerId, status}] where status is one of:
  // attached | attach_failed | not_publishing | not_in_room | no_matching_tag
});

sdkInstanceRef.current.on('aiAgentError', ({text, reason, retracted}) => {
  // retracted:true means an aiAgentStarted you already received got
  // cancelled — render this as "the agent didn't actually start" rather
  // than as a separate, confusing error popup.
  Alert.alert('AI Agent', text || 'Something went wrong starting the agent');
});
```

### 3b. The consent prompt (whoever gets selected)

**The idea:** If you're one of the streams a moderator picked, you get asked for permission before anything is actually analyzed. This is the trickiest piece to get right, and it's worth explaining *why* before you write it.

> **A real bug that happened here, so you don't repeat it:** an earlier version of this feature (in a different app) used `Alert.alert(...)` — a one-shot popup — to show the consent request. The problem: a consent request can **expire** or get **narrowed** (say you were asked about both camera and mic, but the mic part timed out first) while the popup is already on screen, and `Alert.alert` has no way to update or dismiss itself once it's showing. The result: a dialog that was still on screen 163 seconds after its 45-second window had already closed, silently confusing the person who eventually clicked it.
>
> The fix: instead of imperatively popping up a dialog, keep the consent request in **state**, and render a modal *conditionally based on that state*. When the SDK tells you the request changed (or disappeared), you update the state, and because your modal is driven by that state, it automatically updates or disappears too — no separate "please close now" step needed.

```js
const [pendingAiConsent, setPendingAiConsent] = useState(null); // {streams, requestedBy, expiresInMs} | null
const [aiConsentChecked, setAiConsentChecked] = useState({});   // {mediaTag: boolean}

sdkInstanceRef.current.on('aiConsentRequest', (request) => {
  // request = {streams: [{mediaTag, kind}], requestedBy, expiresInMs, roomName}
  setPendingAiConsent(request);
  setAiConsentChecked({}); // never carry ticks over from a previous request
});

sdkInstanceRef.current.on('aiConsentExpired', ({pending}) => {
  // The SDK tells us exactly what's still open — we never run our own
  // timer to guess this. `pending` is either a narrowed request or null.
  setPendingAiConsent(pending);
});

const respondToAiConsent = (grants) => {
  // grants can be `true`/`false` (answer for every stream), or a map like
  // {"cam-video": true, "cam-audio": false} for per-stream answers.
  const result = sdkInstanceRef.current.respondToAiConsent(grants);
  if (!result.success) {
    // Do NOT clear pendingAiConsent here — the answer didn't actually go
    // anywhere (e.g. we're offline), so the request is still real and the
    // user should be able to try again rather than have their tap silently
    // eaten.
    Alert.alert('Could not send your answer', 'Please try again');
    return;
  }
  setPendingAiConsent(null);
  setAiConsentChecked({});
};
```

A minimal modal for this, using React Native's built-in `Modal`:

```jsx
<Modal visible={!!pendingAiConsent} transparent animationType="fade">
  <View style={styles.consentOverlay}>
    <View style={styles.consentCard}>
      <Text style={styles.consentTitle}>Allow the AI assistant?</Text>
      <Text>A moderator wants to analyze:</Text>
      {pendingAiConsent?.streams.map(s => (
        <View key={s.mediaTag} style={{flexDirection: 'row', alignItems: 'center'}}>
          <Switch
            value={!!aiConsentChecked[s.mediaTag]}
            // Defaults to OFF — consent is opt-in. A pre-checked box would
            // mean tapping "Allow" to dismiss a dialog you didn't fully
            // read ends up granting something you never actually agreed to.
            onValueChange={v => setAiConsentChecked(prev => ({...prev, [s.mediaTag]: v}))}
          />
          <Text>{s.mediaTag}</Text>
        </View>
      ))}
      <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 8}}>
        <Button title="Decline" onPress={() => respondToAiConsent(false)} />
        <Button title="Allow selected" onPress={() => respondToAiConsent(aiConsentChecked)} />
      </View>
    </View>
  </View>
</Modal>
```

### 3c. My streams / self-consent (everyone, not just moderators)

**The idea:** Separate from the consent *prompt* above (which is a one-time question with a countdown), this is a **standing panel** showing "here's the current state of AI analysis on my own streams" — so you can grant or revoke at any time, not just when asked.

```js
const [myAiStreams, setMyAiStreams] = useState([]); // [{mediaTag, state, canGrant, canRevoke, cooldownUntilMs}]

// Call once after joining, to seed the panel — otherwise it's blank until
// the next server push, which might be a while if nothing's changing.
const loadMyAiConsent = async () => {
  const view = await sdkInstanceRef.current.requestMyAiConsent();
  setMyAiStreams(view.streams);
};

// The SDK pushes updates on its own whenever anything changes — a
// selection change, your own answer, or a timeout. We just mirror it.
sdkInstanceRef.current.on('aiMyConsent', ({streams}) => {
  setMyAiStreams(streams);
});

const grantAi = (mediaTag) => sdkInstanceRef.current.grantAiConsent([mediaTag]);
const revokeAi = (mediaTag) => sdkInstanceRef.current.revokeAiConsent([mediaTag]);
```

```jsx
{myAiStreams.map(s => (
  <View key={s.mediaTag} style={{flexDirection: 'row', alignItems: 'center'}}>
    <Text style={{flex: 1}}>{s.mediaTag} — {s.state ?? 'not asked yet'}</Text>
    {/* canGrant/canRevoke come straight from the server — never assume
        one just because the other is true, the server can say no to both */}
    {s.canGrant && <Button title="Allow" onPress={() => grantAi(s.mediaTag)} />}
    {s.canRevoke && <Button title="Stop" onPress={() => revokeAi(s.mediaTag)} />}
  </View>
))}
```

### 3d. Observations panel (everyone)

**The idea:** A live feed of whatever the AI is noticing. This one's the simplest of the four.

```js
const [aiObservations, setAiObservations] = useState([]);

// Seed with history, so opening this panel mid-call isn't blank.
useEffect(() => {
  if (sdkInstanceRef.current) {
    setAiObservations(sdkInstanceRef.current.getAiObservations());
  }
}, []);

sdkInstanceRef.current.on('aiAnalysis', (observation) => {
  setAiObservations(prev => [...prev.slice(-49), observation]); // cap at 50
});
```

```jsx
<ScrollView style={{height: 150, borderWidth: 1, borderColor: '#ccc'}}>
  {aiObservations.map((obs, i) => (
    <Text key={i} style={obs.notable ? {backgroundColor: '#fff3cd'} : undefined}>
      {obs.summary ?? JSON.stringify(obs)}
    </Text>
  ))}
</ScrollView>
```

> **Deliberately not included:** an `aiTranscript` listener. Whether to show live transcripts is a per-deployment privacy decision, not something this demo app should default to doing on its own — leave that one out unless someone explicitly asks for it.

---

## 4. Duplicate chat/reaction messages — confirmed present, not hypothetical

**Checked directly against the current `App.js` — this bug is real here, for both chat and reactions:**

- `sendChatMessage` (line 956) adds an optimistic local entry to `chatMessages` the moment you send, without waiting for the echo.
- `sendReaction` (line 934) does the same for `recentReactions`.
- `handleCustomMessageEvent` (line 680), which runs on every incoming `customMessage` including your own echo, has no guard against it — it unconditionally appends for both `type === 'chat'` and `payload.type === 'emoji-reaction'`. It already branches on `message.from === 'me'` (for display-name purposes, at lines 687 and 721) but that branch still adds the entry — it doesn't skip it.

**Net effect:** every chat message and every reaction you send currently appears twice on your own screen — once from the optimistic add, once from the server's echo a moment later.

**The fix** — note the field is `message.from === 'me'` here (a literal string the SDK uses for your own echoes), not a peerId comparison. **Scope the guard to just the chat and reaction branches, not the whole function** — `handleCustomMessageEvent` also handles `roomSetting:*` broadcasts (stage/general/presenter/participant settings) further down, and those work differently: the moderator's own controls (the `Switch`/`TextInput` in the permissions panel) already write directly to that state as the form is edited, so their echo re-applying the same values is a harmless no-op today. A blanket guard at the top of the function isn't *known* to break that, but there's no reason to take on that risk for a fix that only needs to touch two branches:

```js
if (message.type === 'chat') {
  // The server echoes our own sendCustomMessage back to us, and
  // sendChatMessage already added this message optimistically the
  // moment we sent it — without this guard, the echo adds it again.
  if (message.from === 'me') {
    return;
  }
  const displayName = ...
  // ...rest of existing chat handling, unchanged
}

// ...

if (payload.type === 'emoji-reaction') {
  // Same reasoning as chat, above — sendReaction already added this
  // reaction optimistically.
  if (message.from === 'me') {
    return;
  }
  const displayName = ...
  // ...rest of existing reaction handling, unchanged
}
```

Everything else in `handleCustomMessageEvent` — including the `roomSetting:*` branches — stays exactly as it is.

---

## Testing checklist

- [ ] Confirm `aiEnabled` is on for your test org before assuming a "nothing happened" result means broken code.
- [ ] Test with **two devices**: one moderator, one participant, so you can see both the picker (3a) and the consent prompt (3b) in the same session.
- [ ] Force an `aiConsentExpired` (let a request sit past its window) to confirm the modal actually closes on its own, not just when you answer it.
- [ ] Confirm `getAiObservations()` returns something when you open the panel *after* the agent has already been running for a bit, not just from a fresh start.
- [ ] For bulk mute: confirm the SDK-side `muteAllParticipants()` method exists before wiring the button — see §2's blocker note.
