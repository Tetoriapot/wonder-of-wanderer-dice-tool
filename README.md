# WONDER of WANDERER 判定補助ツール

TRPG『WONDER of WANDERER』のココフォリア用チャパレ式作成と、判定ログの成功度再計算を行う非公式ファンメイドツールです。

## 主な機能

- 能力値、得意分野、装備、ギフト等からココフォリ用 `WW12` 式を生成
- ココフォリの判定ログから大成功、大失敗、相殺、ファンブルを再計算
- 超成功、出目変更、判定値変更、確定結果のコピーに対応
- 通常、ダーク、シンプル（グレースケール）の3表示モード
- サーバー・npm・外部API不要

## ローカルで使う

[`dice/index.html`](dice/index.html) をブラウザーで直接開いてください。入力した内容はブラウザー内だけで処理されます。

## GitHub Pagesで公開する

1. GitHubで空のパブリックリポジトリを作成します。
2. このフォルダーの内容を `main` ブランチへpushします。
3. GitHubの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
4. `Deploy GitHub Pages` ワークフローがテスト後、`dice/` を公開します。

公開URLは通常、プロジェクトサイトの場合は次の形になります。

```text
https://<GitHubユーザー名>.github.io/<リポジトリ名>/
```

## 開発・確認

Node.jsがある場合、外部パッケージなしで回帰テストを実行できます。

```powershell
node .\dice\tests\run-tests.js
```

## ディレクトリ構成

```text
.
├─ .github/workflows/pages.yml
├─ dice/
│  ├─ index.html
│  ├─ style.css
│  ├─ script.js
│  └─ tests/run-tests.js
└─ README.md
```

## 注意

- 本ツールは非公式であり、『WONDER of WANDERER』の公式または権利者とは関係ありません。
- GitHub Pagesの公開サイトに、秘密情報や個人情報を含めないでください。
- 現在、ソースコードの利用条件を定める `LICENSE` ファイルは未設定です。
