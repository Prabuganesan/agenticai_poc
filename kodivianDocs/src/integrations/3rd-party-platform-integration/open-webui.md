# Open WebUI

[Open WebUI](https://github.com/open-webui/open-webui) is an extensible, feature-rich, and user-friendly _self-hosted AI platform_ designed to operate entirely offline.

[Functions](https://docs.openwebui.com/features/plugin/functions/) are like plugins for Open WebUI. We can create a custom [Pipe Function](https://docs.openwebui.com/features/plugin/functions/pipe) that process inputs and generate responses by invoking Autonomous Prediction API before returning results to the user. Through this, Autonomous can be used in Open WebUI.

## Setup

1. First, have Open WebUI up and running, you can refer to the [Quickstart](https://docs.openwebui.com/getting-started/quick-start/) guide. From the left bottom, click your profile and **Admin Panel**

<figure><img src="../.././assets/image (4) (1).png" alt="" width="235"><figcaption></figcaption></figure>

2. Open **Functions** tab, and add a new Function.

<figure><img src="../.././assets/image (1) (1) (1) (1).png" alt="" width="423"><figcaption></figcaption></figure>

3. Name the Function, and add the following code:

```python
"""
title: Autonomous Integration for OpenWebUI
Requirements:
  - Autonomous API URL (set via Autonomous_API_URL)
  - Autonomous API Key (set via Autonomous_API_KEY)
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Union, Generator, Iterator
import requests
import json
import os


class Pipe:
    class Valves(BaseModel):
        Autonomous_url: str = Field(
            default=os.getenv("Autonomous_API_URL", ""),
            description="Autonomous URL",
        )
        Autonomous_api_key: str = Field(
            default=os.getenv("Autonomous_API_KEY", ""),
            description="Autonomous API key for authentication",
        )

    def __init__(self):
        self.type = "manifold"
        self.id = "Autonomous_chat"
        self.valves = self.Valves()

        # Validate required settings
        if not self.valves.Autonomous_url:
            print(
                "⚠️ Please set your Autonomous URL using the Autonomous_API_URL environment variable"
            )
        if not self.valves.Autonomous_api_key:
            print(
                "⚠️ Please set your Autonomous API key using the Autonomous_API_KEY environment variable"
            )

    def pipes(self):
        if self.valves.Autonomous_api_key and self.valves.Autonomous_url:
            try:
                headers = {
                    "Authorization": f"Bearer {self.valves.Autonomous_api_key}",
                    "Content-Type": "application/json",
                }

                r = requests.get(
                    f"{self.valves.Autonomous_url}/api/v1/chatflows?type=AGENTFLOW",
                    headers=headers,
                )
                models = r.json()
                return [
                    {
                        "id": model["id"],
                        "name": model["name"],
                    }
                    for model in models
                ]

            except Exception as e:
                return [
                    {
                        "id": "error",
                        "name": str(e),
                    },
                ]
        else:
            return [
                {
                    "id": "error",
                    "name": "API Key not provided.",
                },
            ]

    def _process_message_content(self, message: dict) -> str:
        """Process message content, handling text for now"""
        if isinstance(message.get("content"), list):
            processed_content = []
            for item in message["content"]:
                if item["type"] == "text":
                    processed_content.append(item["text"])
            return " ".join(processed_content)
        return message.get("content", "")

    def pipe(
        self, body: dict, __user__: Optional[dict] = None, __metadata__: dict = None
    ):
        try:
            stream_enabled = body.get("stream", True)
            session_id = (__metadata__ or {}).get("chat_id") or "owui-session"
            # model can be "Autonomous.<id>" or just "<id>"
            model_name = body.get("model", "")
            dot = model_name.find(".")
            model_id = model_name[dot + 1 :] if dot != -1 else model_name

            messages = body.get("messages") or []
            if not messages:
                raise Exception("No messages found in request body")
            question = self._process_message_content(messages[-1])

            data = {
                "question": question,
                "overrideConfig": {"sessionId": session_id},
                "streaming": stream_enabled,
            }

            headers = {
                "Authorization": f"Bearer {self.valves.Autonomous_api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream" if stream_enabled else "application/json",
            }

            url = f"{self.valves.Autonomous_url}/api/v1/prediction/{model_id}"
            with requests.post(
                url, json=data, headers=headers, stream=stream_enabled, timeout=60
            ) as r:
                r.raise_for_status()

                if stream_enabled:
                    # Ensure correct decoding for SSE (prevents â€™ etc.)
                    r.encoding = "utf-8"

                    for raw_line in r.iter_lines(decode_unicode=True):
                        if not raw_line:
                            continue
                        line = raw_line.strip()

                        # Skip keep-alives or non-data fields
                        if not line.startswith("data:"):
                            continue

                        payload = line[5:].strip()
                        if payload in ("[DONE]", '"[DONE]"'):
                            break

                        # Autonomous usually sends {"event":"token","data":"..."}
                        try:
                            obj = json.loads(payload)
                        except json.JSONDecodeError:
                            # Occasionally plain text arrives—stream it anyway
                            if payload:
                                yield payload
                            continue

                        if isinstance(obj, dict):
                            if obj.get("event") == "token":
                                token = obj.get("data") or ""
                                if token:
                                    yield token
                            else:
                                # Some versions send {"data":{"text":"..."}}
                                data_field = obj.get("data")
                                if isinstance(data_field, dict):
                                    text = data_field.get("text")
                                    if text:
                                        yield text
                    return  # end streaming

                # Non-streaming fallback
                resp = r.json()
                return (
                    resp.get("text") or (resp.get("data") or {}).get("text", "") or ""
                )

        except requests.HTTPError as http_err:
            try:
                detail = http_err.response.text[:500]
            except Exception:
                detail = ""
            return f"HTTP error from Autonomous: {http_err.response.status_code} {detail}"
        except Exception as e:
            return f"Error in Autonomous pipe: {e}"
```

4. After Function has been saved, enable it, and click the settings button to put in your Autonomous URL and Autonomous API Key:

<figure><img src="../.././assets/image (2) (1) (1) (1).png" alt="" width="563"><figcaption></figcaption></figure>

<figure><img src="../.././assets/image (3) (1) (1).png" alt="" width="431"><figcaption></figcaption></figure>

5. Now when you refresh and click New Chat, you will be able to see the list of flows. You can modify the code to show:

* Only Agentflows V2: `f"{self.valves.Autonomous_url}/api/v1/chatflows?type=AGENTFLOW"`
* Only Chatflows: `f"{self.valves.Autonomous_url}/api/v1/chatflows?type=CHATFLOW"`
* Only Assistants: `f"{self.valves.Autonomous_url}/api/v1/chatflows?type=ASSISTANT"`

<figure><img src="../.././assets/image (4) (1) (1).png" alt=""><figcaption></figcaption></figure>

6. Test:

<figure><img src="../.././assets/image (5) (1).png" alt=""><figcaption></figcaption></figure>
