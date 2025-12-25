# Local Setup

***

{% hint style="info" %}
Pre-requisite: ensure [NodeJS](https://nodejs.org/en/download) is installed on machine. Node `v22.21.1` is supported.
{% endhint %}


Install [PNPM](https://pnpm.io/installation).

```bash
npm i -g pnpm
```

Simple setup using PNPM:

1. Clone the repository

```bash
git clone https://git.kodivian.com/kodivianproducts/apdt_v21/devgit/appbuilder.git
```

2. Go into repository folder

```bash
cd appbuilder\app_v17_builder\inputs\kodivian
```

3. Install all dependencies of all modules:

```bash
pnpm install
```

4. Build the code:

```bash
pnpm build
```

5. Start the app at [http://localhost:3030/kodivian](http://localhost:3030/kodivian)

```bash
pnpm start
```