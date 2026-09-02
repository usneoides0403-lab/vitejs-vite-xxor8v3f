//+------------------------------------------------------------------+
//|                                      OANDA_Book_Profile.mq4       |
//|  OANDAのOrder Book / Position Bookを価格帯ヒストグラムとして         |
//|  チャートに重ね描きする                                              |
//|                                                                   |
//|  中央線より右=ロング(青)、左=ショート(赤)の横棒。                     |
//|  棒の長さは表示中の価格帯の中で最大のものを100%とした相対値。          |
//|                                                                   |
//|  データ取得は OANDA_Book_Feeder.mq4 (EA) が担当する。                |
//|  MT4のインジケーターからは WebRequest() を呼べないため。               |
//+------------------------------------------------------------------+
#property copyright "Takanori"
#property strict
#property indicator_chart_window
#property indicator_buffers 0

#include <OandaBook/OandaBook.mqh>

//--- ブック種別
enum ENUM_OB_BOOK
  {
   OB_BOOK_ORDER    = 0,   // 未約定注文の分布 (Order Book)
   OB_BOOK_POSITION = 1    // 保有ポジションの分布 (Position Book)
  };

//--- 入力パラメータ
input ENUM_OB_BOOK InpBookType = OB_BOOK_ORDER;   // 表示するブック
input string InpInstrumentOverride = "";      // 銘柄手動指定 (空欄ならチャートのシンボルから自動判定)
input int    InpProfileBars    = 18;          // ヒストグラムの片側の幅(バー本数)
input int    InpMaxRows        = 120;         // 描画する価格帯の最大本数(超えたら束ねる)
input int    InpTopLevels      = 3;           // 集中している価格帯を上位何本ラインで示すか
input bool   InpShowPanel      = true;        // 集計パネルを表示
input color  InpLongColor      = clrDodgerBlue;
input color  InpShortColor     = clrOrangeRed;
input color  InpTopLineColor   = clrGold;
input color  InpBgColor        = C'20,20,20';
input int    InpPanelX         = 10;
input int    InpPanelY         = 20;
input ENUM_BASE_CORNER InpCorner = CORNER_RIGHT_UPPER;

//--- パネルのレイアウト
#define PANEL_W    260
#define PANEL_H    132
#define PAD         10
#define TITLE_Y      6
#define TITLE_LH    16
#define RATIO_Y     28
#define RATIO_LH    16
#define BAR_Y       50
#define BAR_H       14
#define BAR_W      240
#define TOP_Y       70
#define TOP_LH      13
#define STATUS_Y   118
#define STATUS_LH   13

//--- 状態
string   g_instrument = "";
string   g_bookType   = OB_TYPE_ORDER;
string   g_prefix     = "OBProf_";
OBHeader g_hdr;
OBBucket g_buckets[];
int      g_bucketCount = 0;
datetime g_dataTime    = 0;
bool     g_needRedraw  = true;
int      g_rowsDrawn   = 0;
int      g_linesDrawn  = 0;
int      g_lastFirst   = -1;
double   g_lastPMin    = 0;
double   g_lastPMax    = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   g_bookType   = (InpBookType == OB_BOOK_ORDER) ? OB_TYPE_ORDER : OB_TYPE_POSITION;
   g_instrument = StringLen(InpInstrumentOverride) > 0
                  ? OB_Instrument(InpInstrumentOverride)
                  : OB_Instrument(Symbol());
   g_prefix     = "OBProf_" + g_instrument + "_" + g_bookType + "_";

   if(InpShowPanel)
      CreatePanel();

   ReloadData();
   Redraw();

   EventSetTimer(5);
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
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id != CHARTEVENT_CHART_CHANGE)
      return;

   // スクロール/ズームで表示範囲が変わったときだけ描き直す
   // (CHART_CHANGEはドラッグ中に大量に飛んでくるため)
   if(!ViewChanged())
      return;

   g_needRedraw = true;
   Redraw();
}

