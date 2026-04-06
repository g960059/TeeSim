# ADR-0003: Integrated Roadmap

**Date:** 2026-04-06
**Status:** Proposed
**Synthesized from:** 4 independent roadmaps (Rendering, Data Pipeline, Product Strategy, Architecture)

---

## 現在地

空リポジトリから1日で到達した地点：

- ✅ ブラウザで動く TEE シミュレーター（React + VTK.js + Zustand）
- ✅ 実 CT データ（LCTSC 胸部 CT）から生成した GLB + VTI
- ✅ 5-DOF プローブ制御、8 anchor view プリセット、view matching
- ✅ 食道に沿ったプローブパス、心臓方向を向いた imaging beam
- ✅ 25/25 E2E テスト green
- ⚠️ 非造影 CT でチャンバー区別困難（7/8 PARTIAL, 1 FAIL）
- ⚠️ TG SAX が VTI bounds 外
- ⚠️ UI は開発者ツールの見た目

## ポジショニング（4提案の合意）

> **TeeSim は「空間推論 + ビューファインディング・トレーナー」である。エコー画像解釈ツールではない。**

Virtual TEE Toronto は pre-recorded clip + 離散ビュー切り替え。TeeSim の差別化は **プローブの連続操作で空間的に解剖を探索できること**。これは補完関係であり競合ではない。

---

## Phase 0: Image Quality Emergency（1-3週）

**#1 ブロッカー: チャンバーが見えなければ何も始まらない**

| Task | 手法 | 工数 | Impact |
|------|------|------|--------|
| **Label VTI 生成** | TotalSegmentator で LV/RV/LA/RA/Ao/PA を分離セグメンテーション → label VTI 出力 → pseudo-TEE にチャンバー色分けオーバーレイ | M | ★★★★★ |
| **CT ウィンドウ最適化** | window 120 HU (center 50), depth attenuation 0.3 | S | ★★★ |
| **TG SAX 修正** | VTI ROI の inferior 拡張 + centerline の gastric 延伸 | S | ★★★ |
| **造影 CTA ケース取得** | TotalSegmentator 公開 CT から造影 CTA を1ケース選定・処理 | L | ★★★★★ |

**Phase 0 の exit criteria:** 循環器医/麻酔科医が pseudo-TEE を見て「ME 4C の四腔が分かる」と言える。

## Phase 1: Spatial Reasoning Trainer（4-8週）

| Task | 手法 | 工数 |
|------|------|------|
| **UI 刷新 (ADR-0002 P0)** | TopBar 1行化、Depth Scrubber + Flex Pad + Omniplane Dial | L |
| **Echo-like appearance** | structure-aware speckle, TGC, boundary enhancement (label VTI ベース) | L |
| **3D scene 改善** | solid rendering + structure transparency + highlighting | M |
| **Onboarding** | 初回 welcome + ME 4C ガイド付きチュートリアル | M |
| **Proximity guidance** | "Omniplane +15°" 方向ヒント（Near 状態で） | M |
| **Deploy** | Cloudflare Pages + asset CDN | S |
| **CI/CD** | GitHub Actions: lint + typecheck + unit + E2E | M |
| **2-3 追加ケース** | TotalSegmentator CTA 2-3ケースをパイプラインで処理 | L |

**Phase 1 の exit criteria:** 研修医に1人使わせてフィードバックを得る。SCA 2027 abstract 準備。

## Phase 2: Structured Learning（9-14週）

| Task | 手法 | 工数 |
|------|------|------|
| **Tutorial engine** | JSON-driven step sequencer, 10 view tutorials | L |
| **Scoring + progress** | localStorage → Cloudflare D1, competency tiers | L |
| **20 views 拡張** | ASE 28 views のうち 20 をカバー | L |
| **Pathology ケース** | LV dysfunction, AS, MR (要造影 CTA + 病態データ) | XL |
| **Responsive tablet** | 2-pane layout, bottom sheet controls | M |
| **Accessibility** | ARIA, focus management, contrast | M |
| **i18n** | 日本語 + 英語 | M |

## Phase 3: Platform（15週+）

| Task | 手法 | 工数 |
|------|------|------|
| **DICOM route** | dcmjs → vtkImageData (Phase 1), Cornerstone3D (Phase 2+) | XL |
| **Educator dashboard** | Auth + assignment + progress tracking | XL |
| **Cardiac motion** | Sunnybrook ED→ES retarget | XL |
| **Valve visualization** | CTA-derived valve planes, leaflet meshes | XL |
| **AI integration** | Geometry-based structure detection → ML view classification | XL |
| **WebGPU** | VTK.js WebGPU backend (compute shaders for reslice) | L |
| **Plugin system** | Community contribution framework | L |

---

## 今すぐやるべき5つ（全提案の合意）

1. **Label VTI + チャンバー色分け** — TotalSegmentator で心臓を LV/RV/LA/RA に分離し、pseudo-TEE にカラーオーバーレイ
2. **造影 CTA ケースを1つ入手** — 血液-心筋コントラスト 200+ HU で全ビューが劇的に改善
3. **TopBar 1行化 + developer chrome 削除** — 画面の80%をシミュレーション領域に
4. **TG SAX 修正** — VTI ROI 拡大で唯一の FAIL ビューを修復
5. **1人の循環器医にスクショを見せてフィードバックを得る**

## ターゲットマイルストーン

| 日程 | マイルストーン |
|------|---------------|
| **2026年4月** | Phase 0 完了 — チャンバー視認可能 |
| **2026年6月** | Phase 1 完了 — 研修医に使える状態 |
| **2026年9月** | SCA 2027 abstract 投稿 |
| **2026年12月** | Phase 2 完了 — 構造化学習 |

## 競合との差別化

| | TeeSim (現在) | TeeSim (Phase 2) | Virtual TEE Toronto | HeartWorks |
|---|---|---|---|---|
| 価格 | 無料 (OSS) | 無料 (OSS) | 無料 (非OSS) | ~$50K+ |
| 連続 probe 操作 | ✅ | ✅ | ❌ (離散ビュー) | ✅ |
| ブラウザ動作 | ✅ | ✅ | ✅ (HTML5) | ❌ |
| CT/CTA ベース | ✅ | ✅ | ❌ (3D モデル) | ❌ (3D モデル) |
| 自前データ対応 | Phase 2 | ✅ (DICOM) | ❌ | ❌ |
| 多言語 | ❌ | ✅ | ✅ (10言語) | ❌ |
| チュートリアル | ❌ | ✅ | ❌ | ✅ |
| Doppler | ❌ | ❌ | ✅ | ✅ |

---

## Related

- [Rendering roadmap](../research/2026-04-06-roadmap-rendering.md) (Codex)
- [Data pipeline roadmap](../research/2026-04-06-roadmap-data-pipeline.md) (Codex)
- [Product strategy roadmap](../research/2026-04-06-roadmap-product.md) (Opus)
- [Architecture roadmap](../research/2026-04-06-roadmap-architecture.md) (Opus)
