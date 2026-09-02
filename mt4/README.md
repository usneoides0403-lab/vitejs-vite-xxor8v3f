# FXポジション可視化ツール (MT4)

「多くの人がどちら向きに、どの価格帯にポジションを持っているか」をMT4のチャート上に表示します。
2系統のツールが入っています。

| ツール | 何が見えるか | データ源 |
| --- | --- | --- |
| **OANDA Book Profile** | 価格帯ごとの注文・ポジションの分布（横棒ヒストグラム） | OANDA v20 REST API |
| **IG Client Sentiment Gauge** | 全体のロング/ショート比率のみ | IG Client Sentiment API |

価格帯の集中を見たいなら **OANDA Book Profile** の方です。IGのAPIは比率しか返しません。

## ファイル構成

```
MQL4/Experts/     OANDA_Book_Feeder.mq4            OANDA API通信
                  IG_ClientSentiment_Feeder.mq4    IG API通信
MQL4/Indicators/  OANDA_Book_Profile.mq4           価格帯ヒストグラム描画
                  IG_ClientSentiment_Gauge.mq4     比率パネル描画
MQL4/Include/     OandaBook/OandaBook.mqh          共有定義
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

# A. OANDA Book Profile — 価格帯別の分布

OANDAが公開している2種類のブックをチャートに重ね描きします。

- **Order Book（未約定注文の分布）**: 指値・逆指値がどの価格に置かれているか。
  「ストップが溜まっている価格」を見るならこちら。
- **Position Book（保有ポジションの分布）**: 実際に建っているポジションがどの価格で持たれているか。
  「含み損を抱えた集団がどこにいるか」を見るならこちら。

チャート左側に、中央線から**右向き＝ロング（青）／左向き＝ショート（赤）**の横棒を価格帯ごとに描画します。
棒の長さは表示中の価格帯のうち最大のものを基準にした相対値です。
特に集中している価格帯には水平線（既定3本）を引きます。

## セットアップ

1. **OANDAの口座とAPIトークン**
   fxTradeの管理画面（My Account → Manage API Access）でパーソナルアクセストークンを発行します。
   デモ口座（fxPractice）で無料発行でき、入金は不要です。

2. **WebRequest許可**
   ツール → オプション → エキスパートアドバイザー →「WebRequestを許可するURL」に追加:
   - `https://api-fxpractice.oanda.com` （デモ）
   - `https://api-fxtrade.oanda.com` （本番）

3. **フィーダーEAをアタッチ**
   任意のチャート1枚に `OANDA_Book_Feeder` をアタッチし、`InpApiToken` にトークンを設定。
   「自動売買を許可する」をONにしてください（タイマー駆動のために必要。売買注文は一切出しません）。
   複数銘柄を見たい場合は `InpInstruments` にカンマ区切りで指定すれば、EA1つで賄えます
   （例: `EURUSD,USDJPY,GBPJPY`）。

4. **インジケーターをアタッチ**
   見たいチャートに `OANDA_Book_Profile` をアタッチし、`InpBookType` で表示するブックを選びます。
   注文とポジションの両方を同時に見たい場合は、種別を変えて2つアタッチしてください。

### フィーダーEAのパラメータ

| パラメータ | 既定値 | 説明 |
| --- | --- | --- |
| `InpApiToken` | - | OANDAのAPIトークン |
| `InpTokenFile` | 空 | `MQL4\Files` 内のトークンファイル名（指定時は上より優先） |
| `InpUsePractice` | `true` | `false` で本番(fxTrade)環境 |
| `InpInstruments` | 空 | 対象銘柄。カンマ区切り可。空欄ならチャートのシンボル |
| `InpFetchOrderBook` | `true` | 未約定注文の分布を取得 |
| `InpFetchPositions` | `true` | 保有ポジションの分布を取得 |
| `InpPriceRangePct` | `3.0` | 現在値から±何%の価格帯まで保存するか |
| `InpRefreshMinutes` | `10` | 更新間隔（分）。OANDA側は20分ごとの更新 |

### インジケーターのパラメータ

