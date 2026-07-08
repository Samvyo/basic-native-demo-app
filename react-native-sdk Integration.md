# Samvyo React Native SDK — Complete Setup & Integration Guide (Android)

This guide takes you from a **fresh machine** to a **working video call** on a real Android phone. Follow every step in order.

---

## What Are These Two Repos?

You are working with two separate repos. It is important to understand what each one does before starting.

```
react-native-sdk/
│
│   This is the SDK source code.
│   Engineers write and maintain the video call logic here.
│   Files like RNSdk.js and WebSocketManager.js live here.
│   You run a build command here to produce a single output file.
│
└── dist/rnsdk.cjs.js  ← produced after running "npm run build"


basic-native-demo-app/          ← YOU ARE HERE
│
│   This is the demo/test app.
│   This is what runs on your Android phone.
│   It imports the built SDK file and uses it to make video calls.
│   This is the app you install and test on your device.
│
└── lib/rnsdk.cjs.js  ← already present when you clone this repo
```

**The demo app does not use the SDK from node_modules.**
It imports the SDK directly from the `lib/` folder:

```js
// App.js line 20
import samvyo from './lib/rnsdk.cjs.js';
```

The `lib/rnsdk.cjs.js` file is **already in this repo** when you clone it.
You only need to replace it when you make changes to the SDK source code and rebuild.

---

## Part 1 — Install System Prerequisites

These are one-time installations on your machine. Skip any that are already installed.

### 1.1 — Install Node.js (version 18 or higher)

Check if you have it:

```bash
node --version
```

