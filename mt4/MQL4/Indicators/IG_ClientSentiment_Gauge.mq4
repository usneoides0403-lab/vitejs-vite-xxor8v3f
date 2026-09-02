//+------------------------------------------------------------------+
//|                                    IG_ClientSentiment_Gauge.mq4   |
//|  IGのClient Sentiment (ロング/ショート%) をオンチャート表示           |
//|  コントラリアン指標として利用することを想定                            |
//|                                                                   |
//|  数値の取得は IG_ClientSentiment_Feeder.mq4 (EA) が行う。           |
//|  MT4のインジケーターからは WebRequest() を呼べないため、本ファイルは    |
//|  フィーダーが公開したグローバル変数を読んで描画するだけ。               |
//+------------------------------------------------------------------+
#property copyright "Takanori"
#property strict
#property indicator_chart_window
#property indicator_buffers 0

#include <IGSentiment/IGSentiment.mqh>

//--- 入力パラメータ
input string InpMarketIdOverride = "";        // marketId手動指定 (空欄なら通貨ペアから自動判定。フィーダーEAと必ず揃える)
input double InpWarnThreshold    = 65.0;      // この%を超えたら逆張り警戒色で表示
input int    InpStaleMinutes     = 45;        // 最終更新がこれより古ければ古データとして薄く表示
input color  InpLongColor        = clrDodgerBlue;
input color  InpShortColor       = clrOrangeRed;
input color  InpBgColor          = C'20,20,20';
input int    InpPanelX           = 10;
input int    InpPanelY           = 20;
input ENUM_BASE_CORNER InpCorner = CORNER_LEFT_UPPER;

//--- パネルのレイアウト (パネル左上を原点としたオフセット)
#define PANEL_W    240
#define PANEL_H    104
#define PAD          10
#define BAR_Y        32
#define BAR_H        18
#define BAR_W       220
#define TITLE_Y       6
#define TITLE_LH     16
#define PCT_Y        54
#define PCT_LH       16
#define STATUS_Y     78
#define STATUS_LH    13

//--- グローバル変数
string g_marketId = "";
string g_prefix   = "IGSent_";

//+------------------------------------------------------------------+
int OnInit()
{
   g_marketId = StringLen(InpMarketIdOverride) > 0 ? InpMarketIdOverride : IGS_DeriveMarketId(Symbol());
   g_prefix   = "IGSent_" + g_marketId + "_";

   CreatePanel();
   DrawPanel();

   EventSetTimer(2);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectsDeleteAll(0, g_prefix);
   ChartRedraw();
}

//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   return(rates_total);
}

//+------------------------------------------------------------------+
void OnTimer()
{
   DrawPanel();
}

//+------------------------------------------------------------------+
//| 座標変換: 右寄せ/下寄せコーナーでもレイアウトが崩れないようにする       |
//+------------------------------------------------------------------+
bool IsRightCorner()
{
   return(InpCorner == CORNER_RIGHT_UPPER || InpCorner == CORNER_RIGHT_LOWER);
}

bool IsLowerCorner()
{
   return(InpCorner == CORNER_LEFT_LOWER || InpCorner == CORNER_RIGHT_LOWER);
}

int MapX(const int offsetX, const int width)
{
   return(InpPanelX + (IsRightCorner() ? PANEL_W - offsetX - width : offsetX));
}

int MapY(const int offsetY, const int height)
{
   return(InpPanelY + (IsLowerCorner() ? PANEL_H - offsetY - height : offsetY));
}

ENUM_ANCHOR_POINT LabelAnchor()
{
   if(IsRightCorner())
      return(IsLowerCorner() ? ANCHOR_RIGHT_LOWER : ANCHOR_RIGHT_UPPER);
   return(IsLowerCorner() ? ANCHOR_LEFT_LOWER : ANCHOR_LEFT_UPPER);
}

//+------------------------------------------------------------------+
//| オブジェクト生成                                                    |
//+------------------------------------------------------------------+
void CreateLabelObj(const string name, const int offsetX, const int offsetY,
                    const int lineHeight, const int fontSize, const color clr)
{
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, name, OBJPROP_BACK, false);
     }
   ObjectSetInteger(0, name, OBJPROP_CORNER, InpCorner);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, LabelAnchor());
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, InpPanelX + offsetX);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, MapY(offsetY, lineHeight));
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
}

void CreateRectObj(const string name, const int offsetX, const int offsetY,
                   const int w, const int h, const color clr)
{
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, name, OBJPROP_BACK, false);
      ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
     }
   int width = (int)MathMax(w, 1);
   ObjectSetInteger(0, name, OBJPROP_CORNER, InpCorner);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, MapX(offsetX, width));
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, MapY(offsetY, h));
   ObjectSetInteger(0, name, OBJPROP_XSIZE, width);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
}

void CreatePanel()
{
   CreateRectObj(g_prefix + "BG", 0, 0, PANEL_W, PANEL_H, InpBgColor);
   CreateLabelObj(g_prefix + "Title", PAD, TITLE_Y, TITLE_LH, 10, clrWhite);
   CreateRectObj(g_prefix + "BarLong",  PAD, BAR_Y, 1, BAR_H, InpLongColor);
   CreateRectObj(g_prefix + "BarShort", PAD, BAR_Y, 1, BAR_H, InpShortColor);
   CreateLabelObj(g_prefix + "Pct", PAD, PCT_Y, PCT_LH, 10, clrWhite);
   CreateLabelObj(g_prefix + "Status", PAD, STATUS_Y, STATUS_LH, 8, clrSilver);
}

