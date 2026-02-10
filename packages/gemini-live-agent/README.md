# Gemini Live Agent

AI-powered collaborative editing for WordPress using Google's Gemini Live API.

## Overview

This package integrates the Gemini Live API with the WordPress block editor, enabling an AI assistant that can:

- **See your screen** via screen sharing
- **Listen and speak** via audio input/output
- **Edit your document** using the WordPress Abilities API
- **Create notes** for collaborative feedback

The agent operates through the collaborative editing system, meaning changes sync in real-time with other users editing the same document.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  ┌─────────────────────┐    ┌──────────────────────────────┐   │
│  │  Gutenberg Editor   │◄──►│  Collaborative Editing Sync  │   │
│  │  (Screen shared)    │    │  (HTTP Polling / Yjs)        │   │
│  └─────────────────────┘    └──────────────────────────────┘   │
│           │                              ▲                      │
│           ▼ screen stream                │ @wordpress/data      │
│  ┌─────────────────────┐                 │ dispatches           │
│  │  GeminiBridge       │─────────────────┘                      │
│  │  (WebSocket)        │                                        │
│  │  - Screen frames    │                                        │
│  │  - Audio I/O        │                                        │
│  │  - Function calls   │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │  Abilities API      │                                        │
│  │  - Insert blocks    │                                        │
│  │  - Update blocks    │                                        │
│  │  - Create notes     │                                        │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │  Gemini Live API    │
        │  (Google Cloud)     │
        └─────────────────────┘
```

## Installation

```bash
npm install @wordpress/gemini-live-agent
```

## Quick Start

### 1. Register Abilities

Call this once during your plugin/application initialization:

```typescript
import { registerAllAgentAbilities } from '@wordpress/gemini-live-agent';

// Register all AI agent abilities
registerAllAgentAbilities();
```

### 2. Use the Pre-built Panel

```tsx
import { AIAssistantPanel } from '@wordpress/gemini-live-agent';

function MyEditorSidebar() {
  return (
    <AIAssistantPanel
      apiKey="your-gemini-api-key"
      model="gemini-2.5-flash-native-audio-preview-12-2025"
    />
  );
}
```

### 3. Or Use the Hook for Custom UI

```tsx
import { useGeminiAgent } from '@wordpress/gemini-live-agent';

function CustomAIPanel() {
  const {
    connectionState,
    isScreenSharing,
    isAudioEnabled,
    error,
    connect,
    disconnect,
    startScreenShare,
    stopScreenShare,
    startAudio,
    stopAudio,
    sendMessage,
  } = useGeminiAgent({
    apiKey: 'your-gemini-api-key',
    onModelResponse: (text) => {
      console.log('AI said:', text);
    },
    onFunctionCall: (call) => {
      console.log('AI executed:', call.name);
    },
  });

  return (
    <div>
      <button onClick={connect}>Connect</button>
      <button onClick={startScreenShare}>Share Screen</button>
      <button onClick={() => sendMessage('Hello!')}>Say Hello</button>
    </div>
  );
}
```

## Available Abilities

The agent can execute these abilities (registered via the WordPress Abilities API):

### Block Operations

| Ability | Description |
|---------|-------------|
| `agent/insert-block` | Insert a new block at a specified position |
| `agent/update-block` | Update attributes of an existing block |
| `agent/remove-block` | Remove a block from the document |
| `agent/select-block` | Select a block by its client ID |
| `agent/get-document-context` | Get the current document structure |

### Note Operations

| Ability | Description |
|---------|-------------|
| `agent/create-note` | Create a note/comment on a block |
| `agent/reply-to-note` | Reply to an existing note thread |
| `agent/resolve-note` | Mark a note as resolved |
| `agent/get-notes` | Get all notes for the document |

## API Reference

### `useGeminiAgent(options)`

React hook for managing the Gemini Live connection.

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your Gemini API key |
| `model` | `string` | No | Model to use (default: `gemini-2.5-flash-native-audio-preview-12-2025`) |
| `systemInstruction` | `string` | No | Custom system prompt |
| `responseModality` | `'AUDIO' \| 'TEXT'` | No | Response modality (default: `AUDIO`) |
| `voiceName` | `string` | No | Prebuilt voice name for audio responses |
| `abilityCategories` | `string[]` | No | Ability categories to expose to the model |
| `serverAbilitiesTimeoutMs` | `number` | No | Wait time for server abilities to register |
| `onModelResponse` | `(text: string) => void` | No | Callback for text responses |
| `onAudioResponse` | `(audioData: ArrayBuffer) => void` | No | Callback for audio responses |
| `onFunctionCall` | `(call: GeminiFunctionCall) => void` | No | Callback for function calls |
| `onError` | `(error: Error) => void` | No | Callback for errors |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `connectionState` | `ConnectionState` | `'disconnected' \| 'connecting' \| 'connected' \| 'error'` |
| `isScreenSharing` | `boolean` | Whether screen sharing is active |
| `isAudioEnabled` | `boolean` | Whether audio input is active |
| `error` | `string \| null` | Last error message |
| `connect` | `() => Promise<void>` | Connect to Gemini |
| `disconnect` | `() => void` | Disconnect |
| `startScreenShare` | `() => Promise<void>` | Start screen sharing |
| `stopScreenShare` | `() => void` | Stop screen sharing |
| `startAudio` | `() => Promise<void>` | Start audio input |
| `stopAudio` | `() => void` | Stop audio input |
| `sendMessage` | `(text: string) => void` | Send a text message |

### `GeminiBridge`

Low-level class for direct WebSocket control.

```typescript
import { createGeminiBridge } from '@wordpress/gemini-live-agent';

