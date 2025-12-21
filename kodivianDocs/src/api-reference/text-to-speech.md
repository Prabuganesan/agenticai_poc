# Text To Speech

**POST** `/text-to-speech/generate`

Generate text to speech.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `text` | string | Yes | The text to convert to speech. |
| `chatId` | string | No | The ID of the chat session. |
| `chatflowId` | string | No | The ID of the chatflow. |
| `chatMessageId` | string | No | The ID of the chat message. |
| `provider` | string | No | The TTS provider (e.g., openai, elevenlabs). |
| `credentialId` | string | No | The ID of the credential to use. |
| `voice` | string | No | The voice to use. |
| `model` | string | No | The model to use. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Audio stream generated successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "text": "Hello, how are you?",
  "provider": "openai",
  "credentialId": "cred-123",
  "voice": "alloy",
  "model": "tts-1"
}
```

### Response (200)

Audio stream (text/event-stream).

---

**POST** `/text-to-speech/abort`

Abort text to speech generation.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | string | Yes | The ID of the chat session. |
| `chatMessageId` | string | Yes | The ID of the chat message. |
| `chatflowId` | string | Yes | The ID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | TTS aborted successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatId": "session-123",
  "chatMessageId": "msg-123",
  "chatflowId": "flow-123"
}
```

### Response (200)

```json
{
  "message": "TTS stream aborted successfully",
  "chatId": "session-123",
  "chatMessageId": "msg-123"
}
```

---

**GET** `/text-to-speech/voices`

Get available voices for a provider.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `provider` | string | Yes | The TTS provider. |
| `credentialId` | string | No | The ID of the credential to use. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Voices retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": "alloy",
    "name": "Alloy"
  },
  {
    "id": "echo",
    "name": "Echo"
  }
]
```