//+------------------------------------------------------------------+
//| 描画                                                               |
//+------------------------------------------------------------------+
void DrawPanel()
{
   double   longPct  = -1;
   double   shortPct = -1;
   datetime updated  = 0;
   int      status   = IGS_ST_PENDING;
   int      http     = 0;
   datetime beat     = 0;

   ReadFeed(longPct, shortPct, updated, status, http, beat);

   bool hasData    = (longPct >= 0 && shortPct >= 0);
   bool stale      = hasData && InpStaleMinutes > 0 &&
                     (TimeCurrent() - updated) > (InpStaleMinutes * 60);
   bool feederDown = (TimeCurrent() - beat) > IGS_HEARTBEAT_GRACE_SEC;

   ObjectSetString(0, g_prefix + "Title", OBJPROP_TEXT, "IGセンチメント: " + g_marketId);

   if(hasData)
     {
      int longW  = (int)MathRound(BAR_W * longPct / 100.0);
      longW      = (int)MathMax(0, MathMin(BAR_W, longW));
      int shortW = BAR_W - longW;

      // 0%側はバーを消す(1px残すと比率が嘘になるため)
      ObjectSetInteger(0, g_prefix + "BarLong",  OBJPROP_TIMEFRAMES, longW  > 0 ? OBJ_ALL_PERIODS : OBJ_NO_PERIODS);
      ObjectSetInteger(0, g_prefix + "BarShort", OBJPROP_TIMEFRAMES, shortW > 0 ? OBJ_ALL_PERIODS : OBJ_NO_PERIODS);

      if(longW > 0)
        {
         ObjectSetInteger(0, g_prefix + "BarLong", OBJPROP_XDISTANCE, MapX(PAD, longW));
         ObjectSetInteger(0, g_prefix + "BarLong", OBJPROP_XSIZE, longW);
        }
      if(shortW > 0)
        {
         ObjectSetInteger(0, g_prefix + "BarShort", OBJPROP_XDISTANCE, MapX(PAD + longW, shortW));
         ObjectSetInteger(0, g_prefix + "BarShort", OBJPROP_XSIZE, shortW);
        }

      ObjectSetString(0, g_prefix + "Pct", OBJPROP_TEXT,
                      StringFormat("Long %.1f%%  |  Short %.1f%%", longPct, shortPct));

      color pctColor = clrWhite;
      if(longPct >= InpWarnThreshold)
         pctColor = InpShortColor;   // ロング過多 → 下落警戒(逆張りショート視点)
      else if(shortPct >= InpWarnThreshold)
         pctColor = InpLongColor;    // ショート過多 → 上昇警戒(逆張りロング視点)
      if(stale)
         pctColor = clrGray;
      ObjectSetInteger(0, g_prefix + "Pct", OBJPROP_COLOR, pctColor);
     }
   else
     {
      ObjectSetInteger(0, g_prefix + "BarLong",  OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(0, g_prefix + "BarShort", OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetString(0, g_prefix + "Pct", OBJPROP_TEXT, "データ取得待ち...");
      ObjectSetInteger(0, g_prefix + "Pct", OBJPROP_COLOR, clrGray);
     }

   string statusText  = "";
   color  statusColor = clrSilver;

   if(feederDown)
     {
      statusText  = "フィーダーEAが動作していません (" + g_marketId + ")";
      statusColor = clrRed;
     }
   else if(status != IGS_ST_OK && status != IGS_ST_PENDING)
     {
      statusText  = IGS_StatusText(status, http);
      statusColor = clrRed;
     }
   else if(updated > 0)
     {
      statusText = "更新: " + TimeToString(updated, TIME_DATE | TIME_MINUTES);
      if(stale)
        {
         statusText += " (古いデータ)";
         statusColor = clrOrange;
        }
     }
   else
      statusText = IGS_StatusText(status, http);

   ObjectSetString(0, g_prefix + "Status", OBJPROP_TEXT, statusText);
   ObjectSetInteger(0, g_prefix + "Status", OBJPROP_COLOR, statusColor);

   ChartRedraw();
}

//+------------------------------------------------------------------+
//| フィーダーEAが公開したグローバル変数を読む                            |
//+------------------------------------------------------------------+
void ReadFeed(double &longPct, double &shortPct, datetime &updated,
              int &status, int &http, datetime &beat)
{
   string nLong   = IGS_VarName(g_marketId, "Long");
   string nShort  = IGS_VarName(g_marketId, "Short");
   string nTime   = IGS_VarName(g_marketId, "Time");
   string nStatus = IGS_VarName(g_marketId, "Status");
   string nHttp   = IGS_VarName(g_marketId, "Http");
   string nBeat   = IGS_VarName(g_marketId, "Beat");

   if(GlobalVariableCheck(nLong) && GlobalVariableCheck(nShort))
     {
      longPct  = GlobalVariableGet(nLong);
      shortPct = GlobalVariableGet(nShort);
     }
   if(GlobalVariableCheck(nTime))
      updated = (datetime)GlobalVariableGet(nTime);
   if(GlobalVariableCheck(nStatus))
      status = (int)GlobalVariableGet(nStatus);
   if(GlobalVariableCheck(nHttp))
      http = (int)GlobalVariableGet(nHttp);
   if(GlobalVariableCheck(nBeat))
      beat = (datetime)GlobalVariableGet(nBeat);
}
//+------------------------------------------------------------------+
