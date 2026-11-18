# dsh-cam-plugin

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [العربية](README.ar.md)

ローカルの [cam](https://github.com/HanochZhu/codeagent_memory)（code agent memory。プロジェクト内のコードグラフと解法メモリ）を [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH、DeepSeek のエージェントランタイム）に接続します。

プラグインはローカルの `cam --json` を呼び出します。メモリとコードグラフは対象プロジェクトの `.cam/cam.db` に残り、アップロードされません。

## 前提

`cam` が `PATH` 上にあり、`cam --help` が動くこと。このパッケージにバイナリは含まれません。

## インストール

```sh
dsh plugin --profile <profile> add github:HanochZhu/dsh-cam-plugin
```

エントリは素の ESM なので、インストール時にビルドスクリプトは走りません。そのプロファイルで起動します。

```sh
dsh --profile <profile>
```

`--dump-config` の層一覧に `# == dsh-cam-plugin` が出ます。

バイナリや既定プロジェクトを固定するには、プロファイルの `cordis.patch.yml` で id `cam` の行を上書きします。この層はその行の `config` 全体を置き換えます。

```yaml
- id: cam
  config:
    camBin: cam
    project: D:/work/my-repo
```

`project` は省略できます。各ツールは `path` を受け取ります。どちらも無いとき、cam は `CAM_PROJECT` を使い、なければプロセスの作業ディレクトリから `.cam` または `.git` を上へ探します。

バンドルとしてインストールせず、チェックアウトを試すとき:

```sh
dsh web --patch ./cordis.example.yml
```

`cordis.example.yml` のプラグインパスは絶対パスである必要があります。

## ツール

| ツール | 役割 |
| --- | --- |
| `cam_recall` | 英語一文で解法メモリを検索する |
| `cam_index` | 初回にグラフを作り、その後は差分だけ更新する |
| `cam_ls` / `cam_find` / `cam_grep` | ディレクトリ一覧、シンボル名検索、リテラルテキスト検索 |
| `cam_read` / `cam_ref` | シンボルを一つ読む。呼び出し元（`in`）と呼び出し先（`out`）を見る |
| `cam_add` / `cam_mem_show` / `cam_mem_tree` | メモリを一つ書く、id で見る、木を表示する |
| `cam_status` | 解決されたプロジェクトとデータベースを見る |

Harness に skill サービスがあるとき、プラグインはランタイム skill `cam` を登録します。手順は上のツールと同じです。

## 開発

```sh
npm test
```
