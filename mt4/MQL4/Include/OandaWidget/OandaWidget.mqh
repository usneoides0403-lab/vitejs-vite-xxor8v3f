//+------------------------------------------------------------------+
//|                                                OandaWidget.mqh    |
//|  widget.oanda.jp の非公式(ドキュメント外)オーダーブックAPI:          |
//|  フィーダーEAと表示インジケーターの共有定義                            |
//|                                                                   |
//|  https://widget.oanda.jp/api/{path}?instrument=USD_JPY&ago=0      |
//|  認証不要・口座不要。OANDA証券のラボページ自体が使っている内部APIで、   |
//|  非公開でありいつ変更/停止されてもおかしくない点に留意すること。        |
//|                                                                   |
//|  レスポンスに絶対価格は含まれず、bucketのpriceは現在レートからの       |
//|  相対オフセット(建値通貨単位)とみなす。絶対価格への変換は              |
//|  表示側(インジケーター)でMT4の現在値(Bid)を使って行う。                |
//+------------------------------------------------------------------+
#property strict

//--- ステータスコード
#define OW_ST_PENDING   0   // 未取得 / フィーダー未起動
#define OW_ST_OK        1   // 正常
#define OW_ST_WEBREQ    2   // WebRequest自体が失敗 (URL未許可など)
#define OW_ST_HTTP      3   // HTTPエラー
#define OW_ST_PARSE     4   // JSON解析失敗
#define OW_ST_CONFIG    5   // 設定不備
#define OW_ST_NODATA    6   // データが空 (銘柄非対応など)

//--- フィーダーが生きているとみなす猶予(秒)
#define OW_HEARTBEAT_GRACE_SEC 300

//--- CSVフォーマットのバージョン
#define OW_CSV_VERSION "W1"

//+------------------------------------------------------------------+
//| 価格帯1本分。priceは現在レートからの相対オフセット                     |
//+------------------------------------------------------------------+
struct OWBucket
  {
   double            price;      // 現在レートからのオフセット(建値通貨単位。符号は要検証)
   double            longPct;    // その価格帯のロング割合(%)
   double            shortPct;   // その価格帯のショート割合(%)
  };

//+------------------------------------------------------------------+
struct OWHeader
  {
   string            instrument;     // EUR_USD 等
   datetime          fetchTime;      // ローカルで取得した時刻(APIはスナップショット時刻を返さない)
   double            bucketWidth;    // 価格帯の幅(オフセットと同じ単位)
   int               count;          // 価格帯の本数(0件バケツを除く)
   double            totalLongPct;   // 全バケツ合計のロング割合(%)。100%になるとは限らない
   double            totalShortPct;  // 全バケツ合計のショート割合(%)
  };

//+------------------------------------------------------------------+
//| MT4のシンボル → OANDAのinstrument (EURUSD → EUR_USD)              |
//+------------------------------------------------------------------+
string OW_Instrument(const string symbol)
{
   string s = symbol;
   StringToUpper(s);
   if(StringFind(s, "_") >= 0)      // 既にOANDA形式ならそのまま
      return(s);
   if(StringLen(s) >= 6)
      return(StringSubstr(s, 0, 3) + "_" + StringSubstr(s, 3, 3));
   return(s);
}

//+------------------------------------------------------------------+
//| 受け渡し用のファイル名 / グローバル変数名                             |
//+------------------------------------------------------------------+
string OW_FileName(const string instrument, const string label)
{
   return("OandaWidget_" + instrument + "_" + label + ".csv");
}

string OW_VarName(const string instrument, const string label, const string field)
{
   return("OW." + instrument + "." + label + "." + field);
}

