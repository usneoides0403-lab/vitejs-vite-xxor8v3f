//+------------------------------------------------------------------+
//|                                                 OandaBook.mqh     |
//|  OANDA Order Book / Position Book:                                |
//|  フィーダーEAと表示インジケーターの共有定義                            |
//|                                                                   |
//|  価格帯別の分布は件数が多くグローバル変数では渡せないため、             |
//|  MQL4\Files 配下のCSVを介して受け渡す。                              |
//|  集計値(全体のロング/ショート比率)と状態はグローバル変数で渡す。         |
//+------------------------------------------------------------------+
#property strict

//--- ブック種別
#define OB_TYPE_ORDER    "ORDER"      // 未約定注文の分布 (指値/逆指値がどこに置かれているか)
#define OB_TYPE_POSITION "POSITION"   // 保有ポジションの分布 (どの価格で持たれているか)

//--- ステータスコード
#define OB_ST_PENDING   0   // 未取得 / フィーダー未起動
#define OB_ST_OK        1   // 正常
#define OB_ST_WEBREQ    2   // WebRequest自体が失敗 (URL未許可など)
#define OB_ST_AUTH      3   // 認証エラー (APIトークン)
#define OB_ST_HTTP      4   // HTTPエラー
#define OB_ST_PARSE     5   // JSON解析失敗
#define OB_ST_CONFIG    6   // 設定不備
#define OB_ST_NODATA    7   // ブック非対応の銘柄 / データ空

//--- フィーダーが生きているとみなす猶予(秒)
#define OB_HEARTBEAT_GRACE_SEC 300

//--- CSVフォーマットのバージョン
#define OB_CSV_VERSION "V1"

//+------------------------------------------------------------------+
//| 価格帯1本分                                                        |
//+------------------------------------------------------------------+
struct OBBucket
  {
   double            price;      // 価格帯の下端
   double            longPct;    // その価格帯のロング割合(%)
   double            shortPct;   // その価格帯のショート割合(%)
  };

//+------------------------------------------------------------------+
//| ブックのヘッダー情報                                                 |
//+------------------------------------------------------------------+
struct OBHeader
  {
   string            instrument;     // EUR_USD 等
   string            bookType;       // ORDER / POSITION
   datetime          time;           // OANDA側のスナップショット時刻
   double            price;          // スナップショット時点の価格
   double            bucketWidth;    // 価格帯の幅
   int               count;          // 価格帯の本数
   double            totalLongPct;   // ブック全体のロング割合(%)
   double            totalShortPct;  // ブック全体のショート割合(%)
  };

//+------------------------------------------------------------------+
//| MT4のシンボル → OANDAのinstrument (EURUSD → EUR_USD)              |
//+------------------------------------------------------------------+
string OB_Instrument(const string symbol)
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
string OB_FileName(const string instrument, const string bookType)
{
   return("OandaBook_" + instrument + "_" + bookType + ".csv");
}

string OB_VarName(const string instrument, const string bookType, const string field)
{
   return("OB." + instrument + "." + bookType + "." + field);
}

//+------------------------------------------------------------------+
//| ステータスコード → 表示用メッセージ                                  |
//+------------------------------------------------------------------+
string OB_StatusText(const int status, const int http)
{
   switch(status)
     {
      case OB_ST_OK:      return("");
      case OB_ST_PENDING: return("取得待ち...");
      case OB_ST_WEBREQ:  return("通信失敗: MT4のURL許可リストを確認してください");
      case OB_ST_AUTH:    return("認証エラー: APIトークンとデモ/本番の別を確認してください");
      case OB_ST_HTTP:    return("取得失敗 HTTP=" + IntegerToString(http));
      case OB_ST_PARSE:   return("応答の解析に失敗しました");
      case OB_ST_CONFIG:  return("設定不備: フィーダーEAの入力を確認してください");
      case OB_ST_NODATA:  return("この銘柄のブックは提供されていません");
     }
   return("不明なステータス(" + IntegerToString(status) + ")");
}

//+------------------------------------------------------------------+
//| CSV書き出し (一時ファイルに書いてからリネームし、読み手が             |
//| 書きかけを掴まないようにする)                                        |
//+------------------------------------------------------------------+
bool OB_WriteCsv(const OBHeader &hdr, const OBBucket &buckets[])
{
   string finalName = OB_FileName(hdr.instrument, hdr.bookType);
   string tmpName   = finalName + ".tmp";

   int h = FileOpen(tmpName, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      Print("OandaBook: ファイルを開けません ", tmpName, " code=", GetLastError());
      return(false);
     }

   FileWriteString(h, OB_CSV_VERSION + ";" + hdr.instrument + ";" + hdr.bookType + ";" +
                      IntegerToString((int)hdr.time) + ";" +
                      DoubleToString(hdr.price, 6) + ";" +
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
      Print("OandaBook: ファイルの差し替えに失敗 ", finalName, " code=", GetLastError());
      return(false);
     }
   return(true);
}

//+------------------------------------------------------------------+
//| CSV読み込み。価格帯の本数を返す。失敗時は-1                           |
//+------------------------------------------------------------------+
int OB_ReadCsv(const string instrument, const string bookType,
               OBHeader &hdr, OBBucket &buckets[])
{
   string name = OB_FileName(instrument, bookType);
   int h = FileOpen(name, FILE_READ | FILE_TXT | FILE_ANSI | FILE_SHARE_READ | FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE)
      return(-1);

   string fields[];
   string line = FileReadString(h);
   StringTrimLeft(line);
   StringTrimRight(line);

   if(StringSplit(line, ';', fields) < 9 || fields[0] != OB_CSV_VERSION)
     {
      FileClose(h);
      return(-1);
     }

   hdr.instrument     = fields[1];
   hdr.bookType       = fields[2];
   hdr.time           = (datetime)StringToInteger(fields[3]);
   hdr.price          = StringToDouble(fields[4]);
   hdr.bucketWidth    = StringToDouble(fields[5]);
   hdr.count          = (int)StringToInteger(fields[6]);
   hdr.totalLongPct   = StringToDouble(fields[7]);
   hdr.totalShortPct  = StringToDouble(fields[8]);

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
