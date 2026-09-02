# Morpho V2 Arbitrage POC

POC ini membuktikan alur atomik berikut:

```text
owner
  -> Morpho flashLoan(loanToken, amount)
  -> router A: loanToken -> intermediateToken
  -> router B: intermediateToken -> loanToken
  -> cek minOut + minProfit
  -> approve principal ke Morpho
  -> Morpho menarik principal
  -> profit dikirim ke profitReceiver
```

## File

- Contract: `src/poc/MorphoV2ArbitragePOC.sol`
- Test: `test/MorphoV2ArbitragePOC.t.sol`

Contract dibuat self-contained agar nanti mudah dipindahkan menjadi satu-file Gist.

## Menjalankan test

```bash
cd Morpho/evm
forge build
forge test --match-contract MorphoV2ArbitragePOCTest -vv
```

Test lokal memakai dua mock router dengan rate berikut:

```text
1,000 token A -> 2,000 token B -> 1,100 token A
principal     -> 1,000 token A
profit        ->   100 token A
```

## Parameter eksekusi

`executeArbitrage` menerima satu struct:

- `loanToken`: aset yang dipinjam dan dikembalikan ke Morpho.
- `intermediateToken`: aset di antara swap pertama dan kedua.
- `firstRouter` dan `secondRouter`: router V2-compatible yang sudah di-allowlist.
- `loanAmount`: principal flashloan dalam raw token units.
- `minIntermediateAmount`: batas output swap pertama.
- `minFinalAmount`: batas output swap kedua.
- `minProfit`: profit minimum dalam unit `loanToken`.
- `deadline`: batas waktu kedua swap.
- `profitReceiver`: penerima profit setelah principal dilunasi.

## Guard yang sudah tersedia

- Hanya owner yang dapat memulai arbitrase atau mengubah allowlist.
- Callback hanya menerima panggilan dari Morpho yang dikonfigurasi saat deployment.
- Callback terikat ke hash parameter, token, dan nominal loan aktif.
- Token serta kedua router wajib masuk allowlist.
- Tidak ada arbitrary-call atau arbitrary-calldata execution.
- Kedua swap memiliki `amountOutMin` dan `deadline`.
- Seluruh intermediate token hasil swap pertama harus digunakan pada swap kedua.
- Transaksi revert apabila principal dan `minProfit` tidak tersedia setelah swap.
- Profit baru dikirim setelah Morpho berhasil menarik principal.

## Batas POC

Belum ada quote scanner, route discovery, gas-to-token conversion, private transaction/MEV protection, router adapter non-V2, deployment script khusus, atau fork test terhadap DEX nyata. Jangan broadcast ke mainnet sebelum memilih chain dan dua venue, memverifikasi ABI/address router, serta menjalankan fork simulation pada block terbaru.
