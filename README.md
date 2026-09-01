<p align="center">
  <img src="assets/evm-loan-toolkit-banner.png" alt="EVM Loan Toolkit banner" width="100%" />
</p>

# EVM-LOAN-TOOLKIT — Morpho All-Chain

Modul ini berisi implementasi Morpho Blue EVM: scanner likuiditas, Solidity flashloan executor, deployment registry, TypeScript CLI, dan dokumentasi operasional.

> **Mainnet warning:** `setup --broadcast` dan `flashloan` mengirim transaksi sungguhan. Gunakan wallet khusus, periksa chain/token/nominal, dan jangan pernah commit private key.

## Status fitur

| Komponen | Status |
|---|---|
| Morpho liquidity scanner | Aktif |
| TypeScript interactive/non-interactive CLI | Aktif |
| Deploy dan sync token allowlist | Aktif |
| Exact-principal zero-protocol-fee flashloan | Aktif |
| Base/Arbitrum receipt RPC fallback | Aktif |
| DEX quote, router, dan arbitrage callback | Belum tersedia |
| Backup provider adapter | Riset di luar toolkit CLI |

Morpho fee flashloan adalah nol, tetapi network gas tetap dibayar. Liquidity, price, dan provider state harus discan ulang sebelum transaksi.

## Struktur folder

```text
Morpho/
├── README.md
├── docs/
│   ├── DEPLOYMENT-CHECK.md
│   ├── EVM-RPCS.md
│   └── MORPHO-SCAN.md
├── evm/
│   ├── src/FlashLoanExecutor.sol
│   ├── script/Deploy.s.sol
│   ├── test/FlashLoanExecutor.t.sol
│   ├── foundry.toml
│   ├── deployments.json
│   ├── stablecoins.json
│   ├── out/ cache/ broadcast/  # generated Foundry files
│   └── README.md
└── tools/
    ├── .env / .env.example
    ├── package.json / package-lock.json
    └── src/
        ├── cli.ts
        ├── commands/{dry-run,status}.ts
        ├── config/{chains,env,registry}.ts
        ├── morpho/{scanner,guards,plan}.ts
        └── ui/index.ts
```

`deployments.json` adalah registry address/status. `stablecoins.json` hanya seed token; scanner juga menemukan loan/collateral asset dari Morpho API.

## Network registry

| Network | Chain ID | Status |
|---|---:|---|
| Ethereum | 1 | Executor live, flashloan verified |
| Base | 8453 | Executor live, flashloan verified |
| Arbitrum One | 42161 | Executor live, flashloan verified |
| OP Mainnet | 10 | Executor live, flashloan verified |
| Robinhood Chain | 4663 | Executor live, flashloan verified |
| HyperEVM | 999 | Executor live, flashloan verified |
| Stable | 988 | Executor live, flashloan verified |
| Monad | 143 | Executor live, flashloan verified |
| Tempo | 4217 | Executor live, flashloan verified |
| Katana | 747474 | Executor live, flashloan verified |
| Polygon | 137 | Morpho address; executor perlu setup |

Status berubah setiap block. Jalankan `chains` dan scan ulang sebelum broadcast.

## Instalasi dari awal

### Prasyarat

- Linux/macOS atau WSL2, Git.
- Node.js current LTS (disarankan 20+) dan npm.
- Foundry stable (`forge`, `cast`, `anvil`).
- Wallet EVM khusus dengan native gas token chain target.

