<!-- markdownlint-disable MD030 -->

# Kodivian


<h3>Build AI Agents, Visually</h3>

![Kodivian](https://github.com/kodivian/kodivian/blob/main/images/kodivian_agentflow.gif?raw=true)

## ⚡Quick Start

1. Install Kodivian
    ```bash
    npm install -g kodivian
    ```
2. Start Kodivian

    ```bash
    npx kodivian start
    ```

3. Open [http://localhost:3030](http://localhost:3030)

## 🌱 Env Variables

Kodivian support different environment variables to configure your instance. You can specify the following variables in the `.env` file inside `packages/server` folder. See the `.env.example` file for available options.

You can also specify the env variables when using `npx`. For example:

```
npx kodivian start --PORT=3030 --DEBUG=true
```

## 📖 Tests

We use [Cypress](https://github.com/cypress-io) for our e2e testing. If you want to run the test suite in dev mode please follow this guide:

```sh
cd kodivian/packages/server
pnpm install
./node_modules/.bin/cypress install
pnpm build
#Only for writing new tests on local dev -> pnpm run cypress:open
pnpm run e2e
```

## 📖 Documentation

[Kodivian Docs](https://docs.kodivian.com/)

## 🌐 Self Host

-   [AWS](https://docs.kodivian.com/deployment/aws)
-   [Azure](https://docs.kodivian.com/deployment/azure)
-   [Digital Ocean](https://docs.kodivian.com/deployment/digital-ocean)
-   [GCP](https://docs.kodivian.com/deployment/gcp)
-   <details>
      <summary>Others</summary>

    -   [Railway](https://docs.kodivian.com/deployment/railway)

        [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/pn4G8S?referralCode=WVNPD9)

    -   [Render](https://docs.kodivian.com/deployment/render)

        [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://docs.kodivian.com/deployment/render)

    -   [HuggingFace Spaces](https://docs.kodivian.com/deployment/hugging-face)

        <a href="https://huggingface.co/spaces/kodivian/kodivian"><img src="https://huggingface.co/datasets/huggingface/badges/raw/main/open-in-hf-spaces-sm.svg" alt="HuggingFace Spaces"></a>

    -   [Elestio](https://elest.io/open-source/kodivian)

        [![Deploy on Elestio](https://elest.io/images/logos/deploy-to-elestio-btn.png)](https://elest.io/open-source/kodivian)

    -   Sealos

        [![](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://cloud.sealos.io/?openapp=system-template%3FtemplateName%3Dkodivian)

    -   [RepoCloud](https://repocloud.io/details/?app_id=29)

        [![Deploy on RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploy.png)](https://repocloud.io/details/?app_id=29)

      </details>

## ☁️ Kodivian Cloud

[Get Started with Kodivian Cloud](https://kodivian.com/)

## 🙋 Support

Feel free to ask any questions, raise problems, and request new features in [discussion](https://github.com/kodivian/kodivian/discussions)


## 📄 License

Source code in this repository is made available under the [Apache License Version 2.0](LICENSE.md).
