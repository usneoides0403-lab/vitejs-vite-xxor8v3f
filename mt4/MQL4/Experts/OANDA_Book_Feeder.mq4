//+------------------------------------------------------------------+
//|                                       OANDA_Book_Feeder.mq4       |
//|  OANDA v20 REST APIから Order Book / Position Book を取得し、      |
//|  CSV(MQL4\Files) と グローバル変数に公開するフィーダーEA             |
//|                                                                   |
//|  表示は OANDA_Book_Profile.mq4 (インジケーター) が担当する。         |
//|  MT4のインジケーターからは WebRequest() を呼べないため、通信は        |
//|  必ずEA側で行う必要がある。                                          |
//+------------------------------------------------------------------+
#property copyright "Takanori"
#property strict

#include <OandaBook/OandaBook.mqh>

//--- 入力パラメータ
input string InpApiToken       = "";      // OANDA APIトークン (fxTradeの管理画面で発行)
input string InpTokenFile      = "";      // MQL4\Files内のトークンファイル(指定時はInpApiTokenより優先)
input bool   InpUsePractice    = true;    // デモ(fxPractice)環境を使う。false=本番(fxTrade)
input string InpInstruments    = "";      // 対象銘柄。カンマ区切り可 (空欄ならチャートのシンボル)
input bool   InpFetchOrderBook = true;    // 未約定注文の分布を取得
input bool   InpFetchPositions = true;    // 保有ポジションの分布を取得
input double InpPriceRangePct  = 3.0;     // 現在値から±何%の価格帯まで保存するか
input int    InpRefreshMinutes = 10;      // 更新間隔(分)。OANDA側は20分ごとの更新
input bool   InpVerboseLog     = false;   // 応答サイズなどをログに出す

//--- グローバル変数
string   g_token = "";
string   g_instruments[];
bool     g_configOk  = false;
datetime g_nextFetch = 0;

#define OB_TICK_SEC       20      // タイマー周期。心拍の更新間隔でもある
#define OB_RETRY_SEC      60      // 取得失敗時の再試行間隔
#define OB_HTTP_TIMEOUT   15000   // ブックは応答が大きいので長めに

//+------------------------------------------------------------------+
string BaseUrl()
{
   return(InpUsePractice ? "https://api-fxpractice.oanda.com" : "https://api-fxtrade.oanda.com");
}

