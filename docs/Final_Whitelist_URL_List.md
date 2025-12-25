# Kodivian AI Platform - External URL Whitelist

## Format Explanation

This document is organized in **grouped format** for IT teams:
- **Wildcard domains** (`*.example.com`) are listed first
- **Specific subdomains** are listed under each wildcard with `-` prefix
- If your firewall/proxy supports wildcards, allow the wildcard pattern
- If your firewall/proxy only supports specific URLs, allow the individual subdomains listed

---

## Wildcard Domains with Subdomains

### `*.amazonaws.com`
**Purpose**: AWS services (Bedrock, S3, etc.)

**Specific URLs:**
- `bedrock-runtime.us-east-1.amazonaws.com`
- `bedrock-runtime.us-west-2.amazonaws.com`
- `bedrock-runtime.*.amazonaws.com` (all regions)
- `s3.amazonaws.com`
- `s3.us-east-1.amazonaws.com`
- `s3.us-west-2.amazonaws.com`
- `s3.eu-west-1.amazonaws.com`
- `*.s3.amazonaws.com` (all S3 buckets)

---

### `*.anthropic.com`
**Purpose**: Anthropic Claude API

**Specific URLs:**
- `api.anthropic.com`
- `docs.anthropic.com`

---

### `*.cerebras.ai`
**Purpose**: Cerebras AI models

**Specific URLs:**
- `api.cerebras.ai`

---

### `*.cloudflare.docker.com`
**Purpose**: Docker CDN

**Specific URLs:**
- `production.cloudflare.docker.com`

---

### `*.deepseek.com`
**Purpose**: Deepseek models

**Specific URLs:**
- `api.deepseek.com`

---

### `*.docker.io`
**Purpose**: Docker Hub registry

**Specific URLs:**
- `registry-1.docker.io`
- `auth.docker.io`

---

### `*.eu-west-1.aws.endpoints.huggingface.cloud`
**Purpose**: Hugging Face private endpoints (AWS)

**Specific URLs:**
- `*.eu-west-1.aws.endpoints.huggingface.cloud` (region-specific)

---

### `*.firecrawl.dev`
**Purpose**: FireCrawl document loader service

**Specific URLs:**
- `api.firecrawl.dev`
- `firecrawl.dev`

---

### `*.fireworks.ai`
**Purpose**: Fireworks AI models

**Specific URLs:**
- `api.fireworks.ai`

---

### `*.github.com`
**Purpose**: GitHub (documentation and resources)

**Specific URLs:**
- `github.com`
- `raw.githubusercontent.com`

---

### `*.googleapis.com`
**Purpose**: Google Cloud services and APIs

**Specific URLs:**
- `generativelanguage.googleapis.com` (Gemini API)
- `storage.googleapis.com` (Google Cloud Storage)
- `ai.google.dev` (Google AI documentation)

---

### `*.huggingface.co`
**Purpose**: Hugging Face model hosting

**Specific URLs:**
- `huggingface.co`
- `*.huggingface.co` (all subdomains)

---

### `*.langfuse.com`
**Purpose**: Langfuse observability platform

**Specific URLs:**
- `cloud.langfuse.com`

---

### `*.npmjs.org`
**Purpose**: NPM package registry

**Specific URLs:**
- `registry.npmjs.org`

---

### `*.openai.azure.com`
**Purpose**: Azure OpenAI services

**Specific URLs:**
- `*.openai.azure.com` (region-specific, e.g., `your-resource.openai.azure.com`)

---

### `*.openai.com`
**Purpose**: OpenAI API

**Specific URLs:**
- `api.openai.com`

---

### `*.pinecone.io`
**Purpose**: Pinecone vector database

**Specific URLs:**
- `*.pinecone.io` (environment-specific, e.g., `your-index.pinecone.io`)

---

### `*.posthog.com`
**Purpose**: PostHog analytics (optional, can be disabled)

**Specific URLs:**
- `app.posthog.com`

**Note**: Can be disabled with `DISABLE_KODIVIAN_TELEMETRY=true`

---

### `*.qdrant.io`
**Purpose**: Qdrant vector database (cloud)

**Specific URLs:**
- `*.qdrant.io` (project-specific, e.g., `your-cluster.qdrant.io`)
- `qdrant.tech` (documentation)

---

### `*.replicate.com`
**Purpose**: Replicate ML model hosting

**Specific URLs:**
- `api.replicate.com`
- `replicate.com`

---

### `*.s3.amazonaws.com`
**Purpose**: AWS S3 storage (specific buckets)

**Specific URLs:**
- `s3.amazonaws.com`
- `s3.us-east-1.amazonaws.com`
- `s3.us-west-2.amazonaws.com`
- `s3.eu-west-1.amazonaws.com`
- `*.s3.amazonaws.com` (all S3 buckets)

