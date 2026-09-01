# Morpho contracts dan vault map

Snapshot: 2026-09-01. Dokumen ini mengikuti tepat 10 network yang terdaftar di `tools/src/config/chains.ts`. Seluruh address pada dokumen ini adalah kontrak protokol Morpho dari dokumentasi deployment resminya.

## Kontrak inti per network

| Network | Chain ID | Morpho Blue | Adaptive Curve IRM | Oracle Factory |
|---|---:|---|---|---|
| Ethereum | 1 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | `0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC` | `0x3A7bB36Ee3f3eE32A60e9f2b33c1e5f2E83ad766` |
| Base | 8453 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | `0x46415998764C29aB2a25CbeA6254146D50D22687` | `0x2DC205F24BCb6B311E5cdf0745B0741648Aebd3d` |
| Arbitrum One | 42161 | `0x6c247b1F6182318877311737BaC0844bAa518F5e` | `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA` | `0x98Ce5D183DC0c176f54D37162F87e7eD7f2E41b5` |
| OP Mainnet | 10 | `0xce95AfbB8EA029495c66020883F87aaE8864AF92` | `0x8cD70A8F399428456b29546BC5dBe10ab6a06ef6` | `0x1ec408D4131686f727F3Fd6245CF85Bc5c9DAD70` |
| Robinhood Chain | 4663 | `0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010` | `0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1` | `0xB7c16F6F8cF531447Bf27Ca7220f981E79C9cdF2` |
| HyperEVM | 999 | `0x68e37dE8d93d3496ae143F2E900490f6280C57cD` | `0xD4a426F010986dCad727e8dd6eed44cA4A9b7483` | `0xeb476f124FaD625178759d13557A72394A6f9aF5` |
| Stable | 988 | `0xa40103088A899514E3fe474cD3cc5bf811b1102e` | `0x41e846FC8108b8527C1D4EDB4c9564E56442940f` | `0xF24C6eAB91e43EacE18a4e893a48565C09132505` |
| Monad | 143 | `0xD5D960E8C380B724a48AC59E2DfF1b2CB4a1eAee` | `0x09475a3D6eA8c314c592b1a3799bDE044E2F400F` | `0xC8659Bcd5279DB664Be973aEFd752a5326653739` |
| Tempo | 4217 | `0x10EE9AAC980A180dd4DcFc96C746d60B0EA88f97` | `0x112fd4042E442C3C12C67AD23587b0afe36eB74E` | `0xc2c167BC5cBD833ce58239e85073258F10aD4DF6` |
| Katana | 747474 | `0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc` | `0x4F708C0ae7deD3d74736594C2109C2E3c065B428` | `0x7D047fB910Bc187C18C81a69E30Fa164f8c536eC` |

Keterangan: `Morpho Blue` adalah singleton lender untuk flashloan. `Adaptive Curve IRM` dan `Oracle Factory` adalah dependency resmi Morpho Blue, bukan provider loan alternatif.

## Infrastruktur vault Morpho

Vault adalah wrapper strategi yield; vault bukan endpoint flashloan. Gunakan `Morpho Blue` pada tabel di atas untuk flashloan, dan gunakan factory/registry di bawah untuk menemukan atau memvalidasi vault.

