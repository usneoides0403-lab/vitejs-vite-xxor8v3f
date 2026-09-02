//+------------------------------------------------------------------+
//|                                 IG_ClientSentiment_Feeder.mq4     |
//|  IGのClient Sentiment API (ロング/ショート%) を取得し、             |
//|  端末のグローバル変数に公開するフィーダーEA                          |
//|                                                                   |
//|  表示は IG_ClientSentiment_Gauge.mq4 (インジケーター) が担当する。   |
//|  MT4のインジケーターからは WebRequest() を呼べないため、通信は        |
//|  必ずEA側で行う必要がある。                                          |
//+------------------------------------------------------------------+
#property copyright "Takanori"
#property strict

#include <IGSentiment/IGSentiment.mqh>

//--- 入力パラメータ
input string InpIGUsername       = "";        // IGログインID (identifier)
input string InpIGPassword       = "";        // IGパスワード
input string InpIGApiKey         = "";        // IG APIキー (My IG > 設定 > API keys)
input string InpCredentialsFile  = "";        // MQL4\Files内の認証情報ファイル(指定時は上の3項目より優先)
input bool   InpUseDemo          = true;      // デモ口座を使用 (false=本番)
input string InpMarketIdOverride = "";        // marketId手動指定 (空欄なら通貨ペアから自動判定)
input int    InpRefreshMinutes   = 15;        // 更新間隔(分)。IG側の更新頻度的にこれ以上細かくしても意味は薄い
input bool   InpVerboseLog       = false;     // 応答本文などをログに出す

//--- グローバル変数
string   g_user = "";
string   g_pass = "";
string   g_key  = "";
string   g_cst  = "";
string   g_xst  = "";
datetime g_lastLogin = 0;
string   g_marketId  = "";
bool     g_configOk   = false;
datetime g_nextFetch  = 0;

#define LOGIN_MAX_AGE_SEC 21600   // 6時間ごとに念のため再ログイン
#define HTTP_TIMEOUT_MS   10000
#define TICK_SEC          15      // タイマー周期。心拍の更新間隔でもある
#define RETRY_SEC         60      // 取得失敗時の再試行間隔

//+------------------------------------------------------------------+
string BaseUrl()
{
   return(InpUseDemo ? "https://demo-api.ig.com/gateway/deal" : "https://api.ig.com/gateway/deal");
}

//+------------------------------------------------------------------+
int OnInit()
{
   g_marketId = StringLen(InpMarketIdOverride) > 0 ? InpMarketIdOverride : IGS_DeriveMarketId(Symbol());

   g_configOk = LoadCredentials();
   if(!g_configOk)
      Print("IGフィーダー: 認証情報が設定されていません。ID/パスワード/APIキーを確認してください");

   PublishStatus(g_configOk ? IGS_ST_PENDING : IGS_ST_CONFIG, 0);
   PublishHeartbeat();

   // 端末起動直後のWebRequestは失敗しやすいので、初回は最初のタイマーまで待つ。
   // 取得間隔とは別に短周期でタイマーを回し、心拍を更新し続ける
   // (取得間隔をそのままタイマーにすると、表示側からフィーダーが停止したように見える)
   g_nextFetch = TimeCurrent();
   EventSetTimer(TICK_SEC);
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

   bool ok = FetchSentiment();
   int  wait = ok ? (int)MathMax(60, InpRefreshMinutes * 60) : RETRY_SEC;
   g_nextFetch = TimeCurrent() + wait;
}

