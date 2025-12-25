---
description: Learn how to use external API integrations with Kodivian
---

# Interacting with API

***

The OpenAPI Specification (OAS) defines a standard, language-agnostic interface to HTTP APIs. The goal of this use case is to have the LLM automatically figure out which API to call, while still having a stateful conversation with user.

## Tool Agent + OpenAPI Toolkit

In order to solve the above error, we can use Agent. From the official cookbook by OpenAI: [Function calling with an OpenAPI specification](https://cookbook.openai.com/examples/function_calling_with_an_openapi_spec), it is recommended to convert each API into a tool itself, instead of feeding all the APIs into LLM as single message. An agent is also capable of having human-like interaction, with the ability to decide which tool to use depending on user's query.

OpenAPI Toolkit will converts each of the API from YAML file into a set of tools. This way, users don't have to create a [Custom Tool](../integrations/langchain/tools/custom-tool.md) for each API.

1. Connect **ToolAgent** with **OpenAPI Toolkit**. Here, we upload the YAML spec for OpenAI API. The spec file can be found at the bottom of the page.

<figure><img src=".././assets/image (25).png" alt=""><figcaption></figcaption></figure>

2. Let's try it!

<figure><img src=".././assets/image (1) (1) (1) (1) (1) (1) (2).png" alt=""><figcaption></figcaption></figure>

As you can noticed from the chat, the agent is capable of carrying out normal conversation, and use appropriate tool to answer user query. If you are using Analytic Tool, you can see the list of tools we converted from the YAML file:

<figure><img src=".././assets/image (2) (1) (1) (1) (1) (1) (2) (1).png" alt=""><figcaption></figcaption></figure>

## Conclusion

We've successfully created an agent that can interact with API when necessary, and still be able handle stateful conversations with users. Below are the templates used in this section:

{% file src=".././assets/OpenAPI Toolkit with ToolAgent Chatflow.json" %}

{% file src=".././assets/openai_openapi.yaml" %}