//+------------------------------------------------------------------+
void OnTimer()
{
   datetime published = (datetime)GlobalVariableGet(OB_VarName(g_instrument, g_bookType, "Time"));
   if(published != g_dataTime)
     {
      ReloadData();
      g_needRedraw = true;
     }

   if(g_needRedraw)
     {
      Redraw();
     }
   else
     {
      DrawPanel();   // 経過時間とステータスだけ更新
      ChartRedraw();
     }
}

//+------------------------------------------------------------------+
//| 表示範囲が前回描画時から変わったか                                   |
//+------------------------------------------------------------------+
bool ViewChanged()
{
   int    first = WindowFirstVisibleBar();
   double pmin  = WindowPriceMin(0);
   double pmax  = WindowPriceMax(0);

   if(first == g_lastFirst &&
      MathAbs(pmin - g_lastPMin) < Point / 2 &&
      MathAbs(pmax - g_lastPMax) < Point / 2)
      return(false);

   g_lastFirst = first;
   g_lastPMin  = pmin;
   g_lastPMax  = pmax;
   return(true);
}

//+------------------------------------------------------------------+
//| CSVの読み直し                                                      |
//+------------------------------------------------------------------+
void ReloadData()
{
   int n = OB_ReadCsv(g_instrument, g_bookType, g_hdr, g_buckets);
   if(n < 0)
     {
      g_bucketCount = 0;
      return;
     }
   g_bucketCount = n;
   g_dataTime    = g_hdr.time;
}