Unduh Node.js dari [nodejs.org](https://nodejs.org/en/download), lalu cek:

```bash
node --version
npm --version
```

Install Foundry dari installer resminya:

```bash
curl -L https://getfoundry.sh/install | bash
foundryup
forge --version
cast --version
```

### Dependency dan environment

```bash
cd Morpho/tools
npm ci
cp .env.example .env
chmod 600 .env
```

Isi `Morpho/tools/.env`:

```dotenv
PRIVATE_KEY=0xYOUR_64_HEX_PRIVATE_KEY
ETHEREUM_RPC_URL=https://...
BASE_RPC_URL=https://...
ARBITRUM_RPC_URL=https://...
POLYGON_RPC_URL=https://...
OPTIMISM_RPC_URL=https://...
ROBINHOOD_RPC_URL=https://...
HYPEREVM_RPC_URL=https://...
STABLE_RPC_URL=https://...
MONAD_RPC_URL=https://...
TEMPO_RPC_URL=https://...
KATANA_RPC_URL=https://...
```

`PRIVATE_KEY` harus `0x` + 64 karakter hex. Jangan taruh key di command line, README, screenshot, atau registry. Owner key harus sama dengan `owner()` executor existing. Wallet tetap memerlukan native gas walau fee protocol nol.

### Build dan test

```bash
cd ../evm
forge build
forge test -vv

cd ../tools
npm run build
npm test
```

Artifact `evm/out/FlashLoanExecutor.sol/FlashLoanExecutor.json` diperlukan saat deploy executor baru.

## CLI

Semua command dijalankan dari `Morpho/tools`:

```bash
npm run cli
```

Menu: `1 LIQUIDITY SCAN`, `2 EXECUTOR SETUP`, `3 RUN FLASHLOAN`, `0 EXIT`.

### Status dan scan

```bash
npm run cli -- chains
npm run cli -- scan --chain ethereum --min-usd 100000
npm run cli -- scan --chain base --min-usd 250000
npm run cli -- scan-all --min-usd 100000
npm run cli -- scan-all --chains ethereum,base,arbitrum --min-usd 100000
npm run cli -- scan --chain base --token 0xTokenAddress --json
```

Scanner memvalidasi chain ID dan bytecode Morpho, discovery market, metadata ERC-20, balance `balanceOf(Morpho)` melalui Multicall3, harga Morpho API/fallback DefiLlama, lalu threshold dan price age.

### Setup executor dan allowlist

```bash
npm run cli -- setup --chain ethereum --select USDC,WETH --plan
npm run cli -- setup --chain ethereum --select USDC,WETH --broadcast
npm run cli -- setup --chain ethereum --select USDC,WETH --broadcast --yes
```

`--select` menerima nomor (`1,3`), simbol (`USDC,WETH`), address, atau `all`. Executor existing hanya disinkronkan; `--redeploy` memaksa deployment baru.

### Flashloan

Amount berupa unit token atau target USD:

```bash
npm run cli -- flashloan --chain base --asset WETH --amount 40
npm run cli -- flashloan --chain ethereum --asset USDC --amount 1000000
npm run cli -- flashloan --chain arbitrum --asset WETH --amount '$100000'
npm run cli -- flashloan --chain base --asset USDC --amount 100000 --broadcast --yes
```

Satu transaksi hanya menerima satu aset. CLI scan balance terbaru, auto-allowlist bila perlu, simulasi, lalu broadcast. `--broadcast` mengirim transaksi; `--yes` melewati prompt automation. Amount tidak boleh melebihi saldo Morpho.

Flag utama: `--chain`, `--min-usd`, `--max-price-age-hours`, `--token`, `--select`, `--asset`, `--amount`, `--plan`, `--broadcast`, `--yes`, `--redeploy`, `--json`.

## Deployment manual Foundry

```bash
cd Morpho/evm
export MORPHO_ADDRESS=0xMorphoOnTargetChain
export TOKEN_ADDRESSES=0xTokenA,0xTokenB,0xTokenC
export PRIVATE_KEY=0xYOUR_64_HEX_PRIVATE_KEY
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "https://your-target-rpc" --broadcast
```

Verifikasi `owner()`, `morpho()`, bytecode, dan allowlist setelah deployment. Simpan hasil ke `deployments.json` tanpa private key.

## Fungsi executor

Contract ada di `evm/src/FlashLoanExecutor.sol`.

| Fungsi | Akses | Keterangan |
|---|---|---|
| `flashLoan(token, assets)` | Owner | Memulai flashloan satu token |
| `onMorphoFlashLoan(assets, data)` | Morpho | Validasi callback dan approval principal |
| `setTokenAllowed(token, allowed)` | Owner | Kelola token allowlist |
| `setPaused(value)` | Owner | Pause/unpause initiation |
| `rescueToken(token, to, amount)` | Owner | Rescue token tertinggal |

Callback menolak caller selain Morpho, token/amount mismatch, nested loan, token tidak di-allowlist, dan repayment yang tidak tepat. Approval dibatasi sebesar principal.

## Fungsi arbitrase

Executor live saat ini adalah **no-op flashloan**. Callback tidak melakukan swap dan invariant saldo akhir harus sama dengan saldo awal. Profit tambahan akan membuat executor sekarang revert; jangan memakainya sebagai arb executor.

Arb harus dibuat sebagai executor/ABI versi baru, misalnya:

```solidity
function executeArbitrage(
    address loanToken,
    uint256 assets,
    uint256 minProfit,
    address profitReceiver,
    bytes calldata routeData
) external onlyOwner;
```

Alur bot: quote DEX A/B → hitung output, DEX fee, gas, dan slippage → encode route → simulate → broadcast bila `netProfit >= minProfit` → swap kembali ke loan token → enforce deadline/minOut/minProfit → approve principal → kirim surplus.

```text
grossProfit = finalLoanToken - principal
netProfit   = grossProfit - DEX fees - gas - builder/bribe cost
```

Guard wajib: router/adapter dan selector allowlist, deadline, `minAmountOut`, `minProfit`, approval terbatas, reentrancy/state guard, route chain-specific, dan simulasi full transaction. Tolak fee-on-transfer/rebasing token yang belum diuji. Venue swap sengaja belum di-hardcode.

## Provider backup

Provider backup dan chain di luar toolkit dicatat terpisah di [`../docs/BACKUP-LOAN-PROVIDERS.md`](../docs/BACKUP-LOAN-PROVIDERS.md). Dokumen tersebut bukan daftar network yang dapat dipilih oleh CLI Morpho.

## Troubleshooting

- `Archive requests require a personal token`: Base dan Arbitrum memakai endpoint resmi sebagai read/receipt fallback. Periksa hash di explorer sebelum mengirim ulang.
- `0 funded assets`: `balance-read-failed` berarti RPC/call gagal; `metadata-unavailable` berarti ERC-20/RPC bermasalah; `price-missing-or-stale` berarti harga tidak segar; `below-minimum-usd` berarti di bawah filter.
- `PRIVATE_KEY bukan owner executor`: gunakan key owner atau deploy executor baru dengan `--redeploy`.
- `nominal melebihi saldo Morpho`: scan ulang dan kurangi amount.
- `artifact bytecode kosong`: jalankan `cd Morpho/evm && forge build`.
- `insufficient funds for gas`: isi native token chain target.

## Checklist mainnet

- [ ] Chain ID RPC, Morpho address, bytecode, owner, dan token benar.
- [ ] Balance terbaru dan harga segar cukup.
- [ ] Wallet memiliki native gas.
- [ ] Amount memakai decimals benar.
- [ ] Simulasi berhasil dan explorer hash dicatat.
- [ ] Untuk arb: route, deadline, minOut, gas, dan minProfit dihitung.

## Referensi

- [Morpho contract API](https://docs.morpho.org/developers/contracts/morpho/)
- [Morpho deployment addresses](https://docs.morpho.org/developers/contracts/addresses/)
- [Foundry installation](https://getfoundry.sh/getting-started/installation)
- [Node.js downloads](https://nodejs.org/en/download)
- [`evm/README.md`](evm/README.md)
- [`tools/README.md`](tools/README.md)
