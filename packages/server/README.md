<!-- markdownlint-disable MD030 -->

# Autonomous


<h3>Build AI Agents, Visually</h3>

![Autonomous](https://github.com/autonomous/autonomous/blob/main/images/autonomous_agentflow.gif?raw=true)

## ⚡Quick Start

1. Install Autonomous
    ```bash
    npm install -g autonomous
    ```
2. Start Autonomous

    ```bash
    npx autonomous start
    ```

3. Open [http://localhost:3030](http://localhost:3030)

## 🌱 Env Variables

Autonomous support different environment variables to configure your instance. You can specify the following variables in the `.env` file inside `packages/server` folder. See the `.env.example` file for available options.

You can also specify the env variables when using `npx`. For example:

```
npx autonomous start --PORT=3030 --DEBUG=true
```

## 📖 Tests

We use [Cypress](https://github.com/cypress-io) for our e2e testing. If you want to run the test suite in dev mode please follow this guide:

```sh
cd autonomous/packages/server
pnpm install
./node_modules/.bin/cypress install
pnpm build
#Only for writing new tests on local dev -> pnpm run cypress:open
pnpm run e2e
```

## 📖 Documentation

[Autonomous Docs](https://docs.autonomous.ai/)

## 🌐 Self Host

-   [AWS](https://docs.autonomous.ai/deployment/aws)
-   [Azure](https://docs.autonomous.ai/deployment/azure)
-   [Digital Ocean](https://docs.autonomous.ai/deployment/digital-ocean)
-   [GCP](https://docs.autonomous.ai/deployment/gcp)
-   <details>
      <summary>Others</summary>

    -   [Railway](https://docs.autonomous.ai/deployment/railway)

        [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/pn4G8S?referralCode=WVNPD9)

    -   [Render](https://docs.autonomous.ai/deployment/render)

        [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://docs.autonomous.ai/deployment/render)

    -   [HuggingFace Spaces](https://docs.autonomous.ai/deployment/hugging-face)

        <a href="https://huggingface.co/spaces/autonomous/autonomous"><img src="https://huggingface.co/datasets/huggingface/badges/raw/main/open-in-hf-spaces-sm.svg" alt="HuggingFace Spaces"></a>

    -   [Elestio](https://elest.io/open-source/autonomous)

        [![Deploy on Elestio](https://elest.io/images/logos/deploy-to-elestio-btn.png)](https://elest.io/open-source/autonomous)

    -   [Sealos](https://cloud.sealos.io/?openapp=system-template%3FtemplateName%3Dautonomous)

        [![](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://cloud.sealos.io/?openapp=system-template%3FtemplateName%3Dautonomous)

    -   [RepoCloud](https://repocloud.io/details/?app_id=29)

        [![Deploy on RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploy.png)](https://repocloud.io/details/?app_id=29)

      </details>

## ☁️ Autonomous Cloud

[Get Started with Autonomous Cloud](https://chainsys.com/)

## 🙋 Support

Feel free to ask any questions, raise problems, and request new features in [discussion](https://github.com/autonomous/autonomous/discussions)


## 📄 License

Source code in this repository is made available under the [Apache License Version 2.0](LICENSE.md).