//+------------------------------------------------------------------+
//| 描画本体                                                           |
//+------------------------------------------------------------------+
void Redraw()
{
   g_needRedraw = false;
   g_lastFirst  = WindowFirstVisibleBar();
   g_lastPMin   = WindowPriceMin(0);
   g_lastPMax   = WindowPriceMax(0);
   DrawProfile();
   if(InpShowPanel)
      DrawPanel();
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| 価格帯ヒストグラム                                                  |
//+------------------------------------------------------------------+
void DrawProfile()
{
   int rows  = 0;
   int lines = 0;

   if(g_bucketCount > 0)
     {
      double pmin = WindowPriceMin(0);
      double pmax = WindowPriceMax(0);

      // 表示中の価格帯だけ抜き出す
      double prices[], longs[], shorts[];
      int    n = SelectVisible(pmin, pmax, prices, longs, shorts);

      if(n > 0)
        {
         double maxPct = 0;
         for(int i = 0; i < n; i++)
           {
            if(longs[i]  > maxPct) maxPct = longs[i];
            if(shorts[i] > maxPct) maxPct = shorts[i];
           }

         if(maxPct > 0)
           {
            int first, center, halfBars;
            if(ComputeAnchors(first, center, halfBars))
              {
               double rowHeight = RowHeight(prices, n);

               for(int i = 0; i < n; i++)
                 {
                  double p1 = prices[i];
                  double p2 = prices[i] + rowHeight;

                  int longLen  = (int)MathRound(halfBars * longs[i]  / maxPct);
                  int shortLen = (int)MathRound(halfBars * shorts[i] / maxPct);

                  DrawBar(g_prefix + "L" + IntegerToString(rows), center, -longLen, p1, p2, InpLongColor);
                  DrawBar(g_prefix + "S" + IntegerToString(rows), center,  shortLen, p1, p2, InpShortColor);
                  rows++;
                 }

               lines = DrawTopLevels(prices, longs, shorts, n);
              }
           }
        }
     }

   // 前回より本数が減った分のオブジェクトを片付ける
   for(int i = rows; i < g_rowsDrawn; i++)
     {
      ObjectDelete(0, g_prefix + "L" + IntegerToString(i));
      ObjectDelete(0, g_prefix + "S" + IntegerToString(i));
     }
   for(int j = lines; j < g_linesDrawn; j++)
      ObjectDelete(0, g_prefix + "Top" + IntegerToString(j));

   g_rowsDrawn  = rows;
   g_linesDrawn = lines;
}

//+------------------------------------------------------------------+
//| 表示中の価格帯を抽出。多すぎる場合は隣接する帯を束ねる                 |
//+------------------------------------------------------------------+
int SelectVisible(const double pmin, const double pmax,
                  double &prices[], double &longs[], double &shorts[])
{
   int idx[];
   ArrayResize(idx, 0);
   int m = 0;
   for(int i = 0; i < g_bucketCount; i++)
     {
      double lo = g_buckets[i].price;
      double hi = g_buckets[i].price + g_hdr.bucketWidth;
      if(hi < pmin || lo > pmax)
         continue;
      ArrayResize(idx, m + 1, 256);
      idx[m++] = i;
     }
   if(m == 0)
      return(0);

   int group = (InpMaxRows > 0 && m > InpMaxRows) ? (int)MathCeil((double)m / InpMaxRows) : 1;
   int out   = (int)MathCeil((double)m / group);

   ArrayResize(prices, out);
   ArrayResize(longs,  out);
   ArrayResize(shorts, out);

   int k = 0;
   for(int i = 0; i < m; i += group)
     {
      double lp = 0, sp = 0;
      double lowest = g_buckets[idx[i]].price;
      for(int j = i; j < i + group && j < m; j++)
        {
         lp += g_buckets[idx[j]].longPct;
         sp += g_buckets[idx[j]].shortPct;
         if(g_buckets[idx[j]].price < lowest)
            lowest = g_buckets[idx[j]].price;
        }
      prices[k] = lowest;
      longs[k]  = lp;
      shorts[k] = sp;
      k++;
     }
   return(k);
}

//+------------------------------------------------------------------+
//| 1行あたりの価格の高さ (束ねた場合はその分厚くする)                    |
//+------------------------------------------------------------------+
double RowHeight(const double &prices[], const int n)
{
   if(n >= 2)
     {
      double d = MathAbs(prices[1] - prices[0]);
      if(d > 0)
         return(d);
     }
   if(g_hdr.bucketWidth > 0)
      return(g_hdr.bucketWidth);
   return(Point * 10);
}

//+------------------------------------------------------------------+
//| ヒストグラムの水平方向のアンカー(バー番号)を決める                     |
//+------------------------------------------------------------------+
bool ComputeAnchors(int &first, int &center, int &halfBars)
{
   first = WindowFirstVisibleBar();
   int visible = WindowBarsPerChart();
   if(first < 4 || visible < 10 || Bars < 10)
      return(false);

   halfBars = InpProfileBars;
   if(halfBars < 2)
      halfBars = 2;
   if(halfBars * 2 > visible - 2)
      halfBars = (int)MathMax(2, (visible - 2) / 2);
   if(halfBars * 2 > first)
      halfBars = (int)MathMax(2, first / 2);

   center = first - halfBars;      // バー番号は右へ行くほど小さい
   if(center < 1)
      return(false);
   return(true);
}

//+------------------------------------------------------------------+
//| 横棒1本。lenBars>0で中央から左へ(ショート)、<0で右へ(ロング)          |
//+------------------------------------------------------------------+
void DrawBar(const string name, const int centerBar, const int lenBars,
             const double price1, const double price2, const color clr)
{
   if(lenBars == 0)
     {
      if(ObjectFind(0, name) >= 0)
         ObjectSetInteger(0, name, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      return;
     }

   int endBar = centerBar + lenBars;
   if(endBar < 0)
      endBar = 0;
   if(endBar > Bars - 1)
      endBar = Bars - 1;

   datetime t1 = Time[centerBar];
   datetime t2 = Time[endBar];

   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, 0, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);   // ローソク足の背面に塗りつぶしで描く
     }
   ObjectSetInteger(0, name, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectMove(0, name, 0, t1, price1);
   ObjectMove(0, name, 1, t2, price2);
}

//+------------------------------------------------------------------+
//| 集中している価格帯に水平線を引く。引いた本数を返す                     |
//+------------------------------------------------------------------+
int DrawTopLevels(const double &prices[], const double &longs[], const double &shorts[], const int n)
{
   if(InpTopLevels <= 0)
      return(0);

   int    topIdx[];
   double topVal[];
   int    want = (int)MathMin(InpTopLevels, n);
   ArrayResize(topIdx, want);
   ArrayResize(topVal, want);
   for(int i = 0; i < want; i++)
     {
      topIdx[i] = -1;
      topVal[i] = -1;
     }

   for(int i = 0; i < n; i++)
     {
      double v = longs[i] + shorts[i];
      for(int s = 0; s < want; s++)
        {
         if(v > topVal[s])
           {
            for(int t = want - 1; t > s; t--)
              {
               topVal[t] = topVal[t - 1];
               topIdx[t] = topIdx[t - 1];
              }
            topVal[s] = v;
            topIdx[s] = i;
            break;
           }
        }
     }

   int drawn = 0;
   for(int i = 0; i < want; i++)
     {
      if(topIdx[i] < 0 || topVal[i] <= 0)
         continue;
      string name = g_prefix + "Top" + IntegerToString(drawn);
      if(ObjectFind(0, name) < 0)
        {
         ObjectCreate(0, name, OBJ_HLINE, 0, 0, 0);
         ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
         ObjectSetInteger(0, name, OBJPROP_BACK, true);
         ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
        }
      ObjectSetInteger(0, name, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(0, name, OBJPROP_COLOR, InpTopLineColor);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      ObjectMove(0, name, 0, 0, prices[topIdx[i]]);
      drawn++;
     }
   return(drawn);
}

//+------------------------------------------------------------------+
//| パネル                                                             |
//+------------------------------------------------------------------+
bool IsRightCorner() { return(InpCorner == CORNER_RIGHT_UPPER || InpCorner == CORNER_RIGHT_LOWER); }
bool IsLowerCorner() { return(InpCorner == CORNER_LEFT_LOWER  || InpCorner == CORNER_RIGHT_LOWER); }

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
   CreateLabelObj(g_prefix + "Ratio", PAD, RATIO_Y, RATIO_LH, 10, clrWhite);
   CreateRectObj(g_prefix + "PBarL", PAD, BAR_Y, 1, BAR_H, InpLongColor);
   CreateRectObj(g_prefix + "PBarS", PAD, BAR_Y, 1, BAR_H, InpShortColor);
   for(int i = 0; i < 3; i++)
      CreateLabelObj(g_prefix + "TopTxt" + IntegerToString(i), PAD, TOP_Y + i * (TOP_LH + 2), TOP_LH, 8, clrGold);
   CreateLabelObj(g_prefix + "Status", PAD, STATUS_Y, STATUS_LH, 8, clrSilver);
}

//+------------------------------------------------------------------+
void DrawPanel()
{
   if(!InpShowPanel)
      return;

   int      status = (int)GlobalVariableGet(OB_VarName(g_instrument, g_bookType, "Status"));
   int      http   = (int)GlobalVariableGet(OB_VarName(g_instrument, g_bookType, "Http"));
   datetime beat   = (datetime)GlobalVariableGet(OB_VarName(g_instrument, g_bookType, "Beat"));
   bool feederDown = (TimeCurrent() - beat) > OB_HEARTBEAT_GRACE_SEC;

   string typeName = (g_bookType == OB_TYPE_ORDER) ? "未約定注文" : "保有ポジション";
   ObjectSetString(0, g_prefix + "Title", OBJPROP_TEXT, g_instrument + " " + typeName + "の分布");

   if(g_bucketCount > 0)
     {
      double lp = g_hdr.totalLongPct;
      double sp = g_hdr.totalShortPct;
      double total = lp + sp;
      if(total <= 0)
         total = 1;
      double lpN = lp * 100.0 / total;
      double spN = sp * 100.0 / total;

      ObjectSetString(0, g_prefix + "Ratio", OBJPROP_TEXT,
                      StringFormat("全体 Long %.1f%%  |  Short %.1f%%", lpN, spN));

      int longW  = (int)MathRound(BAR_W * lpN / 100.0);
      longW      = (int)MathMax(0, MathMin(BAR_W, longW));
      int shortW = BAR_W - longW;

      ObjectSetInteger(0, g_prefix + "PBarL", OBJPROP_TIMEFRAMES, longW  > 0 ? OBJ_ALL_PERIODS : OBJ_NO_PERIODS);
      ObjectSetInteger(0, g_prefix + "PBarS", OBJPROP_TIMEFRAMES, shortW > 0 ? OBJ_ALL_PERIODS : OBJ_NO_PERIODS);
      if(longW > 0)
        {
         ObjectSetInteger(0, g_prefix + "PBarL", OBJPROP_XDISTANCE, MapX(PAD, longW));
         ObjectSetInteger(0, g_prefix + "PBarL", OBJPROP_XSIZE, longW);
        }
      if(shortW > 0)
        {
         ObjectSetInteger(0, g_prefix + "PBarS", OBJPROP_XDISTANCE, MapX(PAD + longW, shortW));
         ObjectSetInteger(0, g_prefix + "PBarS", OBJPROP_XSIZE, shortW);
        }

      UpdateTopTexts();
     }
   else
     {
      ObjectSetString(0, g_prefix + "Ratio", OBJPROP_TEXT, "データ取得待ち...");
      ObjectSetInteger(0, g_prefix + "PBarL", OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(0, g_prefix + "PBarS", OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      for(int i = 0; i < 3; i++)
         ObjectSetString(0, g_prefix + "TopTxt" + IntegerToString(i), OBJPROP_TEXT, "");
     }

   string statusText  = "";
   color  statusColor = clrSilver;

   if(feederDown)
     {
      statusText  = "フィーダーEAが動作していません";
      statusColor = clrRed;
     }
   else if(status != OB_ST_OK && status != OB_ST_PENDING)
     {
      statusText  = OB_StatusText(status, http);
      statusColor = clrRed;
     }
   else if(g_dataTime > 0)
      statusText = "更新: " + TimeToString(g_dataTime, TIME_DATE | TIME_MINUTES) + " (OANDA時刻)";
   else
      statusText = OB_StatusText(status, http);

   ObjectSetString(0, g_prefix + "Status", OBJPROP_TEXT, statusText);
   ObjectSetInteger(0, g_prefix + "Status", OBJPROP_COLOR, statusColor);
}

//+------------------------------------------------------------------+
//| ブック全体で最も集中している価格帯を上位3件表示                        |
//+------------------------------------------------------------------+
void UpdateTopTexts()
{
   double bestVal[3];
   int    bestIdx[3];
   for(int i = 0; i < 3; i++)
     {
      bestVal[i] = -1;
      bestIdx[i] = -1;
     }

   for(int i = 0; i < g_bucketCount; i++)
     {
      double v = g_buckets[i].longPct + g_buckets[i].shortPct;
      for(int s = 0; s < 3; s++)
        {
         if(v > bestVal[s])
           {
            for(int t = 2; t > s; t--)
              {
               bestVal[t] = bestVal[t - 1];
               bestIdx[t] = bestIdx[t - 1];
              }
            bestVal[s] = v;
            bestIdx[s] = i;
            break;
           }
        }
     }

   for(int i = 0; i < 3; i++)
     {
      string name = g_prefix + "TopTxt" + IntegerToString(i);
      if(bestIdx[i] < 0)
        {
         ObjectSetString(0, name, OBJPROP_TEXT, "");
         continue;
        }
      double p  = g_buckets[bestIdx[i]].price;
      double lp = g_buckets[bestIdx[i]].longPct;
      double sp = g_buckets[bestIdx[i]].shortPct;
      string side = (lp >= sp) ? "L" : "S";
      ObjectSetString(0, name, OBJPROP_TEXT,
                      StringFormat("%d. %s  %.2f%%  (%s優勢)",
                                   i + 1, DoubleToString(p, Digits), lp + sp, side));
     }
}
//+------------------------------------------------------------------+
