# Morpho Tools

TypeScript toolkit untuk scan liquidity Morpho, deploy/sync executor, dan menjalankan exact-principal flashloan di seluruh EVM yang terdaftar.

## Struktur source

```text
src/
├── cli.ts              interactive dan non-interactive CLI entrypoint
├── commands/
│   ├── dry-run.ts      no-broadcast plan
│   └── status.ts       RPC configuration status
├── config/
│   ├── chains.ts       chain metadata dan nama environment RPC
│   ├── env.ts          loader tools/.env
│   └── registry.ts     deployment, token, dan artifact paths
├── morpho/
│   ├── scanner.ts      API discovery + on-chain balance verification
│   ├── scanner.test.ts threshold tests
│   ├── plan.ts         auditable Morpho no-op plan
│   └── guards.ts       exact-principal guards
└── ui/
    └── index.ts        terminal rendering
```

## Menjalankan

```bash
npm run cli
npm run cli -- chains
npm run cli -- scan-all --min-usd 100000
npm run build
npm test
```

Contoh langsung:

```bash
npm run cli -- flashloan --chain arbitrum --asset WETH --amount '$100000'
```

CLI selalu mengambil `.env` dari folder `tools/`, sehingga command aman dijalankan dari working directory lain. Registry contract dan artifact dibaca dari `../evm/`.

## Data rahasia

- RPC dan `PRIVATE_KEY` hanya disimpan di `.env`.
- `.env.example` berisi template tanpa secret.
- Jangan memasukkan private key ke `deployments.json`, command line, log, atau dokumentasi.
