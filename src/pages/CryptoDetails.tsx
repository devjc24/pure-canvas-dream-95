import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, TrendingDown, TrendingUp, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCryptoDetails,
  useCryptoHistory,
  useCryptoOhlc,
  formatCurrency,
  formatPercentage,
  formatCompactNumber,
} from "@/hooks/useCryptoData";
import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { format } from "date-fns";
import { TradeModal } from "@/components/crypto/TradeModal";

const rangeOptions = [
  { label: "24h", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
];

const chartTypeOptions = [
  { label: "Linha", value: "line" },
  { label: "Velas", value: "candles" },
] as const;

type ChartType = (typeof chartTypeOptions)[number]["value"];

export default function CryptoDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [days, setDays] = useState(1);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [tradeOpen, setTradeOpen] = useState(false);

  const historyStale = days <= 1 ? 120000 : 300000;

  const { data: crypto, isLoading: isLoadingCrypto } = useCryptoDetails(id);
  const {
    data: history,
    isLoading: isLoadingHistory,
    isError: isErrorHistory,
  } = useCryptoHistory(id, days, undefined, historyStale);
  const ohlcDays = days;
  const {
    data: ohlc,
    isLoading: isLoadingOhlc,
    isError: isErrorOhlc,
  } = useCryptoOhlc(id, ohlcDays, chartType === "candles", undefined, 120000);

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    const pattern = days <= 1 ? "HH:mm" : "dd/MM";
    const mapped = history.map((point) => ({
      time: format(new Date(point.time), pattern),
      price: point.price,
    }));
    const maxPoints = days <= 1 ? 220 : days <= 7 ? 180 : 120;
    if (mapped.length <= maxPoints) return mapped;
    const step = Math.ceil(mapped.length / maxPoints);
    return mapped.filter((_, index) => index % step === 0);
  }, [history, days]);

  const ohlcData = useMemo(() => {
    if (!ohlc || ohlc.length === 0) return [];
    const pattern = days <= 1 ? "HH:mm" : "dd/MM";
    return ohlc.map((point) => ({
      time: format(new Date(point.time), pattern),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
    }));
  }, [ohlc, days]);

  const candleData = useMemo(() => {
    if (ohlcData.length > 0) return ohlcData;
    if (!history || history.length === 0) return [];
    const pattern = days <= 1 ? "HH:mm" : "dd/MM";
    const targetCandles = days <= 7 ? 120 : 80;
    const buckets = buildCandlesFromHistory(history, targetCandles);
    return buckets.map((bucket) => ({
      time: format(new Date(bucket.time), pattern),
      open: bucket.open,
      high: bucket.high,
      low: bucket.low,
      close: bucket.close,
    }));
  }, [ohlcData, history, days]);

  const latestHistory = history && history.length > 0 ? history[history.length - 1] : null;
  const latestOhlc = candleData.length > 0 ? candleData[candleData.length - 1] : null;

  const isPositive = (crypto?.price_change_percentage_24h ?? 0) >= 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Detalhes da Criptomoeda</h1>
              <p className="text-muted-foreground">Gráfico em tempo real e oscilações</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              onClick={() => setTradeOpen(true)}
              className="gap-2"
              disabled={!crypto}
            >
              <LineChart className="h-4 w-4" />
              Negociar
            </Button>
            <Button variant="outline" onClick={() => navigate("/crypto")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="relative z-10">
            {isLoadingCrypto || !crypto ? (
              <div className="text-muted-foreground">Carregando dados...</div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img src={crypto.image} alt={crypto.name} className="w-12 h-12 rounded-full" />
                  <div>
                    <h2 className="text-xl font-bold">{crypto.name}</h2>
                    <p className="text-sm text-muted-foreground uppercase">{crypto.symbol}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(crypto.current_price)}</p>
                  <p className={`text-sm font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                    {isPositive ? <TrendingUp className="inline h-4 w-4" /> : <TrendingDown className="inline h-4 w-4" />} {" "}
                    {formatPercentage(crypto.price_change_percentage_24h)} (24h)
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg font-semibold">Oscilações</h3>
              <div className="flex flex-wrap gap-2">
                {rangeOptions.map((option) => (
                  <Button
                    key={option.label}
                    variant={days === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDays(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
                <div className="h-8 w-px bg-border/50" />
                {chartTypeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={chartType === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChartType(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="h-72">
              {chartType === "candles" ? (
                isLoadingOhlc && candleData.length === 0 ? (
                  <div className="text-muted-foreground">Carregando gráfico...</div>
                ) : isErrorOhlc && candleData.length === 0 ? (
                  <div className="text-muted-foreground">Nao foi possivel carregar o grafico de velas.</div>
                ) : candleData.length === 0 ? (
                  <div className="text-muted-foreground">
                    Sem dados de velas para este periodo.
                    <Button variant="outline" size="sm" className="ml-2" onClick={() => setChartType("line")}>
                      Ver linha
                    </Button>
                  </div>
                ) : (
                  <CandleChart data={candleData} />
                )
              ) : isLoadingHistory ? (
                <div className="text-muted-foreground">Carregando gráfico...</div>
              ) : isErrorHistory ? (
                <div className="text-muted-foreground">Nao foi possivel carregar o grafico.</div>
              ) : chartData.length === 0 ? (
                <div className="text-muted-foreground">Sem dados para o periodo.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(value) => formatCurrency(value)}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => [formatCurrency(value), "Preço"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </motion.div>

        {/* Market Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="stat-card"
        >
          <div className="relative z-10 space-y-4">
            <h3 className="text-lg font-semibold">Informacoes do mercado</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Market Cap</p>
                <p className="text-lg font-bold">{crypto?.market_cap ? formatCompactNumber(crypto.market_cap) : "-"}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Volume 24h</p>
                <p className="text-lg font-bold">{crypto?.total_volume ? formatCompactNumber(crypto.total_volume) : "-"}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Alta 24h</p>
                <p className="text-lg font-bold">{crypto?.high_24h ? formatCurrency(crypto.high_24h) : "-"}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Baixa 24h</p>
                <p className="text-lg font-bold">{crypto?.low_24h ? formatCurrency(crypto.low_24h) : "-"}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Variacao 24h</p>
                <p className={`text-lg font-bold ${isPositive ? "text-success" : "text-destructive"}`}>
                  {crypto?.price_change_24h ? formatCurrency(crypto.price_change_24h) : "-"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Rank</p>
                <p className="text-lg font-bold">{crypto?.market_cap_rank ? `#${crypto.market_cap_rank}` : "-"}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Chart Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <div className="relative z-10 space-y-4">
            <h3 className="text-lg font-semibold">Detalhes do grafico</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Ultima atualizacao</p>
                <p className="text-lg font-bold">
                  {latestHistory ? format(new Date(latestHistory.time), "dd/MM/yyyy HH:mm") : "-"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Preco mais recente</p>
                <p className="text-lg font-bold">
                  {latestHistory ? formatCurrency(latestHistory.price) : "-"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Tipo de grafico</p>
                <p className="text-lg font-bold">{chartType === "candles" ? "Velas" : "Linha"}</p>
              </div>
            </div>
            {chartType === "candles" && latestOhlc && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Abertura</p>
                  <p className="text-lg font-bold">{formatCurrency(latestOhlc.open)}</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Maxima</p>
                  <p className="text-lg font-bold">{formatCurrency(latestOhlc.high)}</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Minima</p>
                  <p className="text-lg font-bold">{formatCurrency(latestOhlc.low)}</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Fechamento</p>
                  <p className="text-lg font-bold">{formatCurrency(latestOhlc.close)}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      <TradeModal open={tradeOpen} onOpenChange={setTradeOpen} crypto={crypto || null} />
    </MainLayout>
  );
}

function CandleChart({ data }: { data: Array<{ time: string; open: number; high: number; low: number; close: number }> }) {
  if (!data.length) {
    return <div className="text-muted-foreground">Sem dados para o período.</div>;
  }

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 1000;
  const height = 300;
  const padding = 16;

  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;

  const plotHeight = height - padding * 2;
  const plotWidth = width - padding * 2;
  const candleWidth = Math.max(3, Math.min(12, plotWidth / data.length));

  const toY = (value: number) => padding + ((max - value) / range) * plotHeight;

  const step = plotWidth / data.length;
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div
      className="relative h-full"
      onMouseLeave={() => setHoverIndex(null)}
      onMouseMove={(event) => {
        const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const index = Math.min(data.length - 1, Math.max(0, Math.floor((x - padding) / step)));
        setHoverIndex(index);
      }}
    >
      {hovered && (
        <div className="absolute top-2 right-2 rounded-lg bg-card border border-border/50 px-3 py-2 text-xs">
          <div className="text-muted-foreground">{hovered.time}</div>
          <div>Abertura: {formatCurrency(hovered.open)}</div>
          <div>Maxima: {formatCurrency(hovered.high)}</div>
          <div>Minima: {formatCurrency(hovered.low)}</div>
          <div>Fechamento: {formatCurrency(hovered.close)}</div>
        </div>
      )}
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {data.map((d, index) => {
          const xCenter = padding + index * step + step / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? "hsl(var(--success))" : "hsl(var(--destructive))";

          const yHigh = toY(d.high);
          const yLow = toY(d.low);
          const yOpen = toY(d.open);
          const yClose = toY(d.close);

          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));

          return (
            <g key={`${d.time}-${index}`} opacity={hoverIndex !== null && hoverIndex !== index ? 0.4 : 1}>
              <line x1={xCenter} x2={xCenter} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
              <rect
                x={xCenter - candleWidth * 0.3}
                y={bodyTop}
                width={candleWidth * 0.6}
                height={bodyHeight}
                fill={color}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function buildCandlesFromHistory(history: Array<{ time: number; price: number }>, targetCandles: number) {
  if (!history.length) return [] as Array<{ time: number; open: number; high: number; low: number; close: number }>;

  const start = history[0].time;
  const end = history[history.length - 1].time;
  const range = Math.max(1, end - start);
  const bucketSize = Math.max(60 * 1000, Math.floor(range / targetCandles));

  const buckets: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  let currentBucketStart = start;
  let open = history[0].price;
  let high = history[0].price;
  let low = history[0].price;
  let close = history[0].price;

  for (let i = 1; i < history.length; i += 1) {
    const point = history[i];
    while (point.time >= currentBucketStart + bucketSize) {
      buckets.push({ time: currentBucketStart, open, high, low, close });
      currentBucketStart += bucketSize;
      open = close;
      high = close;
      low = close;
    }

    close = point.price;
    high = Math.max(high, point.price);
    low = Math.min(low, point.price);
  }

  buckets.push({ time: currentBucketStart, open, high, low, close });
  return buckets;
}