//+------------------------------------------------------------------+
//| 認証情報の読み込み                                                   |
//| InpCredentialsFileが指定されていればMQL4\Files配下のファイルから読む   |
//| 形式: identifier=..., password=..., apikey=... (1行1項目、#はコメント)|
//+------------------------------------------------------------------+
bool LoadCredentials()
{
   g_user = InpIGUsername;
   g_pass = InpIGPassword;
   g_key  = InpIGApiKey;

   if(StringLen(InpCredentialsFile) > 0)
     {
      int h = FileOpen(InpCredentialsFile, FILE_READ | FILE_TXT | FILE_ANSI | FILE_SHARE_READ);
      if(h == INVALID_HANDLE)
        {
         Print("IGフィーダー: 認証情報ファイルを開けません: ", InpCredentialsFile,
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
         if(k == "identifier" || k == "username")   g_user = v;
         else if(k == "password")                   g_pass = v;
         else if(k == "apikey" || k == "api_key")   g_key  = v;
        }
      FileClose(h);
     }

   return(StringLen(g_user) > 0 && StringLen(g_pass) > 0 && StringLen(g_key) > 0);
}

//+------------------------------------------------------------------+
//| ログイン (POST /session, VERSION 2 → CST / X-SECURITY-TOKEN取得)   |
//+------------------------------------------------------------------+
bool IGLogin()
{
   string url = BaseUrl() + "/session";
   string json = "{\"identifier\":\"" + JsonEscape(g_user) + "\","
                 "\"password\":\"" + JsonEscape(g_pass) + "\","
                 "\"encryptedPassword\":false}";
   string headers = "Content-Type: application/json; charset=UTF-8\r\n"
                    "Accept: application/json; charset=UTF-8\r\n"
                    "X-IG-API-KEY: " + g_key + "\r\n"
                    "Version: 2\r\n";

   char data[];
   char result[];
   string result_headers;
   StringToCharArray(json, data, 0, StringLen(json));

   ResetLastError();
   int res = WebRequest("POST", url, headers, HTTP_TIMEOUT_MS, data, result, result_headers);

   if(res == -1)
     {
      Print("IGフィーダー: WebRequest失敗(ログイン) code=", GetLastError(),
            " ※ツール→オプション→エキスパートアドバイザーの許可URLに ",
            InpUseDemo ? "https://demo-api.ig.com" : "https://api.ig.com", " を追加してください");
      PublishStatus(IGS_ST_WEBREQ, 0);
      return(false);
     }

   if(res != 200)
     {
      Print("IGフィーダー: ログイン失敗 HTTP=", res, " ", CharArrayToString(result));
      PublishStatus(res == 401 || res == 403 ? IGS_ST_AUTH : IGS_ST_HTTP, res);
      return(false);
     }

   string cst = ExtractHeaderValue(result_headers, "CST");
   string xst = ExtractHeaderValue(result_headers, "X-SECURITY-TOKEN");

   if(StringLen(cst) == 0 || StringLen(xst) == 0)
     {
      Print("IGフィーダー: ログイン応答からトークンを取得できませんでした headers=", result_headers);
      PublishStatus(IGS_ST_AUTH, res);
      return(false);
     }

   g_cst = cst;
   g_xst = xst;
   g_lastLogin = TimeCurrent();
   return(true);
}

//+------------------------------------------------------------------+
//| センチメント取得 (GET /clientsentiment/{marketId})                  |
//+------------------------------------------------------------------+
bool FetchSentiment()
{
   if(!g_configOk)
     {
      PublishStatus(IGS_ST_CONFIG, 0);
      return(false);
     }

   if(StringLen(g_cst) == 0 || StringLen(g_xst) == 0 ||
      (TimeCurrent() - g_lastLogin) > LOGIN_MAX_AGE_SEC)
     {
      if(!IGLogin())
         return(false);
     }

   char result[];
   string result_headers;
   int res = RequestSentiment(result, result_headers);

   if(res == -1)
     {
      Print("IGフィーダー: WebRequest失敗(取得) code=", GetLastError());
      PublishStatus(IGS_ST_WEBREQ, 0);
      return(false);
     }

   if(res == 401 || res == 403)
     {
      // セッション切れとみなして再ログイン後、1回だけ再試行
      g_cst = "";
      g_xst = "";
      if(!IGLogin())
         return(false);
      res = RequestSentiment(result, result_headers);
      if(res == -1)
        {
         Print("IGフィーダー: WebRequest失敗(再試行) code=", GetLastError());
         PublishStatus(IGS_ST_WEBREQ, 0);
         return(false);
        }
     }

   if(res != 200)
     {
      Print("IGフィーダー: センチメント取得失敗 HTTP=", res, " marketId=", g_marketId,
            " body=", CharArrayToString(result));
      PublishStatus(IGS_ST_HTTP, res);
      return(false);
     }

   string body = CharArrayToString(result);
   if(InpVerboseLog)
      Print("IGフィーダー: body=", body);

   double lp = ExtractJsonNumber(body, "longPositionPercentage");
   double sp = ExtractJsonNumber(body, "shortPositionPercentage");

   if(lp < 0 || sp < 0)
     {
      Print("IGフィーダー: JSON解析失敗(marketIdが正しいか確認してください): ", body);
      PublishStatus(IGS_ST_PARSE, res);
      return(false);
     }

   PublishData(lp, sp);
   PublishStatus(IGS_ST_OK, res);
   return(true);
}

//+------------------------------------------------------------------+
int RequestSentiment(char &result[], string &result_headers)
{
   string url = BaseUrl() + "/clientsentiment/" + g_marketId;
   string headers = "Accept: application/json; charset=UTF-8\r\n"
                    "X-IG-API-KEY: " + g_key + "\r\n"
                    "CST: " + g_cst + "\r\n"
                    "X-SECURITY-TOKEN: " + g_xst + "\r\n"
                    "Version: 1\r\n";

   char data[];
   ArrayResize(result, 0);
   result_headers = "";

   ResetLastError();
   return(WebRequest("GET", url, headers, HTTP_TIMEOUT_MS, data, result, result_headers));
}

//+------------------------------------------------------------------+
//| 結果の公開                                                          |
//+------------------------------------------------------------------+
void PublishData(const double longPct, const double shortPct)
{
   GlobalVariableSet(IGS_VarName(g_marketId, "Long"),  longPct);
   GlobalVariableSet(IGS_VarName(g_marketId, "Short"), shortPct);
   GlobalVariableSet(IGS_VarName(g_marketId, "Time"),  (double)TimeCurrent());
}

void PublishStatus(const int status, const int http)
{
   GlobalVariableSet(IGS_VarName(g_marketId, "Status"), (double)status);
   GlobalVariableSet(IGS_VarName(g_marketId, "Http"),   (double)http);
}

void PublishHeartbeat()
{
   GlobalVariableSet(IGS_VarName(g_marketId, "Beat"), (double)TimeCurrent());
}

//+------------------------------------------------------------------+
//| ヘルパー: JSON文字列リテラル用のエスケープ                            |
//+------------------------------------------------------------------+
string JsonEscape(const string s)
{
   string out = "";
   int n = StringLen(s);
   for(int i = 0; i < n; i++)
     {
      ushort ch = StringGetCharacter(s, i);
      if(ch == '"' || ch == '\\')
        {
         out += "\\";
         out += ShortToString(ch);
        }
      else
         out += ShortToString(ch);
     }
   return(out);
}

//+------------------------------------------------------------------+
//| ヘルパー: HTTPレスポンスヘッダーから値を抽出 (行単位・大小文字無視)     |
//+------------------------------------------------------------------+
string ExtractHeaderValue(const string headers, const string key)
{
   string lines[];
   int n = StringSplit(headers, StringGetCharacter("\n", 0), lines);
   string wanted = key;
   StringToLower(wanted);

   for(int i = 0; i < n; i++)
     {
      string line = lines[i];
      StringTrimLeft(line);
      StringTrimRight(line);
      int colon = StringFind(line, ":");
      if(colon <= 0)
         continue;
      string name = StringSubstr(line, 0, colon);
      StringTrimRight(name);
      StringToLower(name);
      if(name != wanted)
         continue;
      string value = StringSubstr(line, colon + 1);
      StringTrimLeft(value);
      StringTrimRight(value);
      return(value);
     }
   return("");
}

//+------------------------------------------------------------------+
//| ヘルパー: JSON文字列から数値フィールドを抽出                          |
//+------------------------------------------------------------------+
double ExtractJsonNumber(const string json, const string key)
{
   string search = "\"" + key + "\"";
   int pos = StringFind(json, search);
   if(pos < 0)
      return(-1);
   pos = StringFind(json, ":", pos + StringLen(search));
   if(pos < 0)
      return(-1);
   pos++;
   while(pos < StringLen(json) && StringGetCharacter(json, pos) == ' ')
      pos++;
   int start = pos;
   while(pos < StringLen(json))
     {
      ushort ch = StringGetCharacter(json, pos);
      if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-' || ch == '+' || ch == 'e' || ch == 'E')
         pos++;
      else
         break;
     }
   if(pos == start)
      return(-1);
   return(StringToDouble(StringSubstr(json, start, pos - start)));
}
//+------------------------------------------------------------------+
