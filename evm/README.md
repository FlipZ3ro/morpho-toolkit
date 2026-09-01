# EVM Flash Loan Contract

`src/FlashLoanExecutor.sol` adalah executor portable untuk Morpho Blue. Bytecode yang sama dapat dideploy ke semua chain EVM; constructor menerima alamat Morpho lokal dan allowlist token.

## Deploy parameters

```text
morpho_       = address Morpho Blue pada chain target
initialTokens = daftar token yang boleh dipinjam (USDC, USDT, DAI, atau stablecoin lain yang diverifikasi)
```

## Dry-run call

Panggil `flashLoan(USDC, 100e6)`. Contract membentuk callback data secara internal, meminjam, lalu mengembalikan tepat principal; tidak ada DEX atau arbitrary call di antara callback.

## Safety

- owner-only initiation and rescue
- provider and token allowlists
- pause switch
- exact repayment invariant
- no arbitrary external call path

Sebelum deploy, verifikasi alamat Morpho dan token pada chain target dari [Morpho deployment registry](https://docs.morpho.org/developers/contracts/addresses/) dan lakukan fork test.

## Deploy

```bash
export MORPHO_ADDRESS=0x...
export TOKEN_ADDRESS=0x...       # token pertama
export TOKEN_ADDRESS_2=0x...     # opsional
export TOKEN_ADDRESS_3=0x...     # opsional
export PRIVATE_KEY=0x...
forge script script/Deploy.s.sol:Deploy --rpc-url "$ETHEREUM_RPC_URL" --broadcast
```

Untuk allowlist dinamis tanpa batas tiga token, gunakan satu variabel comma-separated:

```bash
export TOKEN_ADDRESSES=0xTokenA,0xTokenB,0xTokenC,0xTokenD
forge script script/Deploy.s.sol:Deploy --rpc-url "$ETHEREUM_RPC_URL" --broadcast
```

CLI TypeScript di `../tools/` menggunakan jalur dinamis yang sama dan merupakan cara deploy yang direkomendasikan.

Ulangi per chain dengan RPC dan address registry masing-masing. Simpan hasil executor di `deployments.json`; jangan broadcast jika provider/token masih kosong.