| パラメータ | 既定値 | 説明 |
| --- | --- | --- |
| `InpBookType` | Order Book | 表示するブックの種別 |
| `InpInstrumentOverride` | 空 | 銘柄手動指定（`EUR_USD` 形式。フィーダーと揃える） |
| `InpProfileBars` | `18` | ヒストグラム片側の幅（バー本数） |
| `InpMaxRows` | `120` | 描画する価格帯の最大本数。超えたら隣接帯を束ねる |
| `InpTopLevels` | `3` | 集中している価格帯に引く水平線の本数 |
| `InpShowPanel` | `true` | 右上の集計パネルを表示 |
| `InpLongColor` / `InpShortColor` / `InpTopLineColor` | - | 配色 |

銘柄名は `EURUSD` → `EUR_USD` に自動変換します。ブローカーのシンボルにサフィックスが付く場合
（`EURUSD.a` など）は先頭6文字で判定するので通常はそのままで動きますが、
うまくいかない場合は `InpInstrumentOverride` に `EUR_USD` 形式で指定してください。

### OANDAブックの限界（重要）

- **OANDAの顧客のポジションのみ**です。FX市場全体の板ではありません。個人投資家の偏りを見る
  代理指標として使われているものです。
- 更新は**20分ごと**。リアルタイムではありません。
- 提供されるのは主要通貨ペア中心です。非対応の銘柄はパネルに
  「この銘柄のブックは提供されていません」と表示されます。
- 数値は「口座数ベースの割合(%)」であり、金額（ロット）ベースではありません。

---

# B. IG Client Sentiment Gauge — 全体の比率

IGの顧客のロング/ショート比率をパネル表示します。価格帯の情報はありません。
コントラリアン指標として、既定では65%を超えると警戒色になります。

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

# 認証情報の扱い

EAの入力欄に入れたパスワードやトークンは平文で保存され、`.set` / `.chr` ファイルにも残ります。
**専用のデモ口座を使うことを強く推奨します。**

チャート設定に残したくない場合は、`InpCredentialsFile` / `InpTokenFile` に
`MQL4\Files` 配下のファイル名を指定するとそちらから読み込みます。

```
# ig_credentials.txt
identifier=your_ig_login_id
password=your_password
apikey=your_api_key
```

```
# oanda_token.txt
token=your-oanda-api-token
```

ファイル自体も平文である点は変わりません。テンプレートやセットファイルを他人に渡すときに
資格情報が同梱されない、という程度の利点です。

---

# ステータス表示

パネル最下段に状態が出ます。

| 表示 | 意味 |
| --- | --- |
| `更新: yyyy.mm.dd hh:mm` | 正常。最終取得時刻 |
| `取得待ち...` | フィーダー起動直後、初回取得前 |
| `フィーダーEAが動作していません` | フィーダーの心拍が途切れている。EAがアタッチされているか、自動売買がONか確認 |
| `通信失敗: MT4のURL許可リストを確認してください` | `WebRequest()` が `-1`。許可URLの設定を確認 |
| `認証エラー` / `ログイン失敗` | トークンやID/パスワード、デモ/本番の取り違え |
| `取得失敗 HTTP=nnn` | APIがエラー応答。詳細はエキスパートログ（ターミナル → エキスパート）|
| `この銘柄のブックは提供されていません` | OANDAがその銘柄のブックを出していない |

---

# 他のデータ源について

price levelまで見られる無料のデータ源は限られます。

- **OANDA Order/Position Book**（本ツールで採用）— 価格帯別の分布が取れる唯一の実用的な無料API
- **IG Client Sentiment**（本ツールで採用）— 比率のみ
- **Myfxbook Community Outlook** — 比率＋各サイドの平均価格。分布ではないが「平均建値」は取れる
- **CFTC建玉明細(COT)** — 週次・機関投資家中心。価格帯情報なし
- **取引所FX（くりっく365）の売買比率** — 比率のみ、日次

いずれも「その業者の顧客」のデータであって市場全体ではない点は共通です。
偏りの傾向を見る道具であり、そのままシグナルにはなりません。
