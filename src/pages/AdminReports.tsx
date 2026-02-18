import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { FileText, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/hooks/useCryptoData";
import {
  Bar,
  BarChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ReportsSummary = {
  totalUsers: number;
  newUsers: number;
  totalTransactions: number;
  totalApproved: number;
  totalPending: number;
  totalCanceled: number;
  totalCashin: number;
  totalCashout: number;
  cashinValue: number;
  cashoutValue: number;
  approvalRate: number;
};

type ReportsSeries = {
  date: string;
  cashinValue: number;
  cashoutValue: number;
  totalTransactions: number;
  approvedTransactions: number;
};

export default function AdminReports() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [series, setSeries] = useState<ReportsSeries[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReports = () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    fetch(`/api/admin/reports/overview?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setSummary(data?.summary || null);
        setSeries(data?.series || []);
        if (data?.range?.startDate) {
          setStartDate(data.range.startDate);
        }
        if (data?.range?.endDate) {
          setEndDate(data.range.endDate);
        }
      })
      .catch(() => {
        setSummary(null);
        setSeries([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, [token]);

  const chartData = series.map((item) => ({
    ...item,
    label: item.date ? new Date(item.date).toLocaleDateString() : "-",
  }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Relatorios Admin</h1>
              <p className="text-muted-foreground">Indicadores administrativos e tendencias por periodo</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9 w-40 bg-secondary/50"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-9 w-40 bg-secondary/50"
            />
            <Button onClick={loadReports} disabled={loading}>
              {loading ? "Carregando..." : "Atualizar"}
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              label: "Usuarios",
              value: summary?.totalUsers ?? 0,
              icon: Users,
              color: "text-primary",
              subtitle: `Novos: ${summary?.newUsers ?? 0}`,
            },
            {
              label: "Transacoes",
              value: summary?.totalTransactions ?? 0,
              icon: FileText,
              color: "text-accent",
              subtitle: `Aprovadas: ${summary?.totalApproved ?? 0}`,
            },
            {
              label: "Taxa aprovacao",
              value: `${summary?.approvalRate ?? 0}%`,
              icon: TrendingUp,
              color: "text-success",
              subtitle: `Pendentes: ${summary?.totalPending ?? 0}`,
            },
            {
              label: "Cash-in aprovado",
              value: formatCurrency(summary?.cashinValue ?? 0),
              icon: TrendingUp,
              color: "text-success",
              subtitle: `Total: ${summary?.totalCashin ?? 0}`,
            },
            {
              label: "Cash-out aprovado",
              value: formatCurrency(summary?.cashoutValue ?? 0),
              icon: TrendingDown,
              color: "text-warning",
              subtitle: `Total: ${summary?.totalCashout ?? 0}`,
            },
            {
              label: "Canceladas",
              value: summary?.totalCanceled ?? 0,
              icon: TrendingDown,
              color: "text-destructive",
              subtitle: "",
            },
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
                  {stat.subtitle ? (
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  ) : null}
                </div>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <h3 className="text-lg font-semibold mb-4">Volume aprovado por dia</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => [formatCurrency(value)]}
                    />
                    <Legend />
                    <Bar dataKey="cashinValue" name="Cash-in" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cashoutValue" name="Cash-out" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <h3 className="text-lg font-semibold mb-4">Transacoes vs aprovadas</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="totalTransactions"
                      name="Total"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="approvedTransactions"
                      name="Aprovadas"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}
