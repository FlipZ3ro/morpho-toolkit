# DEX Swap ABI Map

Peta ini adalah dasar untuk menambah adapter swap ke `MorphoV2ArbitragePOC`. Fokusnya adalah swap ERC-20 exact-input: nominal input sudah pasti, output dibatasi oleh `amountOutMin`, dan penerima wajib contract POC sendiri.

Implementasi Solidity minimal yang dapat di-import atau disalin ada di `src/poc/DexSwapInterfaces.sol`.

## Ringkasan kompatibilitas

| DEX / router | Entry point utama | Bentuk route | Status untuk POC |
|---|---|---|---|
| Uniswap V2 Router02 | `swapExactTokensForTokens` | `address[]` | Sudah kompatibel |
| Sushi V2 Router02 | `swapExactTokensForTokens` | `address[]` | Sudah kompatibel |
| Uniswap V3 SwapRouter | `exactInputSingle` / `exactInput` | struct / packed `bytes` | Perlu adapter V3 legacy |
| Sushi V3 SwapRouter | `exactInputSingle` / `exactInput` | struct / packed `bytes` | Perlu adapter V3 legacy |
| Uniswap SwapRouter02 | `exactInputSingle` / `exactInput` | struct tanpa `deadline` | Perlu adapter Router02 terpisah |
| Uniswap Universal Router | `execute` | commands + encoded inputs | Tunda; calldata dinamis |
| Sushi RedSnwapper | `snwap` | executor + `executorData` | Tunda; executor dinamis |
| Aerodrome / Velodrome | `swapExactTokensForTokens` | `Route[]` | Perlu adapter Aero |
| Balancer V2 Vault | `swap` / `batchSwap` | pool ID + asset arrays | Perlu adapter Vault |
| Curve Router NG | `exchange` | fixed route + swap params | Perlu adapter Curve |

`MorphoV2ArbitragePOC.sol` saat ini hanya menerima router V2-compatible. Karena Sushi V2 mempertahankan ABI Router02, Uniswap V2 dan Sushi V2 dapat dipakai tanpa mengubah ABI POC; alamat router tetap harus di-allowlist per chain.

## 1. Uniswap V2 dan Sushi V2

```solidity
function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
) external returns (uint256[] memory amounts);

function swapTokensForExactTokens(
    uint256 amountOut,
    uint256 amountInMax,
    address[] calldata path,
    address to,
    uint256 deadline
) external returns (uint256[] memory amounts);
```

Untuk flashloan gunakan exact-input. Set `amountIn` dari balance yang benar-benar diterima, `to = address(this)`, dan deadline pendek. Adapter harus mengecek elemen pertama dan terakhir `path` terhadap token yang diharapkan.

Varian `SupportingFeeOnTransferTokens` tidak mengembalikan `amounts`. Untuk arbitrase stablecoin/WETH, jangan aktifkan varian ini sebelum ada kebutuhan dan test khusus.

## 2. Uniswap V3 dan Sushi V3 legacy SwapRouter

Router legacy memasukkan `deadline` di dalam struct.

```solidity
struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}

function exactInputSingle(ExactInputSingleParams calldata params)
    external payable returns (uint256 amountOut);

struct ExactInputParams {
    bytes path;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
}

function exactInput(ExactInputParams calldata params)
    external payable returns (uint256 amountOut);
```

Packed path exact-input disusun `tokenIn (20) | fee (3) | tokenOut (20)`, lalu pasangan `fee | token` berikutnya untuk multihop. Adapter harus mem-parsing path, bukan sekadar meneruskan bytes dari bot.

## 3. Uniswap SwapRouter02

SwapRouter02 terlihat mirip V3 legacy, tetapi struct V3-nya **tidak memiliki `deadline`**. ABI ini tidak boleh ditukar dengan ABI legacy.

```solidity
struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}

function exactInputSingle(ExactInputSingleParams calldata params)
    external payable returns (uint256 amountOut);
```

Deadline untuk multicall/router composition perlu ditangani sesuai deployment yang dipakai. Selalu verifikasi bytecode dan ABI deployment per chain sebelum memasukkan alamat ke allowlist.

## 4. Uniswap Universal Router

```solidity
function execute(
    bytes calldata commands,
    bytes[] calldata inputs,
    uint256 deadline
) external payable;
```

Command yang relevan pada source saat ini antara lain V3 exact-in `0x00`, V3 exact-out `0x01`, V2 exact-in `0x08`, V2 exact-out `0x09`, dan V4 swap `0x10`. Format input command dapat berubah antar-versi deployment. Universal Router juga memiliki semantik payer/Permit2.

Jangan berikan `commands` dan `inputs` mentah dari bot ke contract POC. Adapter perlu membangun encoding on-chain dari struct yang sudah divalidasi, atau mem-parsing seluruh command sebelum call.

## 5. Sushi RedSnwapper

```solidity
function snwap(
    address tokenIn,
    uint256 amountIn,
    address recipient,
    address tokenOut,
    uint256 amountOutMin,
    address executor,
    bytes calldata executorData
) external payable returns (uint256 amountOut);
```

RedSnwapper memindahkan token ke executor dan menjalankan `executorData`. Ini fleksibel untuk aggregator, tetapi tidak sesuai guard POC yang melarang arbitrary target/calldata. Integrasi baru boleh diaktifkan setelah executor di-allowlist, selector dan payload di-decode, token/amount/recipient diverifikasi, dan seluruh route di-fork-test.

## 6. Aerodrome dan Velodrome

```solidity
struct Route {
    address from;
    address to;
    bool stable;
    address factory;
}

function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
) external returns (uint256[] memory amounts);
```