If not installed or version is below 18, download from [https://nodejs.org](https://nodejs.org) and install the LTS version.

### 1.2 — Install Java Development Kit (JDK 17)

React Native requires JDK 17 specifically. Check if you have it:

```bash
java -version
```

If not installed, install it on Ubuntu/Debian:

```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

Verify after installing:

```bash
java -version
# Should show: openjdk version "17.x.x"
```

### 1.3 — Install Android Studio

Android Studio gives you the Android SDK, build tools, and emulator needed to build the app.

1. Download from [https://developer.android.com/studio](https://developer.android.com/studio)
2. Run the installer and follow the setup wizard
3. In the setup wizard, make sure these are checked:
   - **Android SDK**
   - **Android SDK Platform**
   - **Android Virtual Device**

### 1.4 — Install Android SDK Build Tools via Android Studio

1. Open Android Studio
2. Click **More Actions** → **SDK Manager**
3. Under **SDK Platforms** tab → check **Android 14 (API 34)**
4. Under **SDK Tools** tab → check:
   - **Android SDK Build-Tools**
   - **Android SDK Command-line Tools**
   - **Android Emulator**
   - **Android SDK Platform-Tools**
5. Click **Apply** and let it download

### 1.5 — Set ANDROID_HOME Environment Variable

Android tools must be on your system PATH. Add these lines to your `~/.bashrc` file:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Apply the changes:

```bash
source ~/.bashrc
```

Verify it works:

```bash
adb --version
# Should print: Android Debug Bridge version x.x.x
```

---

## Part 2 — Set Up the SDK Repo (`react-native-sdk`)

Do this only if you are making changes to the SDK itself.
If you just want to run the demo app with the existing SDK, skip to Part 3.

### 2.1 — Install dependencies

```bash
cd react-native-sdk
npm install
```

### 2.2 — Build the SDK

```bash
npm run build
```

This produces `dist/rnsdk.cjs.js` — the compiled SDK file.

### 2.3 — Copy the built file into the demo app

```bash
cp dist/rnsdk.cjs.js ../basic-native-demo-app/lib/rnsdk.cjs.js
```

Now the demo app will use your newly built SDK.

---

## Part 3 — Set Up the Demo App (`basic-native-demo-app`)

### 3.1 — Install Node dependencies

```bash
cd basic-native-demo-app
npm install
```

This installs all packages listed in `package.json` into `node_modules/`.

### 3.2 — Install `react-native-dotenv`

> **If you are on the development branch, this package is missing from `package.json` and must be installed manually.**

Run:

```bash
npm install react-native-dotenv --save-dev
```

This package is what reads your `.env` file and makes `ACCESS_KEY` and `SECRET_ACCESS_KEY` available inside the app code.

### 3.3 — Configure `babel.config.js`

> **If you are on the development branch, the `babel.config.js` file is missing the plugin section and must be updated manually.**

Open `babel.config.js` and make sure it looks exactly like this:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['module:react-native-dotenv', {
      moduleName: '@env',
      path: '.env',
    }],
  ],
};
```

If it only has `presets` and no `plugins`, add the `plugins` section as shown above.

Without this, the `.env` file will not be read and `ACCESS_KEY` / `SECRET_ACCESS_KEY` will be `undefined` — the session token fetch will silently fail.

### 3.4 — Create the TypeScript types file for `@env`

> **If you are on the development branch, this file does not exist and must be created manually.**

Create a file named `env.d.ts` inside `basic-native-demo-app/`:

```ts
declare module '@env' {
  export const ACCESS_KEY: string;
  export const SECRET_ACCESS_KEY: string;
}
```

This tells TypeScript what variables to expect when you import from `@env`. Without it you may see TypeScript errors on the import line in `App.js`.

### 3.5 — Add `.env` to `.gitignore`

> **If you are on the development branch, `.env` is not in `.gitignore` — this is a security risk.**

Open `.gitignore` and add this line at the bottom:

```
.env
```

This prevents your Access Key and Secret Access Key from being accidentally committed to git and exposed to others.

### 3.6 — Create Your `.env` File (Access Keys)

The app needs your Samvyo credentials to get a session token before joining a room.

Create a file named `.env` inside `basic-native-demo-app/` (same level as `App.js`):

```
ACCESS_KEY=paste_your_access_key_here
SECRET_ACCESS_KEY=paste_your_secret_access_key_here
```

Get these two values from the **Samvyo dashboard**.

**Rules for this file:**
- Never commit this file to git
- Never share it with anyone
- You just added `.env` to `.gitignore` in the previous step so it is now protected

**How these keys flow through the app:**

```
.env file
  ACCESS_KEY=xxx
  SECRET_ACCESS_KEY=xxx
        │
        │  read by react-native-dotenv (babel plugin) at build time
        ▼
App.js
  import { ACCESS_KEY, SECRET_ACCESS_KEY } from '@env'
        │
        │  sent via axios POST
        ▼
https://test-api-v2.samvyo.com/api/siteSetting/sessionToken
  body: { roomId, accessKey, secretAccessKey }
        │
        │  returns
        ▼
  sessionToken (JWT)
        │
        ▼
samvyo.RNSdk.init({ sessionToken, roomId, peerName })
        │
        ▼
WebSocket connects → room is ready
```

In `App.js`, the keys are imported and used like this:

```js
// Import from .env (line 2)
import { ACCESS_KEY, SECRET_ACCESS_KEY } from '@env';

// Used in fetchSessionToken() to authenticate with Samvyo API
const response = await axios.post(
  'https://test-api-v2.samvyo.com/api/siteSetting/sessionToken',
  {
    roomId: roomId,
    accessKey: ACCESS_KEY,              // ← your key
    secretAccessKey: SECRET_ACCESS_KEY, // ← your secret key
  }
);
// Returns: { sessionToken: "eyJ..." }
```

The returned `sessionToken` is then passed to `RNSdk.init()` to connect to the room.

---

## Part 4 — Connect Your Android Phone and Run the App

### 4.1 — Enable Developer Mode on Your Phone

1. Open **Settings** on your Android phone
2. Scroll to **About Phone**
3. Find **Build Number** and tap it **7 times** quickly
4. You will see: *"You are now a developer!"*

### 4.2 — Enable USB Debugging

1. Go back to **Settings**
2. Open **Developer Options** (now visible, usually near the bottom of Settings)
3. Toggle **USB Debugging** to ON

### 4.3 — Connect Phone via USB Cable

Plug your phone into your laptop using a USB cable.

> Use a USB **data cable**, not just a charging cable.
> Some cables can only charge and cannot transfer data.
> If `adb devices` does not detect your phone, try a different cable.

When you connect:
- Your phone will show a popup: **"Allow USB Debugging?"**
- Tap **Allow**
- Check **"Always allow from this computer"** so it does not ask again

### 4.4 — Confirm Your Phone Is Detected

```bash
adb devices
```

Expected output:

```
List of devices attached
RF8M12345XY    device
```

The word `device` on the right means your phone is ready.

**Troubleshooting:**

| What you see | What to do |
|---|---|
| `unauthorized` | Unlock your phone and tap Allow on the USB Debugging popup |
| `offline` | Unplug and replug the USB cable, then run `adb kill-server && adb devices` |
| Nothing listed | Check the USB cable, try a different USB port |
| `adb: command not found` | Check that `ANDROID_HOME` is set correctly (Part 1.5) |

### 4.5 — Start the Metro Bundler

Metro is the JavaScript bundler for React Native. It watches your files and serves the JS bundle to your phone.

Open a terminal in the demo app folder:

```bash
cd basic-native-demo-app
npm start
```

**Keep this terminal open.** Metro must keep running the entire time you are using the app.

If you see a question like "Which platform?", press `a` for Android.

### 4.6 — Build and Install on Your Phone

Open a **second terminal** (keep Metro running in the first one):

```bash
cd basic-native-demo-app
npm run android
```

What happens:
1. Gradle compiles the Android native code — **takes 3–5 minutes on first run**
2. The `.apk` file is built and installed directly on your phone
3. The app launches automatically on your phone

You will see the Samvyo demo app open on your phone screen.

> **First build is slow.** Subsequent builds are much faster (20–40 seconds) because Gradle caches the compiled code.

---

## Part 5 — Using the App to Make a Call

Once the app is open on your phone, here is what to do:

### Step 5.1 — Enter a Room ID

You will see a text field labeled **Room ID**.
Type any name or number — for example: `testroom1`

> Both users must enter the **same Room ID** to join the same call.
> For testing alone: open the app on two phones, or ask someone else to join from another device using the same Room ID.

### Step 5.2 — Enter a Peer Name (optional)

Below the Room ID field there is a **Peer Name** field. It defaults to `peer-1`.
You can change it to your name so other participants can see who you are — for example: `saurav`

### Step 5.3 — Select Room Type and Role (optional)

The app shows dropdowns for **Room Type** and **Role**. The defaults work fine for basic testing:
- Room Type: `conferencing` (default)
- Role: `moderator` (default)

You do not need to change these to make a basic test call.

### Step 5.4 — Tap "Init Room"

This button:
1. Calls `fetchSessionToken()` — sends your Access Key + Secret Key to Samvyo API
2. Gets back a session token
3. Calls `RNSdk.init()` — opens the WebSocket connection to the Samvyo server

When the WebSocket connects successfully, the `initSuccess` event fires and the app shows the **"Join Room"** button.

### Step 5.5 — Tap "Join Room"

This button calls `joinRoom()` which starts the video call.

**Important — Camera and Microphone Permission Popups:**

The first time you tap "Join Room", Android will show two permission dialogs one after the other:

- *"Allow [app] to take pictures and record video?"* → tap **Allow**
- *"Allow [app] to record audio?"* → tap **Allow**

You **must** tap Allow on both. If you tap Deny, the camera or microphone will not work and the call will fail silently.

> If you accidentally tapped Deny:
> Go to phone **Settings** → **Apps** → find the app → **Permissions** → enable Camera and Microphone manually.

After granting permissions:
1. The SDK sends a join message over the WebSocket
2. The server responds with `existingParticipants`
3. The SDK creates mediasoup transports (the video/audio pipes)
4. Your camera and microphone turn on
5. You are now in the call

### Step 5.6 — Leave the Room

Tap the **"Leave Room"** button when done. This:
1. Closes the mediasoup transports
2. Sends a disconnect with close code `1000` (normal closure)
3. Stops camera and microphone
4. Returns to the home screen

---

## Part 6 — The Full Call Flow (What Happens Behind the Scenes)

```
App opens on phone
      │
      ▼
getAllDevices()
      Calls: samvyo.RNSdk.listDevices()
      Result: list of cameras and microphones found
      │
User types Room ID and taps "Init Room"
      │
      ▼
fetchSessionToken()
      Sends:  POST https://test-api-v2.samvyo.com/api/siteSetting/sessionToken
              body: { roomId, accessKey, secretAccessKey }
      Receives: sessionToken (a JWT)
      │
      ▼
samvyo.RNSdk.init({ sessionToken, roomId, peerName })
      SDK decodes the JWT to get the signaling server URL
      Opens WebSocket to: wss://[signaling-server]/?sessionToken=...
      WebSocketManager: state → "connecting"
      Heartbeat starts (ping every 22 seconds)
      WebSocketManager: state → "connected"
      SDK fires: 'initSuccess'
      App shows: "Join Room" button
      │
User taps "Join Room"
      │
      ▼
sdkInstance.joinRoom(roomParams)
      Sends over WebSocket: { id: "joinRoom", roomId, peerName, peerType, ... }
      Server responds: { id: "existingParticipants", routerRtpCapabilities, peers }
      │
      ▼
mediasoup.Device.load(routerRtpCapabilities)
      Device learns what codecs the server supports
      │
      ▼
_createSendTransport()   → pipe to send your mic and camera
_createRecvTransport()   → pipe to receive others
      │
      ▼
Camera and mic start streaming
SDK fires: 'newPeer', 'videoStart', 'micStart' for each person in the room
      │
[CALL IS LIVE]
      │
      ▼ (when network drops — e.g. entering elevator)
WebSocketManager heartbeat: ping sent → no pong in 5s
Force closes socket with code 4104 ("server unreachable during call")
scheduleReconnection() with exponential backoff
Retries: 1s → 2s → 4s → 8s → 16s → 30s (max)
On reconnect: restartIce on mediasoup transports → call resumes
      │
User taps "Leave Room"
      │
      ▼
sdkInstance.leaveRoom()
      WebSocketManager.disconnect(1000)  → no reconnect triggered
      Mediasoup transports closed
      Camera and mic stopped
      App resets to home screen
```

---

## Part 7 — When You Change SDK Code

Only needed if you modified files inside `react-native-sdk`.

```bash
# 1. Go to SDK repo and rebuild
cd react-native-sdk
npm run build

# 2. Copy new built file to demo app
cp dist/rnsdk.cjs.js ../basic-native-demo-app/lib/rnsdk.cjs.js

# 3. Restart Metro WITH cache cleared
#    (important — without --reset-cache, Metro may serve the old JS bundle)
cd ../basic-native-demo-app
npm start -- --reset-cache

# 4. Rebuild the app on your phone
npm run android
```

> **Why `--reset-cache`?**
> Metro caches the JS bundle for speed. When you copy a new `rnsdk.cjs.js`,
> Metro may not detect the change and keep serving the old version.
> The `--reset-cache` flag forces it to rebuild the bundle from scratch.

---

## Quick Reference

### Commands

| What to do | Command | Where to run |
|---|---|---|
| Install SDK dependencies | `npm install` | `react-native-sdk/` |
| Build the SDK | `npm run build` | `react-native-sdk/` |
| Install demo app dependencies | `npm install` | `basic-native-demo-app/` |
| Check phone is connected | `adb devices` | anywhere |
| Start Metro bundler | `npm start` | `basic-native-demo-app/` |
| Build and run on phone | `npm run android` | `basic-native-demo-app/` |

### Files That Matter

| File | What it does |
|---|---|
| `basic-native-demo-app/.env` | Holds your ACCESS_KEY and SECRET_ACCESS_KEY — create this yourself |
| `basic-native-demo-app/lib/rnsdk.cjs.js` | The built Samvyo SDK — already in the repo, replace only when SDK code changes |
| `basic-native-demo-app/App.js` | Main app file — all integration code lives here |
| `basic-native-demo-app/babel.config.js` | Configured to load `.env` via react-native-dotenv |
| `basic-native-demo-app/android/app/src/main/AndroidManifest.xml` | Android permissions — camera, mic, internet |
| `react-native-sdk/lib/RNSdk.js` | Main SDK source file — WebSocket + mediasoup logic |
| `react-native-sdk/lib/socket/lib/WebSocketManager.js` | WebSocket lifecycle — connect, heartbeat, reconnect |
| `react-native-sdk/dist/rnsdk.cjs.js` | Built output of the SDK — copy to demo app after rebuilding |

### Common Errors

| Error | Cause | Fix |
|---|---|---|
| `adb: command not found` | ANDROID_HOME not set | Add ANDROID_HOME to `~/.bashrc` (Part 1.5) |
| `unauthorized` in adb devices | USB Debugging popup not accepted | Unlock phone and tap Allow |
| `Could not fetch session token` | .env file missing or wrong keys | Check `.env` file in `basic-native-demo-app/` |
| `Metro bundler not running` | npm start was not run | Open a terminal and run `npm start` first |
| App shows white screen | Metro is not running or crashed | Restart `npm start` |
| Build fails on first run | Missing Android SDK components | Open Android Studio SDK Manager and install missing tools |
| Camera/mic not working after Join | Permission denied | Go to phone Settings → Apps → find app → Permissions → enable Camera and Microphone |
| SDK changes not reflected in app | Metro serving old cached bundle | Run `npm start -- --reset-cache` instead of `npm start` |
| `ACCESS_KEY` is undefined | `react-native-dotenv` not installed or `babel.config.js` missing plugins | Run `npm install react-native-dotenv --save-dev` and add the plugins section to `babel.config.js` (Part 3.2 and 3.3) |
| TypeScript error on `import from '@env'` | `env.d.ts` file missing | Create `env.d.ts` as shown in Part 3.4 |
| `.env` file shows in git status | `.env` not in `.gitignore` | Add `.env` to `.gitignore` as shown in Part 3.5 |
