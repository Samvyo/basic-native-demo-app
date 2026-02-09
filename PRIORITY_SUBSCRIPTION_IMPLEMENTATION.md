# Priority-Based Subscription Implementation

## Overview

The React Native app now implements priority-based subscription management similar to ConferenceRoom.jsx (lines 1009-1228). This ensures efficient bandwidth usage by automatically managing which peers to subscribe to based on priority, pagination, and stage routing.

## Implementation Details

### 1. Priority Peers (Always Subscribed)

The following peers are **always subscribed** regardless of page:

- **Pinned Peer** (`pinnedPeerId`) - User-pinned participant
- **Spotlight Peer** (`spotlightPeerId`) - Spotlighted participant  
- **Active Speaker** (`activeSpeakerId`) - Currently speaking participant

### 2. Pagination-Based Subscription

- **Current Page**: All peers on the current page are subscribed
- **Adjacent Pages**: Peers on previous/next page are **staged** (preloaded but paused)
- **Far Pages**: Peers on distant pages are **unsubscribed** (no bandwidth used)

### 3. Stage Routing Support

When stage routing is active:
- Only peers in the allowed stage set are considered for subscription
- Respects `localOnStage` and `localBackStage` settings

### 4. Automatic Updates

The subscription logic automatically updates when:
- New peers join (`newPeer` event)
- Peers leave (`peerLeft` event)
- Current page changes
- Priority peers change (pinned, spotlight, active speaker)
- Stage routing settings change
- Peer order changes (sortedPeerIds)

### 5. Subscription Snapshot

The implementation logs subscription snapshots showing:
- **Desired State**: What we want to subscribe to
- **Effective State**: What's actually subscribed (may differ due to server limits/preemptions)

## Code Structure

### ConferenceScreen.js

```javascript
// Priority-based subscription useEffect (lines ~100-350)
useEffect(() => {
  // 1. Check SDK availability
  // 2. Get all visible peer IDs
  // 3. Calculate pagination
  // 4. Determine priority peers
  // 5. Process each peer:
  //    - Priority? → Subscribe
  //    - Current page? → Subscribe
  //    - Adjacent page? → Stage
  //    - Far page? → Unsubscribe
  // 6. Apply subscriptions via sdkInstance.setSubscriptions()
  // 7. Update context state
  // 8. Log subscription snapshot
}, [
  sortedPeerIds,      // Triggers on peer join/leave
  currentPage,        // Triggers on page change
  pinnedPeerId,      // Triggers on pin change
  spotlightPeerId,   // Triggers on spotlight change
  activeSpeakerId,   // Triggers on speaker change
  // ... stage routing deps
]);
```

### useSdkEvents.js

Handles `activeSpeaker` event and updates `activeSpeakerId` state:

```javascript
sdkInstance.on('activeSpeaker', ({ peerId, volume }) => {
  onActiveSpeakerChange(peerId); // Updates activeSpeakerId in ConferenceScreen
});
```

## Key Features

1. **Automatic Subscription Management**: No manual buttons needed
2. **Priority-Based**: Important peers always subscribed
3. **Efficient Bandwidth**: Only visible/priority peers consume bandwidth
4. **Fast Switching**: Adjacent pages preloaded (staged)
5. **Debug Logging**: Comprehensive console logs for subscription state
6. **Snapshot Support**: Shows desired vs effective subscription state

## Subscription States

- **🟢 SUBSCRIBED**: Media flowing, consuming bandwidth
- **🟡 STAGED**: Preloaded but paused, ready for instant switch
- **🔴 UNSUBSCRIBED**: No consumers, no bandwidth

## Console Output

When subscriptions update, you'll see:

```
📡 SUBSCRIPTION STATE [Page 1/3] - 6 peers/page
📄 PAGE LAYOUT:
  Page 1: 🟢 SUBSCRIBED → [Alice, Bob, Charlie, ...]
  Page 2: 🟡 STAGED → [David, Eve, ...]
  Page 3: 🔴 UNSUBSCRIBED → [Frank, Grace, ...]

🟢 SUBSCRIBED (6 peers - media flowing):
  • Alice — Current Page (1) - ACTUAL
  • Bob — Current Page (1) - ACTUAL + ACTIVE_SPEAKER
  • Charlie — Page 1 + PINNED

🟡 STAGED (6 peers - ready for instant switch):
  • David — NEXT Page (2)
  • Eve — NEXT Page (2)

📊 SUMMARY:
  • Total Peers: 18 (excluding self)
  • Subscribed: 6 (media flowing)
  • Staged: 6 (paused, ready)
  • Unsubscribed: 6 (no consumers)
  • Current Page: 1 of 3
  • 🎤 Active Speaker: Bob

📸 SDK SNAPSHOT:
  • Manual Mode: true
  • Desired Active: [Alice, Bob, Charlie, ...]
  • Effective Active: [Alice, Bob, Charlie, ...]
```

## Usage

The subscription management is **fully automatic**. When a new peer joins:

1. `newPeer` event fires
2. Peer added to `peers` Map
3. `sortedPeerIds` updates
4. Subscription `useEffect` runs
5. New peer automatically subscribed if on current page or priority
6. Subscription snapshot logged

No manual intervention needed!