Adapter wajib mengecek kontinuitas setiap hop (`routes[n].to == routes[n+1].from`), token awal/akhir, factory yang diizinkan, jenis pool stable/volatile, recipient, amount, dan deadline.

## 7. Balancer V2 Vault

```solidity
enum SwapKind { GIVEN_IN, GIVEN_OUT }

struct SingleSwap {
    bytes32 poolId;
    SwapKind kind;
    address assetIn;
    address assetOut;
    uint256 amount;
    bytes userData;
}

struct FundManagement {
    address sender;
    bool fromInternalBalance;
    address payable recipient;
    bool toInternalBalance;
}

function swap(
    SingleSwap calldata singleSwap,
    FundManagement calldata funds,
    uint256 limit,
    uint256 deadline
) external payable returns (uint256 amountCalculated);
```

Untuk exact-input gunakan `GIVEN_IN`; `limit` adalah minimum output. Set sender dan recipient ke contract POC, nonaktifkan internal balance untuk adapter awal, dan allowlist `poolId` bersama Vault address.

`batchSwap` memakai `BatchSwapStep[]`, daftar assets, dan `int256[] limits`; dukung kemudian setelah single-swap teruji.

## 8. Curve Router NG dan direct pool

```solidity
function exchange(
    address[11] calldata route,
    uint256[5][5] calldata swapParams,
    uint256 amount,
    uint256 minDy,
    address[5] calldata pools,
    address receiver
) external payable returns (uint256 amountOut);
```

Router NG mendukung sampai lima hop. Setiap baris `swapParams` berisi `[i, j, swap_type, pool_type, n_coins]`; route ditentukan off-chain. Adapter wajib membatasi pool/zap, swap type, token awal/akhir, receiver, amount, dan `minDy`.

ABI direct pool Curve tidak seragam. Dua bentuk umum adalah:

```solidity
function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external payable;
function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy) external payable;
function exchange_underlying(int128 i, int128 j, uint256 dx, uint256 minDy) external payable;
```

Jangan memilih selector direct pool hanya berdasarkan nama DEX; simpan tipe ABI bersama alamat pool yang telah diverifikasi.

## Model approval dan validasi output

| Router | Token allowance diberikan ke | Catatan |
|---|---|---|
| V2 / V3 direct | router | Reset allowance setelah swap bila adapter memakai allowance per-call |
| Universal Router | Permit2/router sesuai versi | Validasi payer flag dan command encoding |
| RedSnwapper | RedSnwapper atau pre-fund sesuai source API | Executor dinamis adalah risiko utama |
| Aerodrome / Velodrome | router | Allowlist factory per chain |
| Balancer V2 | Vault | Allowlist pool ID |
| Curve Router NG | router | Allowlist semua pool/zap di route |

Untuk semua adapter, hitung output dari selisih `balanceOf(tokenOut)` sebelum dan sesudah swap. Return value router hanya data tambahan. Setelah dua swap, kontrak tetap harus memverifikasi `finalBalance >= principal + minProfit` sebelum mengizinkan Morpho menarik principal.

## Urutan implementasi

1. Pertahankan Uniswap V2 + Sushi V2 pada adapter POC yang sekarang.
2. Tambahkan dua adapter berbeda: V3 legacy dan SwapRouter02.
3. Tambahkan Aerodrome/Velodrome untuk Base/OP, lalu Balancer V2 dan Curve dengan allowlist pool.
4. Integrasikan Universal Router atau RedSnwapper hanya jika parser/encoder ketat dan fork test sudah tersedia.

## Checklist keamanan adapter

- Allowlist router dan pastikan `router.code.length > 0`.
- Bila deployment dapat di-upgrade, cek proxy implementation; bila immutable, simpan expected codehash.
- Allowlist selector, factory, pool ID, pool, dan executor sesuai tipe adapter.
- Pastikan `tokenIn`, `tokenOut`, seluruh hop, `amountIn`, recipient, min-out, dan deadline cocok dengan plan aktif.
- Gunakan WETH, bukan native ETH, untuk adapter pertama.
- Gunakan exact-input agar nominal flashloan tidak dapat terlewati.
- Ukur balance delta dan tolak output nol.
- Reset atau batasi allowance dan gunakan safe ERC-20 calls.
- Simulasikan pada fork block terbaru sebelum broadcast.

## Sumber resmi

- Uniswap V2 periphery: <https://github.com/Uniswap/v2-periphery/blob/master/contracts/interfaces/IUniswapV2Router02.sol>
- Uniswap V3 SwapRouter: <https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/ISwapRouter.sol>
- Uniswap SwapRouter02: <https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol>
- Uniswap Universal Router: <https://github.com/Uniswap/universal-router/blob/main/contracts/interfaces/IUniversalRouter.sol>
- Sushi V2 router: <https://github.com/sushiswap/v2-core/blob/master/contracts/UniswapV2Router02.sol>
- Sushi V3 SwapRouter: <https://github.com/sushiswap/v3-periphery/blob/master/contracts/interfaces/ISwapRouter.sol>
- Sushi RedSnwapper: <https://github.com/sushi-labs/sushi/blob/master/site/pages/contracts/red-snwapper.mdx>
- Aerodrome router: <https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IRouter.sol>
- Velodrome router: <https://github.com/velodrome-finance/contracts/blob/main/contracts/interfaces/IRouter.sol>
- Balancer V2 Vault: <https://github.com/balancer/balancer-v2-monorepo/blob/master/pkg/interfaces/contracts/vault/IVault.sol>
- Curve Router NG: <https://github.com/curvefi/curve-router-ng/blob/master/contracts/Router.vy>
