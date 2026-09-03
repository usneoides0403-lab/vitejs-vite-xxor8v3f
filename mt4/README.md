# FXポジション可視化ツール (MT4)

「多くの人がどちら向きに、どの価格帯にポジションを持っているか」をMT4のチャート上に表示します。
2系統のツールが入っています。

| ツール | 何が見えるか | データ源 | 口座・認証 |
| --- | --- | --- | --- |
| **OANDA Widget Profile** | 価格帯ごとの分布（横棒ヒストグラム） | `widget.oanda.jp` の非公式API | 不要 |
| **IG Client Sentiment Gauge** | 全体のロング/ショート比率のみ | IG Client Sentiment API | IGデモ口座＋APIキー |

価格帯の集中を見たいなら **OANDA Widget Profile** の方です。

## ファイル構成

```
MQL4/Experts/     OANDA_Widget_Feeder.mq4          widget.oanda.jp通信
                  IG_ClientSentiment_Feeder.mq4    IG API通信
MQL4/Indicators/  OANDA_Widget_Profile.mq4         価格帯ヒストグラム描画
                  IG_ClientSentiment_Gauge.mq4     比率パネル描画
MQL4/Include/     OandaWidget/OandaWidget.mqh      共有定義
                  IGSentiment/IGSentiment.mqh      共有定義
```

MT4のデータフォルダ（ファイル → データフォルダを開く）の `MQL4` 配下に同じ構造で配置し、
MetaEditorでEAとインジケーターをコンパイルしてください。

### なぜEAとインジケーターに分かれているのか

MT4のインジケーターからは `WebRequest()` を呼べません（インジケーターはUIスレッドで実行されるため、
ブロッキングする通信関数が禁止されています）。単体のインジケーターでHTTPを叩こうとすると
`WebRequest()` は常に `-1` を返し、データが永久に取得できません。

そのため通信はEA（フィーダー）が担当し、取得結果を
グローバル変数（集計値・状態）と `MQL4\Files` のCSV（価格帯の分布）経由で
インジケーター（表示）へ渡す構成にしています。

---

# A. OANDA Widget Profile — 価格帯別の分布(口座不要)

## これは何か、どうやって見つけたか

OANDA証券（日本法人）の公式REST APIは本番口座＋GOLD会員が前提で、デモ環境からは使えませんでした。
一方、OANDA証券が公開しているオーダーブックの解説ページ（ログイン不要で誰でも閲覧可）は、
裏側で `https://widget.oanda.jp/api/order-book?instrument=USD_JPY&ago=0` という
**認証不要・口座不要のJSON API**を叩いてグラフを描画しています。ブラウザの開発者ツールで
このリクエストを確認し、本ツールはそれをそのまま利用しています。

```json
{
  "orderBook": {
    "bucketWidth": "0.0500",
    "buckets": [
      { "price": 0,    "longCountPercent": 1.89,  "shortCountPercent": 3.79 },
      { "price": 0.05, "longCountPercent": 0.38,  "shortCountPercent": 0    },
      { "price": 1,    "longCountPercent": 18.17, "shortCountPercent": 8.71 }
    ]
  }
}
```

**重要な注意点**

- これは**OANDA証券が公式にドキュメント化しているAPIではありません**。ラボページ自身が使っている
  内部APIを流用しているだけなので、**予告なく仕様変更・停止される可能性があります**。動かなくなった
  場合は`widget.oanda.jp`のページ構成が変わった可能性が高いです。
- レスポンスに現在の絶対レートは含まれておらず、`price`は**現在レートからの相対オフセット**
  （建値通貨単位。上の例なら円）とみなして実装しています。絶対価格への変換はインジケーター側で
  MT4の現在値(Bid)に加算して行います。符号（上振れがプラスかマイナスか）は未検証のため、
  表示が実際のOANDAページと上下逆に見える場合は `InpInvertOffset` を`true`にしてください。
- エンドポイント名が `order-book` であることから未約定注文（指値・逆指値）の分布と推測していますが、
  保有ポジションの分布である可能性も残ります。実体を確認したら `InpBookTitle` の表示名を
  実態に合わせて変更してください。
- 個人利用の範囲に留め、`InpRefreshMinutes` を極端に短くして高頻度にアクセスしないようにしてください。

## セットアップ

1. **WebRequest許可**
   ツール → オプション → エキスパートアドバイザー →「WebRequestを許可するURL」に追加:
   - `https://widget.oanda.jp`

2. **フィーダーEAをアタッチ**
   任意のチャート1枚に `OANDA_Widget_Feeder` をアタッチ。認証情報の入力は不要です。
   「自動売買を許可する」をONにしてください（タイマー駆動のために必要。売買注文は一切出しません）。
   複数銘柄を見たい場合は `InpInstruments` にカンマ区切りで指定すれば、EA1つで賄えます
   （例: `EURUSD,USDJPY,GBPJPY`）。

3. **インジケーターをアタッチ**
   見たいチャートに `OANDA_Widget_Profile` をアタッチします。

4. **表示の向きを確認**
   数十秒後、チャート上に青(ロング)/赤(ショート)の横棒が表示されます。実際のOANDAページ
   （`https://www.oanda.jp/lab-education/oanda_lab/oanda_rab/open_position/`）と見比べて、
   集中している価格帯の位置が上下逆に見える場合は `InpInvertOffset` を `true` にしてください。

### フィーダーEAのパラメータ