//+------------------------------------------------------------------+
int OnInit()
{
   BuildInstrumentList();
   g_configOk = LoadToken();

   if(!g_configOk)
      Print("OANDAフィーダー: APIトークンが設定されていません");
   if(!InpFetchOrderBook && !InpFetchPositions)
      Print("OANDAフィーダー: 取得対象が1つも選択されていません");

   PublishAll(g_configOk ? OB_ST_PENDING : OB_ST_CONFIG, 0);
   PublishHeartbeat();

   // 取得間隔とは別に短周期でタイマーを回し、心拍を更新し続ける
   g_nextFetch = TimeCurrent();
   EventSetTimer(OB_TICK_SEC);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
void OnTick()
{
   // ティックでは何もしない。取得はタイマー駆動。
}

//+------------------------------------------------------------------+
void OnTimer()
{
   PublishHeartbeat();

   if(TimeCurrent() < g_nextFetch)
      return;

   bool ok = FetchAll();
   int  wait = ok ? (int)MathMax(60, InpRefreshMinutes * 60) : OB_RETRY_SEC;
   g_nextFetch = TimeCurrent() + wait;
}

//+------------------------------------------------------------------+
//| 対象銘柄リストの構築                                                |
//+------------------------------------------------------------------+
void BuildInstrumentList()
{
   ArrayResize(g_instruments, 0);

   string src = InpInstruments;
   StringTrimLeft(src);
   StringTrimRight(src);
   if(StringLen(src) == 0)
      src = Symbol();

   string parts[];
   int n = StringSplit(src, ',', parts);
   for(int i = 0; i < n; i++)
     {
      string p = parts[i];
      StringTrimLeft(p);
      StringTrimRight(p);
      if(StringLen(p) == 0)
         continue;
      int sz = ArraySize(g_instruments);
      ArrayResize(g_instruments, sz + 1);
      g_instruments[sz] = OB_Instrument(p);
     }
}

//+------------------------------------------------------------------+
//| APIトークンの読み込み                                               |
//| ファイル形式: token=xxxxx (1行1項目、#はコメント)                    |
//+------------------------------------------------------------------+
bool LoadToken()
{
   g_token = InpApiToken;
   StringTrimLeft(g_token);
   StringTrimRight(g_token);

   if(StringLen(InpTokenFile) > 0)
     {
      int h = FileOpen(InpTokenFile, FILE_READ | FILE_TXT | FILE_ANSI | FILE_SHARE_READ);
      if(h == INVALID_HANDLE)
        {
         Print("OANDAフィーダー: トークンファイルを開けません: ", InpTokenFile,
               " code=", GetLastError());
         return(false);
        }
      while(!FileIsEnding(h))
        {
         string line = FileReadString(h);
         StringTrimLeft(line);
         StringTrimRight(line);
         if(StringLen(line) == 0 || StringGetCharacter(line, 0) == '#')
            continue;
         int eq = StringFind(line, "=");
         if(eq <= 0)
            continue;
         string k = StringSubstr(line, 0, eq);
         string v = StringSubstr(line, eq + 1);
         StringTrimLeft(k); StringTrimRight(k); StringToLower(k);
         StringTrimLeft(v); StringTrimRight(v);
         if(k == "token" || k == "apitoken" || k == "api_token")
            g_token = v;
        }
      FileClose(h);
     }

   return(StringLen(g_token) > 0);
}

//+------------------------------------------------------------------+
//| 全銘柄・全種別の取得                                                |
//+------------------------------------------------------------------+
bool FetchAll()
{
   if(!g_configOk)
     {
      PublishAll(OB_ST_CONFIG, 0);
      return(false);
     }

   bool allOk = true;
   int  n = ArraySize(g_instruments);

   for(int i = 0; i < n; i++)
     {
      if(InpFetchOrderBook)
         if(!FetchBook(g_instruments[i], OB_TYPE_ORDER))
            allOk = false;
      if(InpFetchPositions)
         if(!FetchBook(g_instruments[i], OB_TYPE_POSITION))
            allOk = false;
     }
   return(allOk);
}

//+------------------------------------------------------------------+
//| 1銘柄・1種別の取得                                                  |
//+------------------------------------------------------------------+
bool FetchBook(const string instrument, const string bookType)
{
   string endpoint = (bookType == OB_TYPE_ORDER) ? "orderBook" : "positionBook";
   string rootKey  = (bookType == OB_TYPE_ORDER) ? "orderBook" : "positionBook";
   string url      = BaseUrl() + "/v3/instruments/" + instrument + "/" + endpoint;

   string headers = "Authorization: Bearer " + g_token + "\r\n"
                    "Accept-Datetime-Format: UNIX\r\n"
                    "Content-Type: application/json\r\n";

   char data[];
   char result[];
   string result_headers;

   ResetLastError();
   int res = WebRequest("GET", url, headers, OB_HTTP_TIMEOUT, data, result, result_headers);

   if(res == -1)
     {
      Print("OANDAフィーダー: WebRequest失敗 code=", GetLastError(),
            " ※ツール→オプション→エキスパートアドバイザーの許可URLに ",
            BaseUrl(), " を追加してください");
      Publish(instrument, bookType, OB_ST_WEBREQ, 0);
      return(false);
     }

   if(res == 401 || res == 403)
     {
      Print("OANDAフィーダー: 認証エラー HTTP=", res, " ", CharArrayToString(result));
      Publish(instrument, bookType, OB_ST_AUTH, res);
      return(false);
     }

   if(res != 200)
     {
      Print("OANDAフィーダー: 取得失敗 HTTP=", res, " ", instrument, "/", bookType,
            " body=", CharArrayToString(result));
      // 400/404はブック非対応の銘柄であることが多い
      Publish(instrument, bookType, (res == 400 || res == 404) ? OB_ST_NODATA : OB_ST_HTTP, res);
      return(false);
     }

   string body = CharArrayToString(result);
   if(InpVerboseLog)
      Print("OANDAフィーダー: ", instrument, "/", bookType, " ", StringLen(body), "文字");

   OBHeader hdr;
   OBBucket buckets[];
   if(!ParseBook(body, rootKey, instrument, bookType, hdr, buckets))
     {
      Publish(instrument, bookType, OB_ST_PARSE, res);
      return(false);
     }

   if(hdr.count == 0)
     {
      Publish(instrument, bookType, OB_ST_NODATA, res);
      return(false);
     }

   if(!OB_WriteCsv(hdr, buckets))
     {
      Publish(instrument, bookType, OB_ST_PARSE, res);
      return(false);
     }

   GlobalVariableSet(OB_VarName(instrument, bookType, "Long"),  hdr.totalLongPct);
   GlobalVariableSet(OB_VarName(instrument, bookType, "Short"), hdr.totalShortPct);
   GlobalVariableSet(OB_VarName(instrument, bookType, "Time"),  (double)hdr.time);
   Publish(instrument, bookType, OB_ST_OK, res);
   return(true);
}

//+------------------------------------------------------------------+
//| JSON解析                                                           |
//| 全価格帯を集計してから、現在値の±InpPriceRangePct%だけを保存する      |
//+------------------------------------------------------------------+
bool ParseBook(const string body, const string rootKey, const string instrument,
               const string bookType, OBHeader &hdr, OBBucket &buckets[])
{
   int posRoot = StringFind(body, "\"" + rootKey + "\"");
   if(posRoot < 0)
     {
      Print("OANDAフィーダー: 応答に ", rootKey, " がありません");
      return(false);
     }

   int posBuckets = StringFind(body, "\"buckets\"", posRoot);
   if(posBuckets < 0)
     {
      Print("OANDAフィーダー: 応答に buckets がありません");
      return(false);
     }

   // ルート側の項目は buckets より手前だけを見る (bucket内の price と混同しないため)
   string head = StringSubstr(body, posRoot, posBuckets - posRoot);

   hdr.instrument    = instrument;
   hdr.bookType      = bookType;
   hdr.price         = StringToDouble(JsonValue(head, "price"));
   hdr.bucketWidth   = StringToDouble(JsonValue(head, "bucketWidth"));
   hdr.time          = ParseSnapshotTime(head);
   hdr.count         = 0;
   hdr.totalLongPct  = 0;
   hdr.totalShortPct = 0;

   if(hdr.time == 0)
      hdr.time = TimeCurrent();
   if(hdr.price <= 0)
     {
      Print("OANDAフィーダー: 応答から価格を取得できませんでした");
      return(false);
     }

   double range = hdr.price * InpPriceRangePct / 100.0;
   double lo = hdr.price - range;
   double hi = hdr.price + range;

   ArrayResize(buckets, 0);
   int kept = 0;
   int pos  = posBuckets;
   int len  = StringLen(body);

   while(pos < len)
     {
      int pPrice = StringFind(body, "\"price\"", pos);
      if(pPrice < 0)
         break;
      int pEnd = StringFind(body, "}", pPrice);
      if(pEnd < 0)
         break;

      string seg = StringSubstr(body, pPrice, pEnd - pPrice);
      pos = pEnd + 1;

      double price = StringToDouble(JsonValue(seg, "price"));
      double lp    = StringToDouble(JsonValue(seg, "longCountPercent"));
      double sp    = StringToDouble(JsonValue(seg, "shortCountPercent"));
      if(price <= 0)
         continue;

      // 全体比率は範囲で絞る前に集計する
      hdr.totalLongPct  += lp;
      hdr.totalShortPct += sp;

      if(price < lo || price > hi)
         continue;
      if(lp <= 0 && sp <= 0)
         continue;

      ArrayResize(buckets, kept + 1, 256);
      buckets[kept].price    = price;
      buckets[kept].longPct  = lp;
      buckets[kept].shortPct = sp;
      kept++;
     }

   hdr.count = kept;
   return(true);
}

//+------------------------------------------------------------------+
//| ヘルパー: JSONから値を取り出す                                       |
//| OANDA v20は数値も文字列("1.08123")で返すため、両方に対応する           |
//+------------------------------------------------------------------+
string JsonValue(const string json, const string key)
{
   int pos = StringFind(json, "\"" + key + "\"");
   if(pos < 0)
      return("");
   pos = StringFind(json, ":", pos + StringLen(key) + 2);
   if(pos < 0)
      return("");
   pos++;

   int len = StringLen(json);
   while(pos < len && (StringGetCharacter(json, pos) == ' ' ||
                       StringGetCharacter(json, pos) == '\t'))
      pos++;
   if(pos >= len)
      return("");

   if(StringGetCharacter(json, pos) == '"')
     {
      pos++;
      int end = StringFind(json, "\"", pos);
      if(end < 0)
         return("");
      return(StringSubstr(json, pos, end - pos));
     }

   int start = pos;
   while(pos < len)
     {
      ushort ch = StringGetCharacter(json, pos);
      if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-' || ch == '+' ||
         ch == 'e' || ch == 'E')
         pos++;
      else
         break;
     }
   return(StringSubstr(json, start, pos - start));
}

