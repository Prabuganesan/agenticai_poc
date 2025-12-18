# Fetch Links

**GET** `/fetch-links`

Fetch links from a URL.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `url` | string | Yes | The URL to fetch links from. |
| `relativeLinksMethod` | string | Yes | Method to handle relative links (e.g., webCrawling, scraping). |
| `limit` | string | Yes | Limit the number of links to fetch. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Links fetched successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "links": [
    "https://example.com/page1",
    "https://example.com/page2"
  ]
}
```