| パラメータ | 既定値 | 説明 |
| --- | --- | --- |
| `InpInstruments` | 空 | 対象銘柄。カンマ区切り可。空欄ならチャートのシンボル |
| `InpBookLabel` | `ORDER` | 保存ファイル/グローバル変数の識別ラベル。インジケーター側と揃える |
| `InpBookPath` | `order-book` | `widget.oanda.jp`のAPIパス。エンドポイントが増えた場合に変更 |
| `InpAgo` | `0` | APIの`ago`パラメータ(0=最新) |
| `InpRefreshMinutes` | `10` | 更新間隔（分） |

### インジケーターのパラメータ

| パラメータ | 既定値 | 説明 |
| --- | --- | --- |
| `InpInstrumentOverride` | 空 | 銘柄手動指定（`EUR_USD`形式。フィーダーと揃える） |
| `InpBookLabel` | `ORDER` | フィーダーの`InpBookLabel`と揃える |
| `InpBookTitle` | `オーダー` | パネル表示名。実体を確認したら変更可 |
| `InpInvertOffset` | `false` | オフセットの符号を反転（表示が上下逆に見える場合） |
| `InpProfileBars` | `18` | ヒストグラム片側の幅（バー本数） |
| `InpMaxRows` | `120` | 描画する価格帯の最大本数。超えたら隣接帯を束ねる |
| `InpTopLevels` | `3` | 集中している価格帯に引く水平線の本数 |
| `InpShowPanel` | `true` | 右上の集計パネルを表示 |

---

# B. IG Client Sentiment Gauge — 全体の比率

IGの顧客のロング/ショート比率をパネル表示します。価格帯の情報はありません。
コントラリアン指標として、既定では65%を超えると警戒色になります。

**注意**: IG証券（日本法人）はAPIアクセスを提供していません。ここで使うのはIG Markets Limited
(グローバル/英国拠点)のREST APIです。お使いのIGアカウントが日本法人のものである場合、
APIキー自体が発行されない可能性があります。My IG → 設定 → API keys で確認してください。

## セットアップ

1. **IG APIキー取得**: My IG → 設定 → API keys（デモ口座で無料開設可、資金不要）
2. **WebRequest許可**: 「WebRequestを許可するURL」に `https://demo-api.ig.com` と
   `https://api.ig.com` を追加
3. `IG_ClientSentiment_Feeder`（EA）を1枚のチャートにアタッチし、ID / パスワード / APIキーを設定
4. `IG_ClientSentiment_Gauge`（インジケーター）を見たいチャートにアタッチ

`marketId` はシンボル先頭6文字から自動判定します。指数・商品を見たい場合や
ブローカーのシンボルが特殊な場合は `InpMarketIdOverride` で手動指定してください。

### パラメータ

| パラメータ | 既定値 | 説明 |
| --- | --- | --- |
| `InpUseDemo` | `true` | `false` で本番API |
| `InpRefreshMinutes` | `15` | 更新間隔（分） |
| `InpWarnThreshold` | `65.0` | この%を超えたら逆張り警戒色 |
| `InpStaleMinutes` | `45` | 最終更新がこれより古ければグレー表示 |

---

# 認証情報の扱い(IG)

EAの入力欄に入れたパスワードやAPIキーは平文で保存され、`.set` / `.chr` ファイルにも残ります。
**専用のデモ口座を使うことを強く推奨します。**

チャート設定に残したくない場合は、`InpCredentialsFile` に `MQL4\Files` 配下のファイル名を指定すると
そちらから読み込みます（入力欄の3項目より優先）。

```
# ig_credentials.txt
identifier=your_ig_login_id
password=your_password
apikey=your_api_key
```

ファイル自体も平文である点は変わりません。テンプレートやセットファイルを他人に渡すときに
資格情報が同梱されない、という程度の利点です。OANDA Widget Profileは認証情報を一切使わないため、
この項目は関係ありません。

---

# ステータス表示

パネル最下段に状態が出ます。

| 表示 | 意味 |
| --- | --- |
| `取得: yyyy.mm.dd hh:mm` / `更新: yyyy.mm.dd hh:mm` | 正常。最終取得時刻 |
| `取得待ち...` | フィーダー起動直後、初回取得前 |
| `フィーダーEAが動作していません` | フィーダーの心拍が途切れている。EAがアタッチされているか、自動売買がONか確認 |
| `通信失敗: MT4のURL許可リストを確認してください` | `WebRequest()` が `-1`。許可URLの設定を確認 |
| `認証エラー` / `ログイン失敗` | (IGのみ)トークンやID/パスワード、デモ/本番の取り違え |
| `取得失敗 HTTP=nnn` | APIがエラー応答。詳細はエキスパートログ（ターミナル → エキスパート）|
| `応答の解析に失敗しました` | APIの応答形式が想定と異なる。仕様変更の可能性 |

---

# 各データ源の限界

- **OANDA Widget Profile**: OANDAの顧客のみのデータで、市場全体の板ではありません。非公式API
  なので予告なく止まる可能性があります。更新頻度は不明（ログインユーザー向けは5〜20分間隔と
  案内されているため、それに準じると推測）。
- **IG Client Sentiment**: 比率のみで価格帯情報はありません。IGの顧客のみのデータです。

いずれも「その業者の顧客」のデータであって市場全体ではない点は共通です。
偏りの傾向を見る道具であり、そのままシグナルにはなりません。
