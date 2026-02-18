import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { FileText, Download, Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/hooks/useCryptoData";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const monthlyData = [
  { month: "Jan", compras: 15000, vendas: 8000 },
  { month: "Fev", compras: 12000, vendas: 15000 },
  { month: "Mar", compras: 18000, vendas: 10000 },
  { month: "Abr", compras: 22000, vendas: 12000 },
  { month: "Mai", compras: 16000, vendas: 20000 },
  { month: "Jun", compras: 25000, vendas: 14000 },
];

const portfolioDistribution = [
  { name: "Bitcoin", value: 45, color: "hsl(38, 92%, 50%)" },
  { name: "Ethereum", value: 30, color: "hsl(240, 60%, 60%)" },
  { name: "Solana", value: 15, color: "hsl(280, 70%, 60%)" },
  { name: "Outros", value: 10, color: "hsl(var(--muted-foreground))" },
];

const profitHistory = [
  { date: "01/06", lucro: 500 },
  { date: "05/06", lucro: 1200 },
  { date: "10/06", lucro: 800 },
  { date: "15/06", lucro: 2100 },
  { date: "20/06", lucro: 1800 },
  { date: "25/06", lucro: 2500 },
  { date: "30/06", lucro: 3200 },
];

const transactions = [
  { id: 1, date: "05/02/2026", type: "buy", crypto: "BTC", amount: 0.015, value: 5250, fee: 26.25 },
  { id: 2, date: "04/02/2026", type: "sell", crypto: "ETH", amount: 0.5, value: 3150, fee: 15.75 },
  { id: 3, date: "03/02/2026", type: "buy", crypto: "SOL", amount: 10, value: 2800, fee: 14.00 },
  { id: 4, date: "02/02/2026", type: "deposit", crypto: "BRL", amount: 10000, value: 10000, fee: 0 },
  { id: 5, date: "01/02/2026", type: "buy", crypto: "BTC", amount: 0.01, value: 3500, fee: 17.50 },
  { id: 6, date: "28/01/2026", type: "sell", crypto: "SOL", amount: 5, value: 1400, fee: 7.00 },
];

export default function Reports() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
              <p className="text-muted-foreground">Análise detalhada das suas operações</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="month">
              <SelectTrigger className="w-40 bg-secondary/50">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="year">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </motion.div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Compras", value: "R$ 108.000", icon: ArrowDownLeft, color: "text-success" },
            { label: "Total Vendas", value: "R$ 79.000", icon: ArrowUpRight, color: "text-accent" },
            { label: "Lucro Líquido", value: "+R$ 8.750", icon: TrendingUp, color: "text-success" },
            { label: "Taxas Pagas", value: "R$ 540", icon: TrendingDown, color: "text-destructive" },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="stat-card"
            >
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Operations Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <h3 className="text-lg font-semibold mb-4">Operações Mensais</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(v) => `${v/1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [formatCurrency(value)]}
                    />
                    <Legend />
                    <Bar dataKey="compras" name="Compras" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

          {/* Portfolio Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <h3 className="text-lg font-semibold mb-4">Distribuição do Portfólio</h3>
              <div className="h-64 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolioDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {portfolioDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [`${value}%`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 min-w-32">
                  {portfolioDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                      <span className="text-sm font-medium ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Profit History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="stat-card lg:col-span-2"
          >
            <div className="relative z-10">
              <h3 className="text-lg font-semibold mb-4">Evolução do Lucro (Junho)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profitHistory}>
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
                      tickFormatter={(v) => `R$ ${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [formatCurrency(value), "Lucro"]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lucro" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Transaction History Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="stat-card !p-0 overflow-hidden"
        >
          <div className="p-4 border-b border-border/50">
            <h3 className="text-lg font-semibold">Histórico de Transações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ativo</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Quantidade</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.05 }}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-4 px-4 text-sm">{tx.date}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        tx.type === 'buy' ? 'bg-success/10 text-success' :
                        tx.type === 'sell' ? 'bg-accent/10 text-accent' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {tx.type === 'buy' ? 'Compra' : tx.type === 'sell' ? 'Venda' : 'Depósito'}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-medium">{tx.crypto}</td>
                    <td className="py-4 px-4 text-right">{tx.amount}</td>
                    <td className="py-4 px-4 text-right font-medium">{formatCurrency(tx.value)}</td>
                    <td className="py-4 px-4 text-right text-muted-foreground">{formatCurrency(tx.fee)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}
