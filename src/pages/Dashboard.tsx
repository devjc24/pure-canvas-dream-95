import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Bitcoin,
  Activity
} from "lucide-react";
import { formatCurrency, formatPercentage } from "@/hooks/useCryptoData";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { fixMojibake } from "@/lib/utils";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";

export default function Dashboard() {
  const { token, user } = useAuth();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [saldoAnterior, setSaldoAnterior] = useState<number | null>(null);
  const [lucro, setLucro] = useState<number | null>(null);
  const [totalInvestido, setTotalInvestido] = useState<number | null>(null);
  const [totalTransacoes, setTotalTransacoes] = useState<number | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [topCryptos, setTopCryptos] = useState<any[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<{ date: string, value: number }[]>([]);
  const [processingTrade, setProcessingTrade] = useState<{crypto_symbol: string, created_at: string} | null>(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showConsultarCompras, setShowConsultarCompras] = useState(false);
  const [compras, setCompras] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/balance", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setSaldo(data.saldoDisponivel ?? null);
        setSaldoAnterior(data.saldoAnterior ?? null);
      })
      .catch(() => {
        setSaldo(null);
        setSaldoAnterior(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/profit-loss", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setLucro(typeof data.lucro === 'number' ? data.lucro : null);
      })
      .catch(() => {
        setLucro(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/total-investido", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setTotalInvestido(typeof data.totalInvestido === 'number' ? data.totalInvestido : null);
      })
      .catch(() => {
        setTotalInvestido(null);
      });
    fetch("/api/wallet/total-transacoes", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setTotalTransacoes(typeof data.totalTransacoes === 'number' ? data.totalTransacoes : null);
      })
      .catch(() => {
        setTotalTransacoes(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/recent-trades", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setRecentTransactions(Array.isArray(data.trades) ? data.trades : []);
      })
      .catch(() => setRecentTransactions([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/top-cryptos", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setTopCryptos(Array.isArray(data.cryptos) ? data.cryptos : []);
      })
      .catch(() => setTopCryptos([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/portfolio-history", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setPortfolioHistory(Array.isArray(data.history) ? data.history : []);
      })
      .catch(() => setPortfolioHistory([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/trade/processing-detail", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setProcessingTrade(data?.processing || null);
      })
      .catch(() => setProcessingTrade(null));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (!showConsultarCompras) return;
    fetch("/api/wallet/compras", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setCompras(Array.isArray(data.compras) ? data.compras : []);
      })
      .catch(() => setCompras([]));
  }, [token, showConsultarCompras]);

  let change = saldo !== null && saldoAnterior !== null
    ? (() => {
        const diff = saldo - saldoAnterior;
        const pct = saldoAnterior !== 0 ? (diff / saldoAnterior) * 100 : 0;
        return `${diff >= 0 ? "+" : "-"}R$ ${Math.abs(diff).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${diff >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(2)}%)`;
      })()
    : "+R$ 0,00 (+0,00%)";
  let changeType: "positive" | "negative" | "neutral" = "neutral";
  if (saldo !== null && saldoAnterior !== null) {
    const diff = saldo - saldoAnterior;
    changeType = diff > 0 ? "positive" : diff < 0 ? "negative" : "neutral";
  }

  const displayName = fixMojibake(String(user?.name || "")).trim();
  const firstName = displayName.split(" ")[0] || "";

  return (
    <MainLayout>
      {processingTrade && (
        <Alert className="mb-4 bg-yellow-50 border-yellow-400 text-yellow-900">
          <div className="font-semibold">Negociação em processamento</div>
          <div>
            Moeda: <b>{processingTrade.crypto_symbol?.toUpperCase()}</b> <br />
            Iniciada em: {processingTrade.created_at && new Date(processingTrade.created_at).toLocaleString()} <br />
            Lucro será creditado em até 2 minutos após a compra.
          </div>
        </Alert>
      )}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Bem-vindo de volta{firstName ? ` ${firstName}` : ""}! Aqui esta o resumo financeiro.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Saldo Total"
            value={saldo === null ? "R$ 0,00" : `R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            change={change}
            changeType={changeType}
            icon={Wallet}
            delay={0}
          />
          <StatCard
            title="Lucro/Prejuízo"
            value={lucro === null ? "R$ 0,00" : `R$ ${lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            change="Últimos 30 dias"
            changeType={lucro === null ? "neutral" : lucro > 0 ? "positive" : lucro < 0 ? "negative" : "neutral"}
            icon={TrendingUp}
            delay={0.1}
          />
          <StatCard
            title="Total Investido"
            value={totalInvestido === null ? "R$ 0,00" : `R$ ${totalInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            change={totalInvestido === null ? "---" : "Soma das compras"}
            changeType="neutral"
            icon={Bitcoin}
            delay={0.2}
          />
          <StatCard
            title="Transações"
            value={totalTransacoes === null ? "0" : totalTransacoes.toString()}
            change="Este mês"
            changeType="neutral"
            icon={Activity}
            delay={0.3}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Portfolio Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 stat-card"
          >
            <div className="relative z-10">
              <h3 className="text-lg font-semibold mb-4">Evolução do Portfólio</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={portfolioHistory.length > 0 ? portfolioHistory : [{ date: 'Sem dados', value: 0 }]}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [formatCurrency(value), "Valor"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

          {/* Quick Holdings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Suas Criptos</h3>
                <button
                  className="text-primary underline text-sm font-medium hover:opacity-80"
                  onClick={() => setShowConsultarCompras(true)}
                >
                  Consultar Compras
                </button>
              </div>
              <Dialog open={showConsultarCompras} onOpenChange={setShowConsultarCompras}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Compras em Processamento ou Concluídas</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[60vh] overflow-y-auto space-y-2 mt-4">
                    {compras.length === 0 && (
                      <p className="text-muted-foreground text-sm">Nenhuma compra encontrada.</p>
                    )}
                    {compras.map((compra) => {
                      // Busca o mesmo dado de imagem e nome das outras telas
                      const topCrypto = topCryptos.find(c => c.symbol?.toLowerCase() === compra.crypto_symbol?.toLowerCase());
                      const image = topCrypto?.image || "/placeholder.svg";
                      const name = topCrypto?.name || compra.crypto_symbol;
                      const status = compra.status || (compra.status === 'processando' ? "Processando" : "Concluída");
                      return (
                        <div key={compra.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <img src={image} alt={compra.crypto_symbol} className="w-8 h-8 rounded-full" />
                            <div>
                              <p className="font-medium text-sm">{compra.crypto_symbol?.toUpperCase() || "?"}</p>
                              <p className="text-xs text-muted-foreground">{name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">{formatCurrency(compra.valor_total)}</p>
                            <p className="text-xs text-muted-foreground">{status}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <DialogClose asChild>
                    <button className="mt-4 w-full py-2 rounded bg-primary text-white font-semibold hover:bg-primary/90">Fechar</button>
                  </DialogClose>
                </DialogContent>
              </Dialog>
              <div className="space-y-3">
                {topCryptos.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhuma cripto encontrada.</p>
                )}
                {topCryptos.map((crypto, index) => {
                  const image = crypto.image || "/placeholder.svg";
                  const preco = Number(crypto.current_price) || 0;
                  const lucroReal = Number(crypto.lucro) - Number(crypto.prejuizo);
                  let lucroClass = "";
                  let lucroTexto = "";
                  if (lucroReal > 0) {
                    lucroClass = "text-success";
                    lucroTexto = `Lucro: R$ ${lucroReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                  } else if (lucroReal < 0) {
                    lucroClass = "text-destructive";
                    lucroTexto = `Prejuízo: R$ ${Math.abs(lucroReal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                  } else {
                    lucroClass = "text-foreground";
                    lucroTexto = `R$ 0,00`;
                  }
                  return (
                    <div 
                      key={crypto.symbol}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img src={image} alt={crypto.name} className="w-8 h-8 rounded-full" />
                        <div>
                          <p className="font-medium text-sm">{crypto.symbol?.toUpperCase() || "?"}</p>
                          <p className="text-xs text-muted-foreground">{crypto.name || crypto.symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{formatCurrency(preco)}</p>
                        <p className={`text-xs ${lucroClass}`}>{lucroTexto}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Transações Recentes</h3>
              <Dialog open={showAllTransactions} onOpenChange={setShowAllTransactions}>
                <DialogTrigger asChild>
                  <button
                    className="text-primary underline text-sm font-medium hover:opacity-80"
                    onClick={() => setShowAllTransactions(true)}
                  >
                    Ver Tudo
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Todas as Transações</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[60vh] overflow-y-auto space-y-2 mt-4">
                    {recentTransactions.length === 0 && (
                      <p className="text-muted-foreground text-sm">Nenhuma transação encontrada.</p>
                    )}
                    {recentTransactions.map((tx) => {
                      const isLucro = Number(tx.lucro) > 0;
                      const isPrejuizo = Number(tx.prejuizo) > 0;
                      const nomeCripto = tx.name || tx.cripto || tx.crypto_symbol || "Cripto";
                      let statusLabel = "";
                      let statusClass = "";
                      let valorClass = "";
                      let valorFormatado = "";
                      if (isLucro) {
                        statusLabel = `Lucro - ${nomeCripto}`;
                        statusClass = "text-success";
                        valorClass = "text-success";
                        valorFormatado = `+${formatCurrency(Math.abs(tx.valor_total))}`;
                      } else if (isPrejuizo) {
                        statusLabel = `Prejuízo - ${nomeCripto}`;
                        statusClass = "text-destructive";
                        valorClass = "text-destructive";
                        valorFormatado = `-${formatCurrency(Math.abs(tx.valor_total))}`;
                      } else {
                        statusLabel = nomeCripto;
                        statusClass = "text-muted-foreground";
                        valorClass = "text-muted-foreground";
                        valorFormatado = formatCurrency(tx.valor_total);
                      }
                      return (
                        <div 
                          key={tx.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <img src={tx.image || "/placeholder.svg"} alt={nomeCripto} className="w-8 h-8 rounded-full" />
                            <div>
                              <p className={`font-medium text-sm ${statusClass}`}>{statusLabel}</p>
                              <p className="text-xs text-muted-foreground">{new Date(tx.criado_em).toLocaleString('pt-BR')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium text-sm ${valorClass}`}>{valorFormatado}</p>
                            <p className="text-xs text-muted-foreground">{Number(tx.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {nomeCripto}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <DialogClose asChild>
                    <button className="mt-4 w-full py-2 rounded bg-primary text-white font-semibold hover:bg-primary/90">Fechar</button>
                  </DialogClose>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {recentTransactions.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma transação encontrada.</p>
              )}
              {recentTransactions.slice(0, 5).map((tx) => { // Mostra apenas as 5 mais recentes no dashboard, o resto fica na modal (30 atualmente)
                const isLucro = Number(tx.lucro) > 0;
                const isPrejuizo = Number(tx.prejuizo) > 0;
                const nomeCripto = tx.name || tx.cripto || tx.crypto_symbol || "Cripto";
                let statusLabel = "";
                let statusClass = "";
                let valorClass = "";
                let valorFormatado = "";
                if (isLucro) {
                  statusLabel = `Lucro - ${nomeCripto}`;
                  statusClass = "text-success";
                  valorClass = "text-success";
                  valorFormatado = `+${formatCurrency(Math.abs(tx.valor_total))}`;
                } else if (isPrejuizo) {
                  statusLabel = `Prejuízo - ${nomeCripto}`;
                  statusClass = "text-destructive";
                  valorClass = "text-destructive";
                  valorFormatado = `-${formatCurrency(Math.abs(tx.valor_total))}`;
                } else {
                  statusLabel = nomeCripto;
                  statusClass = "text-muted-foreground";
                  valorClass = "text-muted-foreground";
                  valorFormatado = formatCurrency(tx.valor_total);
                }
                return (
                  <div 
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img src={tx.image || "/placeholder.svg"} alt={nomeCripto} className="w-8 h-8 rounded-full" />
                      <div>
                        <p className={`font-medium text-sm ${statusClass}`}>{statusLabel}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.criado_em).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium text-sm ${valorClass}`}>{valorFormatado}</p>
                      <p className="text-xs text-muted-foreground">{Number(tx.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {nomeCripto}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}
