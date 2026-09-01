# Morpho balance scanner baseline

Snapshot: 2026-09-01. Threshold: saldo ERC-20 pada singleton Morpho bernilai minimal `$100,000`, memakai harga maksimal 24 jam. Nilai berubah setiap block; jalankan CLI untuk keputusan terbaru.

```bash
cd tools
npm run cli -- scan-all --min-usd 100000
```

| Chain target | Kandidat eligible / ditemukan | Executor | Catatan |
|---|---:|---|---|
| Ethereum | 100 / 727 | deployed + live-tested | API Morpho + on-chain balance |
| Base | 31 / 3182 | deployed + live-tested | mayoritas kandidat spam/unpriced ditolak |
| Arbitrum | 16 / 114 | deployed + live-tested | API Morpho + on-chain balance |
| Polygon | 5 / 545 | belum deploy | WBTC, MaticX, WETH, USDT0, USDC lolos |
| Optimism | 3 / 11 | deployed + live-tested | WBTC, USDC, wstETH lolos |
| Robinhood | 6 / 80 | deployed + live-tested | API Morpho + on-chain balance |
| HyperEVM | 15 / 55 | deployed + live-tested | API Morpho + on-chain balance |
| Stable | 2 / 14 | deployed + live-tested | sthUSD dan USDT0 lolos |
| Monad | 22 / 51 | deployed + live-tested | API Morpho + on-chain balance |
| Tempo | 2 / 20 | deployed + live-tested | cbBTC dan pathUSD lolos |
| Katana | 13 / 38 | deployed + live-tested | API Morpho + on-chain balance |

Angka `ditemukan` adalah kandidat unik dari loan/collateral assets seluruh market API ditambah registry lokal. Kandidat tanpa metadata/harga segar tidak dibaca saldonya dan tidak boleh masuk allowlist. Untuk chain yang belum diindeks API, tambahkan `--token 0x...` dan daftarkan chain/RPC/address resmi sebelum memakai CLI.

Project registry bukan daftar lengkap seluruh deployment Morpho global. Tambahkan chain/RPC/address resmi ke `tools/src/config/chains.ts` dan `evm/deployments.json` sebelum memakai CLI untuk chain baru. Sumber address: [Morpho official deployments](https://docs.morpho.org/developers/contracts/addresses/).
