# Claude Code への最初の依頼文

下の枠の中をそのまま Claude Code に貼り付ける。

```
このフォルダで、ブラウザゲーム「PCタイクーン（仮題）」の試作1を作ってください。

最初に読むもの
- CLAUDE.md（構成と設計の決まり。必ず守る）
- docs/SPEC.md（試作1の仕様）
- docs/rough/ の画像（画面の見本）
- docs/balance.stage1.json（数値）と docs/sim_stage1.py（数値の根拠）

作る範囲
- docs/SPEC.md の「試作1で作る範囲」（段階1：開始から所持金40万円でクリアするまで）だけ。「作らないもの」には手を付けない

進め方
1. 読み終えたら、作る順番の計画と、仕様で分からない点を短く出してから始める。分からない点がなければそのまま進めてよい
2. 最初にルール本体（src/core）と Vitest を作る。SPEC 5章のボットを移植し、手触りの目安を確かめる
3. 次に React の画面と PixiJS の部屋を作り、Playwright（390×844）を通す。npm run screens でスクリーンショットを撮り、docs/rough/ と見比べる
4. git を始め、GitHub の 109mei/pc-tycoon（Public）に push し、GitHub Actions で GitHub Pages に公開する。リポジトリを作れない場合は、私がする手順を教えてください

完了の報告に入れること
- SPEC 10章の完了の条件をすべて満たしたか
- 手触りの目安の実測値と、目安との比較
- docs/screens/ のスクリーンショットと、ラフとの主な違い
- 仕様から変えた点・迷った点
- 公開した URL
```