//+------------------------------------------------------------------+
//| ステータスコード → 表示用メッセージ                                  |
//+------------------------------------------------------------------+
string OW_StatusText(const int status, const int http)
{
   switch(status)
     {
      case OW_ST_OK:      return("");
      case OW_ST_PENDING: return("取得待ち...");
      case OW_ST_WEBREQ:  return("通信失敗: MT4のURL許可リストを確認してください");
      case OW_ST_HTTP:    return("取得失敗 HTTP=" + IntegerToString(http));
      case OW_ST_PARSE:   return("応答の解析に失敗しました(APIの仕様が変わった可能性)");
      case OW_ST_CONFIG:  return("設定不備: フィーダーEAの入力を確認してください");
      case OW_ST_NODATA:  return("データが空です(銘柄名を確認してください)");
     }
   return("不明なステータス(" + IntegerToString(status) + ")");
}

//+------------------------------------------------------------------+
//| CSV書き出し。一時ファイルに書いてからリネームし、読み手が               |
//| 書きかけを掴まないようにする                                        |
//+------------------------------------------------------------------+
bool OW_WriteCsv(const OWHeader &hdr, const string label, const OWBucket &buckets[])
{
   string finalName = OW_FileName(hdr.instrument, label);
   string tmpName   = finalName + ".tmp";

   int h = FileOpen(tmpName, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      Print("OandaWidget: ファイルを開けません ", tmpName, " code=", GetLastError());
      return(false);
     }

   FileWriteString(h, OW_CSV_VERSION + ";" + hdr.instrument + ";" +
                      IntegerToString((int)hdr.fetchTime) + ";" +
                      DoubleToString(hdr.bucketWidth, 6) + ";" +
                      IntegerToString(hdr.count) + ";" +
                      DoubleToString(hdr.totalLongPct, 4) + ";" +
                      DoubleToString(hdr.totalShortPct, 4) + "\r\n");

   int n = ArraySize(buckets);
   for(int i = 0; i < n; i++)
      FileWriteString(h, DoubleToString(buckets[i].price, 6) + ";" +
                         DoubleToString(buckets[i].longPct, 4) + ";" +
                         DoubleToString(buckets[i].shortPct, 4) + "\r\n");

   FileClose(h);

   if(!FileMove(tmpName, 0, finalName, FILE_REWRITE))
     {
      Print("OandaWidget: ファイルの差し替えに失敗 ", finalName, " code=", GetLastError());
      return(false);
     }
   return(true);
}

//+------------------------------------------------------------------+
//| CSV読み込み。価格帯の本数を返す。失敗時は-1                           |
//+------------------------------------------------------------------+
int OW_ReadCsv(const string instrument, const string label, OWHeader &hdr, OWBucket &buckets[])
{
   string name = OW_FileName(instrument, label);
   int h = FileOpen(name, FILE_READ | FILE_TXT | FILE_ANSI | FILE_SHARE_READ | FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE)
      return(-1);

   string fields[];
   string line = FileReadString(h);
   StringTrimLeft(line);
   StringTrimRight(line);

   if(StringSplit(line, ';', fields) < 7 || fields[0] != OW_CSV_VERSION)
     {
      FileClose(h);
      return(-1);
     }

   hdr.instrument    = fields[1];
   hdr.fetchTime     = (datetime)StringToInteger(fields[2]);
   hdr.bucketWidth   = StringToDouble(fields[3]);
   hdr.count         = (int)StringToInteger(fields[4]);
   hdr.totalLongPct  = StringToDouble(fields[5]);
   hdr.totalShortPct = StringToDouble(fields[6]);

   ArrayResize(buckets, 0);
   int n = 0;
   while(!FileIsEnding(h))
     {
      line = FileReadString(h);
      StringTrimLeft(line);
      StringTrimRight(line);
      if(StringLen(line) == 0)
         continue;
      if(StringSplit(line, ';', fields) < 3)
         continue;
      ArrayResize(buckets, n + 1, 256);
      buckets[n].price    = StringToDouble(fields[0]);
      buckets[n].longPct  = StringToDouble(fields[1]);
      buckets[n].shortPct = StringToDouble(fields[2]);
      n++;
     }
   FileClose(h);
   return(n);
}
