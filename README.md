<!-- markdownlint-disable MD030 -->

# Autonomous

**Build AI Agents, Visually**

Autonomous is an enterprise-grade AI orchestration platform, customized for SmartAppBuilder clients. It provides a visual interface for building AI agents and LLM orchestration workflows.

**Version**: 3.0.10 | **Node.js**: 22.21.1+ | **Last Updated**: December 2024

## 📚 Table of Contents

-   [⚡ Quick Start](#-quick-start)
-   [🐳 Docker](#-docker)
-   [👨‍💻 Developers](#-developers)
-   [🌱 Env Variables](#-env-variables)
-   [📖 Documentation](#-documentation)
-   [🌐 Self Host](#-self-host)
-   [🙋 Support](#-support)
-   [📄 License](#-license)

## ⚡Quick Start

Download and Install [NodeJS](https://nodejs.org/en/download) >= 22.21.1

1. Clone the repository:
    ```bash
    git clone <repository-url>
    cd <repository-folder>
    ```

2. Install dependencies:
    ```bash
    npm i -g pnpm
    pnpm install
    ```

3. Build the project:
    ```bash
    pnpm build
    ```

4. Start the server:
    ```bash
    pnpm start
    ```

5. Open [http://localhost:3030](http://localhost:3030)

## 🐳 Docker

### Docker Compose

1. Clone the Autonomous project
2. Go to `docker` folder at the root of the project
3. Copy `.env.example` file, paste it into the same location, and rename to `.env` file
4. `docker compose up -d`
5. Open [http://localhost:3030](http://localhost:3030)
6. You can bring the containers down by `docker compose stop`

### Docker Image

1. Build the image locally:

    ```bash
    docker build --no-cache -t autonomous .
    ```

2. Run image:

    ```bash
    docker run -d --name autonomous -p 3030:3030 autonomous
    ```

3. Stop image:

    ```bash
    docker stop autonomous
    ```

## 👨‍💻 Developers

Autonomous has 3 different modules in a single mono repository.

-   `server`: Node backend to serve API logics
-   `ui`: React frontend
-   `components`: Third-party nodes integrations
-   `api-documentation`: Auto-generated swagger-ui API docs from express

### Prerequisite

-   Install [PNPM](https://pnpm.io/installation)
    ```bash
    npm i -g pnpm
    ```

### Setup

1.  Clone the repository:

    ```bash
    git clone <repository-url>
    ```

2.  Go into repository folder:

    ```bash
    cd <repository-folder>
    ```

3.  Install all dependencies of all modules:

    ```bash
    pnpm install
    ```

4.  Build all the code:

    ```bash
    pnpm build
    ```

    <details>
    <summary>Exit code 134 (JavaScript heap out of memory)</summary>  
    If you get this error when running the above `build` script, try increasing the Node.js heap size and run the script again:

    ```bash
    # macOS / Linux / Git Bash
    export NODE_OPTIONS="--max-old-space-size=4096"

    # Windows PowerShell
    $env:NODE_OPTIONS="--max-old-space-size=4096"

    # Windows CMD
    set NODE_OPTIONS=--max-old-space-size=4096
    ```

    Then run:

    ```bash
    pnpm build
    ```

    </details>

5.  Start the app:

    ```bash
    pnpm start
    ```

    You can now access the app on [http://localhost:3000](http://localhost:3000)

6.  For development build:

    -   Create `.env` file and specify the `VITE_PORT` (refer to `.env.example`) in `packages/ui`
    -   Create `.env` file and specify the `PORT` (refer to `.env.example`) in `packages/server`
    -   Run:

        ```bash
        pnpm dev
        ```

    Any code changes will reload the app automatically on [http://localhost:8080](http://localhost:8080)

## 🌱 Env Variables

Autonomous supports different environment variables to configure your instance. You can specify the following variables in the `.env` file inside `packages/server` folder. See the `.env.example` file for available options.

## 📖 Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[AUTONOMOUS_TECHNICAL_DOCUMENTATION.md](docs/AUTONOMOUS_TECHNICAL_DOCUMENTATION.md)** - Complete technical reference
- **[TECHNICAL_FLOW_DIAGRAMS.md](docs/TECHNICAL_FLOW_DIAGRAMS.md)** - Architecture and flow diagrams
- **[AUTONOMOUS-TOOLS-ANALYSIS.md](docs/AUTONOMOUS-TOOLS-ANALYSIS.md)** - Available tools and analysis
- **[CLEANUP_SUMMARY_FROM_FLOWISE.md](docs/CLEANUP_SUMMARY_FROM_FLOWISE.md)** - Migration and cleanup history

**Key Topics:**
- Architecture & System Design
- LLM Usage Tracking & Cost Calculation
- Multi-Tenancy & Organization Management
- Security & Encryption (E2E)
- Deployment Options (Docker, PM2, Kubernetes)
- API Reference & Endpoints

For additional help, see the Support section below.

## 🌐 Self Host

Autonomous is designed for autonomous server deployment. You can deploy it in your own infrastructure using Docker or by building from source.

### Docker Deployment

See the [Docker](#-docker) section above for Docker Compose and Docker Image deployment instructions.

### Manual Deployment

1. Follow the [Developers](#-developers) setup instructions
2. Configure environment variables (see [Env Variables](#-env-variables))
3. Build and start the application
4. Deploy to your preferred hosting environment (AWS, Azure, GCP, etc.)

For detailed deployment guides, refer to the [documentation](https://docs.autonomous.ai/configuration/deployment).


## 🙋 Support

For support, please contact: smartappbuilder_support@chainsys.com


## 📄 License

Source code in this repository is made available under the [Apache License Version 2.0](LICENSE.md).
