# PCタイクーン（仮題）開発の決まり

スマホ縦画面で遊ぶブラウザ向けの経営シミュレーション（タイクーン×incゲーム）。仕様は docs/SPEC.md、数値は docs/balance.stage1.json、画面の見本は docs/rough/ の画像。

## 構成

| 役割 | 使うもの |
|---|---|
| 土台 | Vite |
| 言語 | TypeScript（strict） |
| ルール本体 | src/core の Pure TypeScript。DOM・PixiJS・React・Zustand・localStorage を一切 import しない |
| 数値 | src/data/balance.json＋Zod（最初は docs/balance.stage1.json をコピーして作る。型は Zod のスキーマから作る） |
| 部屋の描画 | PixiJS（src/world） |
| 画面の部品 | React＋HTML/CSS（src/ui） |
| 橋渡し | Zustand（src/store）。画面に見せる写しだけを持つ |
| セーブ | src/save の SaveStore（今は localStorage。あとで Dexie に差し替えられる形にする） |
| テスト | Vitest（tests/）、Playwright（e2e/、390×844） |
| 公開 | GitHub Actions → GitHub Pages（https://109mei.github.io/pc-tycoon/。Vite の base は '/pc-tycoon/'） |

今は入れないもの：vite-plugin-pwa、Dexie、Web Worker、@pixi/react。

## 設計の決まり（必ず守る）

1. ゲームの状態の持ち主は src/core だけ。React・Zustand・PixiJS は状態を読んで描くだけ。書き換えは命令（workTap・hire など）を core に渡して行う。
2. core は決まった刻み（balance の tickSeconds）で進める。乱数は種つきの疑似乱数を core の状態に持たせ、同じ種なら同じ結果にする。Math.random と Date.now を core で使わない（時刻は外から渡す）。
3. 閉じていた間の進行は、core を同じ刻みでまとめて回して計算する（上限は balance の offlineMaxSeconds）。
4. 更新の頻度を分ける：PixiJS は毎フレーム、React の表示は1秒に10回程度、core は一定の刻み。所持金などの細かく変わる数字で毎フレーム React を描き直さない。
5. PixiJS は React の中で細かく管理しない。React は canvas を置く場所を1つ用意するだけで、部屋の中の物は PixiJS が core の状態を読んで描く。
6. 文字は HTML/CSS 側に置く。PixiJS に文字を描かせない。
7. スワイプは画面全体を包む要素で受け取り、canvas に取られないようにする。
8. セーブには版番号を入れ、古い版から新しい版へ変換する関数を用意する。書き出し・読み込み機能も付ける。
9. 数値をコードに直接書かない。balance.json に置く。
10. balance.json の数値は勝手に変えない。手触りの目安（SPEC 5章）から外れたら、指標と実測値を報告する。

## 見た目の決まり

- 書体は M PLUS Rounded 1c の1つだけ
- 画面に説明の文章を置かない。状況はアイコン・数字・物の量で伝える
- 配色は SPEC 8章の表のとおり。役割の違う物に同じ色を使わない
- ゲーム内の日付や時刻は出さない。時間は「あと◯秒」だけ
- 押せる物は44px以上
- グラフを描くときは横の目盛線（点線）を入れない

## フォルダ

- src/core：ルール本体（状態・進行・命令・乱数・ボット）
- src/data：balance.json と Zod のスキーマ
- src/store：Zustand
- src/ui：React の部品と CSS
- src/world：PixiJS の部屋の描画
- src/save：SaveStore
- tests：Vitest
- e2e：Playwright
- docs：SPEC.md、balance.stage1.json（元の数値）、rough/（ラフ）、screens/（実装のスクリーンショット）、sim_stage1.py（数値の根拠。参考資料）

## コマンド（用意すること）

- npm run dev：開発用サーバー
- npm test：Vitest
- npm run e2e：Playwright
- npm run build：公開用のビルド
- npm run screens：主な画面のスクリーンショットを docs/screens/ に保存

## 作業の進め方

- 変更したら npm test と npm run e2e を通してから報告する
- 画面を変えたら npm run screens でスクリーンショットを撮り、docs/rough/ と見比べて崩れがないか自分で確かめる
- UI の文言と報告は日本語で書く
- docs/sim_stage1.py は参考資料。ゲームからは使わない。ボットは TypeScript に移植する
