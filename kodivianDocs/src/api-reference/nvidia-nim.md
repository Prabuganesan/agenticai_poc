# Nvidia NIM

**GET** `/nvidia-nim/preload`

Preload NIM.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | NIM preloaded successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```
Preloaded NIM
```

---

**GET** `/nvidia-nim/get-token`

Get Nvidia token.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Token retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

---

**GET** `/nvidia-nim/download-installer`

Download NIM installer.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Installer downloaded successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```
NIM Installer completed successfully!
```

---

**GET** `/nvidia-nim/list-running-containers`

List running NIM containers.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Containers listed successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": "container_123",
    "image": "nvcr.io/nvidia/nim:latest",
    "status": "running",
    "port": 8000
  }
]
```

---

**POST** `/nvidia-nim/pull-image`

Pull NIM image.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `imageTag` | string | Yes | The tag of the image to pull. |
| `apiKey` | string | Yes | The API key for Nvidia NGC. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Image pull started successfully |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "imageTag": "nvcr.io/nvidia/nim:latest",
  "apiKey": "nvapi-..."
}
```

### Response (200)

```
Pulling image nvcr.io/nvidia/nim:latest
```

---

**POST** `/nvidia-nim/start-container`

Start NIM container.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `imageTag` | string | Yes | The tag of the image to start. |
| `apiKey` | string | Yes | The API key for Nvidia NGC. |
| `hostPort` | number | Yes | The host port to bind. |
| `nimRelaxMemConstraints` | number | Yes | 0 or 1. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Container start initiated successfully |
| **400** | Invalid input |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "imageTag": "nvcr.io/nvidia/nim:latest",
  "apiKey": "nvapi-...",
  "hostPort": 8000,
  "nimRelaxMemConstraints": 1
}
```

### Response (200)

```
Starting container nvcr.io/nvidia/nim:latest
```

---

**POST** `/nvidia-nim/stop-container`

Stop NIM container.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `containerId` | string | Yes | The ID of the container to stop. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Container stopped successfully |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "containerId": "container_123"
}
```

### Response (200)

```json
{
  "id": "container_123",
  "status": "stopped"
}
```

---

**POST** `/nvidia-nim/get-image`

Get NIM image details.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `imageTag` | string | Yes | The tag of the image. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Image details retrieved successfully |
| **404** | Image not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "imageTag": "nvcr.io/nvidia/nim:latest"
}
```

### Response (200)

```json
{
  "tag": "nvcr.io/nvidia/nim:latest",
  "name": "Nvidia NIM",
  "size": 1024
}
```

---

**POST** `/nvidia-nim/get-container`

Get NIM container details.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `imageTag` | string | Yes | The tag of the image. |
| `port` | number | Yes | The port of the container. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Container details retrieved successfully |
| **404** | Container not found |
| **409** | Port in use by another container |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "imageTag": "nvcr.io/nvidia/nim:latest",
  "port": 8000
}
```

### Response (200)

```json
{
  "id": "container_123",
  "image": "Nvidia NIM",
  "status": "running",
  "port": 8000
}
```

