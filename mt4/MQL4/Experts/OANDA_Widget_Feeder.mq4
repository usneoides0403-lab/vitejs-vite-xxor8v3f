//+------------------------------------------------------------------+
//|                                     OANDA_Widget_Feeder.mq4       |
//|  widget.oanda.jp の非公式オーダーブックAPIを取得し、                  |
//|  CSV(MQL4\Files) と グローバル変数に公開するフィーダーEA              |
//|                                                                   |
//|  認証・口座不要。OANDA証券のラボページ自体が使っている内部APIを        |
//|  そのまま叩く。ドキュメント化されていないため、予告なく仕様変更/       |
//|  停止される可能性がある点に留意すること。                             |
//|                                                                   |
//|  表示は OANDA_Widget_Profile.mq4 (インジケーター) が担当する。        |
//|  MT4のインジケーターからは WebRequest() を呼べないため。               |
//+------------------------------------------------------------------+
#property copyright "Takanori"
#property strict

#include <OandaWidget/OandaWidget.mqh>

//--- 入力パラメータ
input string InpInstruments    = "";            // 対象銘柄。カンマ区切り可 (空欄ならチャートのシンボル)
input string InpBookLabel      = "ORDER";       // 保存用ラベル(表示側の識別子。パスと揃える)
input string InpBookPath       = "order-book";  // widget.oanda.jp のAPIパス (/api/<path>)
input int    InpAgo            = 0;             // ago パラメータ (0=最新)
input int    InpRefreshMinutes = 10;            // 更新間隔(分)
input bool   InpVerboseLog     = false;         // 応答本文をログに出す

//--- グローバル変数
string   g_instruments[];
datetime g_nextFetch = 0;

#define OW_TICK_SEC       20      // タイマー周期。心拍の更新間隔でもある
#define OW_RETRY_SEC      60      // 取得失敗時の再試行間隔
#define OW_HTTP_TIMEOUT   10000
#define OW_BASE_URL       "https://widget.oanda.jp"

//+------------------------------------------------------------------+
int OnInit()
{
   BuildInstrumentList();

   if(ArraySize(g_instruments) == 0)
     {
      Print("OANDAウィジェットフィーダー: 対象銘柄がありません");
      return(INIT_SUCCEEDED);
     }

   PublishAllStatus(OW_ST_PENDING, 0);
   PublishHeartbeat();

   g_nextFetch = TimeCurrent();
   EventSetTimer(OW_TICK_SEC);
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
   int  wait = ok ? (int)MathMax(60, InpRefreshMinutes * 60) : OW_RETRY_SEC;
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
      g_instruments[sz] = OW_Instrument(p);
     }
}

//+------------------------------------------------------------------+
bool FetchAll()
{
   bool allOk = true;
   int  n = ArraySize(g_instruments);
   for(int i = 0; i < n; i++)
      if(!FetchOne(g_instruments[i]))
         allOk = false;
   return(allOk);
}

//+------------------------------------------------------------------+
bool FetchOne(const string instrument)
{
   string url = OW_BASE_URL + "/api/" + InpBookPath +
                "?instrument=" + instrument + "&ago=" + IntegerToString(InpAgo);
   string headers = "Accept: application/json\r\n";

   char data[];
   char result[];
   string result_headers;

   ResetLastError();
   int res = WebRequest("GET", url, headers, OW_HTTP_TIMEOUT, data, result, result_headers);

   if(res == -1)
     {
      Print("OANDAウィジェットフィーダー: WebRequest失敗 code=", GetLastError(),
            " ※ツール→オプション→エキスパートアドバイザーの許可URLに ",
            OW_BASE_URL, " を追加してください");
      Publish(instrument, OW_ST_WEBREQ, 0);
      return(false);
     }

   if(res != 200)
     {
      Print("OANDAウィジェットフィーダー: 取得失敗 HTTP=", res, " ", instrument,
            " body=", CharArrayToString(result));
      Publish(instrument, OW_ST_HTTP, res);
      return(false);
     }

   string body = CharArrayToString(result);
   if(InpVerboseLog)
      Print("OANDAウィジェットフィーダー: ", instrument, " ", StringLen(body), "文字");

   OWHeader hdr;
   OWBucket buckets[];
   if(!ParseBook(body, instrument, hdr, buckets))
     {
      Publish(instrument, OW_ST_PARSE, res);
      return(false);
     }

   if(hdr.count == 0)
     {
      Publish(instrument, OW_ST_NODATA, res);
      return(false);
     }

   if(!OW_WriteCsv(hdr, InpBookLabel, buckets))
     {
      Publish(instrument, OW_ST_PARSE, res);
      return(false);
     }

   GlobalVariableSet(OW_VarName(instrument, InpBookLabel, "Long"),  hdr.totalLongPct);
   GlobalVariableSet(OW_VarName(instrument, InpBookLabel, "Short"), hdr.totalShortPct);
   GlobalVariableSet(OW_VarName(instrument, InpBookLabel, "Time"),  (double)hdr.fetchTime);
   Publish(instrument, OW_ST_OK, res);
   return(true);
}

//+------------------------------------------------------------------+
//| JSON解析                                                           |
//| 応答例:                                                            |
//| {"orderBook":{"bucketWidth":"0.0500","buckets":[                  |
//|   {"price":0,"longCountPercent":1.89,"shortCountPercent":3.79}, ..|
//| ]}}                                                                |
//| "price"は絶対価格ではなく、現在レートからの相対オフセットとみなす。     |
//| (レスポンスに現在レートやスナップショット時刻は含まれていない)          |
//+------------------------------------------------------------------+
bool ParseBook(const string body, const string instrument, OWHeader &hdr, OWBucket &buckets[])
{
   int posRoot = StringFind(body, "\"orderBook\"");
   if(posRoot < 0)
     {
      Print("OANDAウィジェットフィーダー: 応答にorderBookがありません body=", body);
      return(false);
     }

   int posBuckets = StringFind(body, "\"buckets\"", posRoot);
   if(posBuckets < 0)
     {
      Print("OANDAウィジェットフィーダー: 応答にbucketsがありません");
      return(false);
     }

   hdr.instrument    = instrument;
   hdr.fetchTime     = TimeCurrent();
   hdr.bucketWidth   = StringToDouble(JsonValue(body, "bucketWidth"));
   hdr.count         = 0;
   hdr.totalLongPct  = 0;
   hdr.totalShortPct = 0;

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

      // 全体比率はゼロのバケツも含めて集計する
      hdr.totalLongPct  += lp;
      hdr.totalShortPct += sp;

      if(lp <= 0 && sp <= 0)
         continue;   // 表示価値の無いバケツは保存しない(price==0は正当な値なので除外条件にしない)

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
//| ヘルパー: JSONから値を取り出す(数値・文字列どちらも対応)               |
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
//| 状態の公開                                                          |
//+------------------------------------------------------------------+
void Publish(const string instrument, const int status, const int http)
{
   GlobalVariableSet(OW_VarName(instrument, InpBookLabel, "Status"), (double)status);
   GlobalVariableSet(OW_VarName(instrument, InpBookLabel, "Http"),   (double)http);
}

void PublishAllStatus(const int status, const int http)
{
   int n = ArraySize(g_instruments);
   for(int i = 0; i < n; i++)
      Publish(g_instruments[i], status, http);
}

void PublishHeartbeat()
{
   int n = ArraySize(g_instruments);
   for(int i = 0; i < n; i++)
      GlobalVariableSet(OW_VarName(g_instruments[i], InpBookLabel, "Beat"), (double)TimeCurrent());
}
//+------------------------------------------------------------------+