const bridge = createGeminiBridge({
  apiKey: 'your-api-key',
  model: 'gemini-2.5-flash-native-audio-preview-12-2025',
  systemInstruction: 'You are a helpful assistant...',
});

bridge.setEventHandlers({
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected'),
  onModelResponse: (text) => console.log('Response:', text),
  onFunctionCall: (call) => console.log('Function:', call),
});

await bridge.connect();
bridge.sendTextMessage('Hello!');
bridge.sendVideoFrame(base64ImageData, 'image/jpeg');
bridge.sendAudioChunk(pcmAudioData);
bridge.disconnect();
```

### `ScreenCapture`

Handles screen sharing and frame extraction.

```typescript
import { createScreenCapture } from '@wordpress/gemini-live-agent';

const capture = createScreenCapture({
  frameRate: 1, // FPS
  imageQuality: 0.7, // JPEG quality
});

capture.setBridge(bridge);
await capture.start();
// Frames are automatically sent to the bridge
capture.stop();
```

### `AudioCapture`

Handles microphone input.

```typescript
import { createAudioCapture } from '@wordpress/gemini-live-agent';

const audio = createAudioCapture();
audio.setBridge(bridge);
await audio.start();
// Audio chunks are automatically sent to the bridge
audio.setMuted(true); // Mute
audio.stop();
```

## Custom System Instructions

You can customize the AI's behavior with a system instruction:

```typescript
const agent = useGeminiAgent({
  apiKey: 'your-api-key',
  systemInstruction: `
    You are a WordPress content editor assistant.

    When the user asks you to make changes:
    1. First use get-document-context to understand the current state
    2. Make precise edits using the block manipulation abilities
    3. Always explain what you're doing

    Focus on:
    - Improving content structure
    - Fixing formatting issues
    - Adding helpful notes for reviewers
  `,
});
```

## Security Considerations

1. **API Key Protection**: Never expose your Gemini API key in client-side code in production. Use a server-side proxy.

2. **Screen Sharing Consent**: The browser will always ask for user permission before screen sharing starts.

3. **Permissions**: The abilities respect WordPress capabilities - the AI can only do what the current user can do.

## Requirements

- WordPress 6.5+
- Gutenberg with collaborative editing enabled
- Modern browser with WebSocket and MediaDevices API support
- Gemini API key with Live API access

## License

GPL-2.0-or-later
