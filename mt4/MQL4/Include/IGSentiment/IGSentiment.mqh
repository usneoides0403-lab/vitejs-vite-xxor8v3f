//+------------------------------------------------------------------+
//|                                              IGSentiment.mqh      |
//|  IG Client Sentiment: フィーダーEAと表示インジケーターの共有定義       |
//|                                                                   |
//|  MT4のインジケーターからは WebRequest() を呼べない(インターフェース    |
//|  スレッドで実行されるため)ので、通信はEA側で行い、結果を端末の         |
//|  グローバル変数に載せてインジケーターへ渡す。                          |
//+------------------------------------------------------------------+
#property strict

//--- ステータスコード (グローバル変数に数値で載せる)
#define IGS_ST_PENDING   0   // 未取得 / フィーダー未起動
#define IGS_ST_OK        1   // 正常
#define IGS_ST_WEBREQ    2   // WebRequest自体が失敗 (URL未許可など)
#define IGS_ST_AUTH      3   // ログイン失敗 (ID/PW/APIキー)
#define IGS_ST_HTTP      4   // HTTPエラー
#define IGS_ST_PARSE     5   // JSON解析失敗 (marketIdが不正など)
#define IGS_ST_CONFIG    6   // 設定不備

//--- フィーダーが生きているとみなす猶予(秒)。心拍がこれより古ければ停止扱い
#define IGS_HEARTBEAT_GRACE_SEC 180

//+------------------------------------------------------------------+
//| グローバル変数名                                                    |
//| フィールド: Long / Short / Time / Status / Http / Beat            |
//+------------------------------------------------------------------+
string IGS_VarName(const string marketId, const string field)
{
   return("IGSent." + marketId + "." + field);
}

//+------------------------------------------------------------------+
//| 通貨ペアシンボルからmarketIdを推定                                   |
//| ブローカー固有のサフィックス(EURUSD.a 等)を落として先頭6文字を使う      |
//+------------------------------------------------------------------+
string IGS_DeriveMarketId(const string symbol)
{
   string s = symbol;
   StringToUpper(s);
   if(StringLen(s) >= 6)
      return(StringSubstr(s, 0, 6));
   return(s);
}

//+------------------------------------------------------------------+
//| ステータスコード → 表示用メッセージ                                  |
//+------------------------------------------------------------------+
string IGS_StatusText(const int status, const int http)
{
   switch(status)
     {
      case IGS_ST_OK:      return("");
      case IGS_ST_PENDING: return("取得待ち...");
      case IGS_ST_WEBREQ:  return("通信失敗: MT4のURL許可リストを確認してください");
      case IGS_ST_AUTH:    return("ログイン失敗: ID/パスワード/APIキーを確認してください");
      case IGS_ST_HTTP:    return("取得失敗 HTTP=" + IntegerToString(http));
      case IGS_ST_PARSE:   return("応答の解析に失敗: marketIdを確認してください");
      case IGS_ST_CONFIG:  return("設定不備: フィーダーEAの入力を確認してください");
     }
   return("不明なステータス(" + IntegerToString(status) + ")");
}