| Network | Vault V2 Factory | V1 Adapter Factory | Market Adapter V2 Factory | Registry | Blue Public Allocator |
|---|---|---|---|---|---|
| Ethereum | `0xA1D94F746dEfa1928926b84fB2596c06926C0405` | `0xD1B8E2dee25c2b89DCD2f98448a7ce87d6F63394` | `0x32BB1c0D48D8b1B3363e86eeB9A0300BAd61ccc1` | `0x3696c5eAe4a7Ffd04Ea163564571E9CD8Ed9364e` | `0x00b8e1509398ED692C3F326CbAf1694F9A881e27` |
| Base | `0x4501125508079A99ebBebCE205DeC9593C2b5857` | `0xF42D9c36b34c9c2CF3Bc30eD2a52a90eEB604642` | `0x9a1B378C43BA535cDB89934230F0D3890c51C0EB` | `0x5C2531Cbd2cf112Cf687da3Cd536708aDd7DB10a` | `0xAED282B8aD9257BB1272e93aE63A32A53621e412` |
| Arbitrum One | `0x6b46fa3cc9EBF8aB230aBAc664E37F2966Bf7971` | `0xD8Fc8a85779551e78B516da9f74061cb3b086793` | `0xeF84b1ecEbe43283ec5AF95D7a5c4D7dE0a9859b` | `0xc00eb3c7aD1aE986A7f05F5A9d71aCa39c763C65` | `0x85b66Fe31e6788E5a6825EAe689f4c6c38AF3704` |
| OP Mainnet | `0x6128b680b277Bf4Df80DFE9D8c55A498660870ef` | `0xEe9F7C64dD827ED7b5CAA2272936366FAca00CF3` | `0x71B299bDb52b6396429cd1E11c418324502CB434` | `0xD1346be260cd22Eab9E6163010b0D5CbfAAAD32b` | `0xc6945A915Bb7e2A365469f120A33D2FA42951cF3` |
| Robinhood Chain | `0x0FBad98595b0186dA120E41f77C102beb49f803c` | `0x7a91222F3f7B927bB8fb624593Ca86e111C2F85e` | `0x79370Ed003CE325C088E530d5e8655c99c2993e1` | `—` | `—` |
| HyperEVM | `0xD7217E5687FF1071356C780b5fe4803D9D967da7` | `0xdf5202e29654e02011611A086f15477880580CAc` | `0xaEff6Ef4B7bbfbAadB18b634A8F11392CBeB72Be` | `0x857B55cEb57dA0C2A83EE08a8dB529B931089aee` | `0x056dd7D4B373ED26c788190085CC6C52B8e7479d` |
| Stable | `0x7fc35488803D49D00a94b206A223f7661898BE3a` | `0x4EF83ACD552598a1196c1aBDD0bA2EdE6f2237B4` | `0x9282DBa3d1788f4f02B5DdFc4fc5985e70197620` | `—` | `—` |
| Monad | `0x8B2F922162FBb60A6a072cC784A2E4168fB0bb0c` | `0x9f3c0999425656fD189C69a8aD68cB64986D644A` | `0xa00666E86C7e2FA8d2c78d9481E687e098340180` | `0x6a42f8b46224baA4DbBBc2F860F4675eeA7bd52B` | `0x0A503aB026EFACBC0F7feE7795F34B80b5B9a662` |
| Tempo | `0x3DE400E3F79113194fa5AF6Ae5C474947E0C82Db` | `0x669771F03ab55CebF753E90C3c9D80ad9391cf25` | `0xF85aD5f14cC903533FC409B8098B58b4C2f36697` | `—` | `—` |
| Katana | `0xFcb8b57E56787bB29e130Fca67f3c5a1232975D1` | `0xc8D22B1adD3D176600E9952e7876e9249254cAAF` | `0x6d6A3ba62836d6B40277767dCAc8fd390d4BcedC` | `0xA9132a09838fD20304dF2B2892679d06A4cc6371` | `0xd952175e940D97775cBC5a523977a6f091D0d702` |

`—` berarti address tidak dipublikasikan pada blok network terkait di halaman deployment resmi, bukan berarti kontraknya boleh ditebak atau diganti dengan address chain lain.

## Daftar instance vault

Instance vault berubah saat vault baru dibuat, dihapus, atau tidak lagi listed. Karena itu toolkit tidak mengunci ratusan address vault ke source code; CLI mengambil daftar terbaru dari API Morpho lalu memfilter `listed`, asset, harga, dan saldo.

Query GraphQL untuk seluruh network CLI:

```graphql
query ToolkitVaultInventory {
  vaultV2s(first: 1000, where: { chainId_in: [1, 8453, 42161, 10, 4663, 999, 988, 143, 4217, 747474] }) {
    items { address symbol name listed asset { address decimals } chain { id network } }
  }
  vaults(first: 1000, where: { chainId_in: [1, 8453, 42161, 10, 4663, 999, 988, 143, 4217, 747474] }) {
    items { address symbol name listed asset { address decimals } chain { id network } }
  }
}
```

Endpoint: `https://api.morpho.org/graphql`. Parameter `first: 1000` adalah page size, bukan jaminan seluruh hasil; ulangi memakai cursor sesuai schema API bila hasil mencapai batas.

Snapshot jumlah item yang dikembalikan halaman pertama (`first: 1000`, bukan total global):

| Network | Vault V2 | Legacy V1 |
|---|---:|---:|
| Ethereum | 132 | 359 |
| Base | 765 | 368 |
| Arbitrum One | 36 | 78 |
| OP Mainnet | 5 | 12 |
| Robinhood Chain | 9 | 0 |
| HyperEVM | 14 | 77 |
| Stable | 4 | 5 |
| Monad | 7 | 20 |
| Tempo | 16 | 0 |
| Katana | 5 | 33 |

Untuk detail satu vault, gunakan endpoint REST cursor/list resmi lalu ambil address yang ditemukan:

```text
https://api.morpho.org/v0/vaults-v2/{chainId}:{vaultAddress}
```

Validasi minimum sebelum memakai vault: `chain.id` harus sama dengan RPC target, `listed` harus true, asset harus ERC-20 yang didukung, dan address harus memiliki bytecode. Jangan menganggap saldo vault sebagai saldo flashloan; scanner toolkit membaca `balanceOf(asset, Morpho Blue)`.

## Update dan verifikasi

1. Jalankan `npm run cli -- chains` dan pastikan chain target ada di registry.
2. Refresh daftar vault melalui query di atas; jangan menyalin daftar lama ke allowlist permanen.
3. Bandingkan Morpho/IRM/Oracle/Factory dengan [official deployment addresses](https://docs.morpho.org/developers/contracts/addresses/).
4. Jalankan `npm run cli -- scan --chain <key> --min-usd 100000` untuk saldo terbaru.

Referensi API: [Morpho Vaults API](https://docs.morpho.org/developers/api/morpho-vaults/) dan [List Morpho Vaults V2](https://docs.morpho.org/api/vaults-v2/list-v2-vaults/).