---

### `*.sambanova.ai`
**Purpose**: SambaNova AI models

**Specific URLs:**
- `api.sambanova.ai`

---

### `*.supabase.co`
**Purpose**: Supabase database and vector store

**Specific URLs:**
- `*.supabase.co` (project-specific, e.g., `your-project.supabase.co`)

---

### `*.upstash.io`
**Purpose**: Upstash serverless Redis

**Specific URLs:**
- `*.upstash.io` (custom URL, e.g., `your-redis.upstash.io`)

---

### `*.vectara.io`
**Purpose**: Vectara neural search platform

**Specific URLs:**
- `api.vectara.io`
- `docs.vectara.com`
- `vectara.com`

---

### `*.weaviate.cloud`
**Purpose**: Weaviate vector database (cloud)

**Specific URLs:**
- `*.weaviate.cloud` (cluster-specific, e.g., `your-cluster.weaviate.cloud`)

---

### `*.zep.cloud`
**Purpose**: Zep long-term memory store

**Specific URLs:**
- `*.zep.cloud` (custom URL, e.g., `your-instance.zep.cloud`)

---

## Standalone URLs (No Wildcard Pattern)

These URLs don't have a wildcard pattern and must be allowed individually:

### LLM Provider APIs

- `api.cometapi.com` - Comet API
- `api.js.langchain.com` - LangChain JS API
- `api.mem0.ai` - Mem0 AI memory service
- `api.open-meteo.com` - Open Meteo weather API (example)
- `api.openrouter.ai` - OpenRouter API
- `api.x.ai` - xAI (Grok) API
- `integrate.api.nvidia.com` - NVIDIA NIM API
- `litellm.ai` - LiteLLM proxy service

### Package Registries

- `registry.yarnpkg.com` - Yarn package registry (if using Yarn)

### Container Registries

- `ghcr.io` - GitHub Container Registry

### Documentation & Resources

- `js.langchain.com` - LangChain JS documentation
- `python.langchain.com` - LangChain Python documentation
- `milvus.io` - Milvus documentation (self-hosted, no external URL needed)


**After installation, can run fully air-gapped**

---

## Notes

1. **Wildcard Support**: If your firewall/proxy supports wildcards, allowing `*.example.com` covers all subdomains listed under it.

2. **Specific URLs Only**: If your firewall/proxy doesn't support wildcards, allow each specific URL listed with `-` prefix.

3. **Regional Variations**: AWS and Azure services use region-specific domains. The wildcards cover these variations.

4. **Port 443 Only**: All services use HTTPS on port 443 by default.


---

## Complete Alphabetical List (For Copy-Paste)

### Full URLs
```
- ai.google.dev
- api.anthropic.com
- api.cerebras.ai
- api.cometapi.com
- api.deepseek.com
- api.firecrawl.dev
- api.fireworks.ai
- api.js.langchain.com
- api.mem0.ai
- api.open-meteo.com
- api.openai.com
- api.openrouter.ai
- api.replicate.com
- api.sambanova.ai
- api.vectara.io
- api.x.ai
- app.posthog.com
- auth.docker.io
- bedrock-runtime.*.amazonaws.com
- cloud.langfuse.com
- docs.anthropic.com
- docs.vectara.com
- eastus.api.cognitive.microsoft.com
- firecrawl.dev
- generativelanguage.googleapis.com
- ghcr.io
- github.com
- huggingface.co
- integrate.api.nvidia.com
- js.langchain.com
- litellm.ai
- milvus.io
- openrouter.ai
- production.cloudflare.docker.com
- python.langchain.com
- qdrant.tech
- raw.githubusercontent.com
- registry-1.docker.io
- registry.npmjs.org
- registry.yarnpkg.com
- replicate.com
- s3.amazonaws.com
- storage.googleapis.com
- vectara.com
- westus.api.cognitive.microsoft.com
```

### Wildcard Domains
```
- *.amazonaws.com
- *.anthropic.com
- *.cerebras.ai
- *.cloudflare.docker.com
- *.deepseek.com
- *.docker.io
- *.eu-west-1.aws.endpoints.huggingface.cloud
- *.firecrawl.dev
- *.fireworks.ai
- *.github.com
- *.googleapis.com
- *.huggingface.co
- *.langfuse.com
- *.npmjs.org
- *.openai.azure.com
- *.openai.com
- *.pinecone.io
- *.posthog.com
- *.qdrant.io
- *.replicate.com
- *.s3.amazonaws.com
- *.sambanova.ai
- *.supabase.co
- *.upstash.io
- *.vectara.io
- *.weaviate.cloud
- *.zep.cloud
```

---

**Document Version**: 2.0  
**Last Updated**: 2025-12-11  
**Format**: Grouped (Wildcard + Specific URLs)
