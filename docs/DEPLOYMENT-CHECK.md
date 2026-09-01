# Deployment check status

Morpho Blue addresses are chain-specific and must be read from the official Morpho address page or SDK deployment registry. Morpho's API exposes markets by `chainId:marketId`, which we use to check that a loan token/market is actually present before selecting a chain.

Current policy:

- Tidak ada chain yang otomatis dianggap siap hanya karena alamat Morpho tercantum di dokumentasi resmi.
- A chain/token pair becomes `ready` only when the Morpho singleton address, stablecoin address (USDC/USDT/DAI or another approved asset), bytecode, block height, decimals, and available token balance have been verified.
- Balancer is subject to the same check against its Vault deployment and current fee configuration.
- No address is copied into production config from a search result or social post.

Sources: [Morpho contract addresses](https://docs.morpho.org/developers/contracts/addresses/), [Morpho Blue markets API](https://docs.morpho.org/api/markets/list-markets/), [Morpho Blue source](https://github.com/morpho-org/morpho-blue).

## CLI activation gate

`tools/src/cli.ts setup` hanya menawarkan aset bila semua syarat berikut terpenuhi pada saat scan:

1. RPC chain ID cocok dengan registry dan bytecode Morpho tersedia.
2. Kandidat ditemukan dari API Morpho, stablecoin registry, atau `--token` manual.
3. Metadata ERC-20 serta `balanceOf(Morpho)` berhasil dibaca langsung pada block scan yang sama.
4. Harga USD tersedia dan tidak lebih tua dari `--max-price-age-hours` (default 24 jam).
5. Nilai saldo aktual memenuhi `--min-usd` (default `$100.000`).

Discovery API bukan sumber saldo. API hanya meng-enumerasi kandidat token dan memberi harga; keputusan akhir selalu memakai saldo kontrak Morpho dari RPC. EVM tidak menyediakan fungsi generik untuk meng-enumerasi seluruh ERC-20 yang pernah masuk ke suatu address, sehingga chain yang belum diindeks API membutuhkan registry/manual candidate tambahan.