//+------------------------------------------------------------------+
//| ヘルパー: スナップショット時刻                                        |
//| Accept-Datetime-Format: UNIX を付けているので unixTime / time とも    |
//| "1712345678.000000000" 形式で返る。想定外の形式なら0を返す。          |
//+------------------------------------------------------------------+
datetime ParseSnapshotTime(const string head)
{
   datetime t = ParseUnixTime(JsonValue(head, "unixTime"));
   if(t == 0)
      t = ParseUnixTime(JsonValue(head, "time"));
   return(t);
}

datetime ParseUnixTime(const string s)
{
   if(StringLen(s) == 0)
      return(0);
   int dot = StringFind(s, ".");
   string sec = (dot > 0) ? StringSubstr(s, 0, dot) : s;
   long v = StringToInteger(sec);
   if(v < 1000000000)   // RFC3339など想定外の形式を掴んでいる
      return(0);
   return((datetime)v);
}

//+------------------------------------------------------------------+
//| 状態の公開                                                          |
//+------------------------------------------------------------------+
void Publish(const string instrument, const string bookType, const int status, const int http)
{
   GlobalVariableSet(OB_VarName(instrument, bookType, "Status"), (double)status);
   GlobalVariableSet(OB_VarName(instrument, bookType, "Http"),   (double)http);
}

void PublishAll(const int status, const int http)
{
   int n = ArraySize(g_instruments);
   for(int i = 0; i < n; i++)
     {
      if(InpFetchOrderBook)
         Publish(g_instruments[i], OB_TYPE_ORDER, status, http);
      if(InpFetchPositions)
         Publish(g_instruments[i], OB_TYPE_POSITION, status, http);
     }
}

void PublishHeartbeat()
{
   int n = ArraySize(g_instruments);
   for(int i = 0; i < n; i++)
     {
      if(InpFetchOrderBook)
         GlobalVariableSet(OB_VarName(g_instruments[i], OB_TYPE_ORDER, "Beat"), (double)TimeCurrent());
      if(InpFetchPositions)
         GlobalVariableSet(OB_VarName(g_instruments[i], OB_TYPE_POSITION, "Beat"), (double)TimeCurrent());
     }
}
//+------------------------------------------------------------------+
