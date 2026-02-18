// Painel Administrativo

import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { ShieldCheck, Users, Link2, ListChecks } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatCurrency } from "@/hooks/useCryptoData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type AdminSummary = {
  totalUsers: number;
  activeUsers: number;
  totalReferrals: number;
  totalDeposits: number;
  totalDepositValue: number;
  totalTransactions: number;
  totalCashin: number;
  totalCashout: number;
  totalApproved: number;
  totalPending: number;
  totalCanceled: number;
  totalCashinValue: number;
  totalCashoutValue: number;
};

type AdminTransaction = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  tipo: string;
  status: string;
  valorBruto: number;
  valorLiquido: number;
  idTransaction: string | null;
  externalReference: string | null;
  localId: string | null;
  createdAt: string;
};

const initialSummary: AdminSummary = {
  totalUsers: 0,
  activeUsers: 0,
  totalReferrals: 0,
  totalDeposits: 0,
  totalDepositValue: 0,
  totalTransactions: 0,
  totalCashin: 0,
  totalCashout: 0,
  totalApproved: 0,
  totalPending: 0,
  totalCanceled: 0,
  totalCashinValue: 0,
  totalCashoutValue: 0,
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState<AdminSummary>(initialSummary);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [txUserFilter, setTxUserFilter] = useState("");
  const [txStatusFilter, setTxStatusFilter] = useState("");
  const [txTipoFilter, setTxTipoFilter] = useState("");
  const [txStartDate, setTxStartDate] = useState("");
  const [txEndDate, setTxEndDate] = useState("");
  const [txMinValue, setTxMinValue] = useState("");
  const [txMaxValue, setTxMaxValue] = useState("");
  const [txOrderBy, setTxOrderBy] = useState("date");
  const [txOrderDir, setTxOrderDir] = useState("desc");
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const pageSize = 20;

  const normalizeMoneyInput = (value: string) =>
    String(value || "")
      .replace(/[^0-9.,]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

  useEffect(() => {
    if (!token) return;

    fetch("/api/admin/summary", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setSummary({
          totalUsers: data?.totalUsers || 0,
          activeUsers: data?.activeUsers || 0,
          totalReferrals: data?.totalReferrals || 0,
          totalDeposits: data?.totalDeposits || 0,
          totalDepositValue: data?.totalDepositValue || 0,
          totalTransactions: data?.totalTransactions || 0,
          totalCashin: data?.totalCashin || 0,
          totalCashout: data?.totalCashout || 0,
          totalApproved: data?.totalApproved || 0,
          totalPending: data?.totalPending || 0,
          totalCanceled: data?.totalCanceled || 0,
          totalCashinValue: data?.totalCashinValue || 0,
          totalCashoutValue: data?.totalCashoutValue || 0,
        });
      })
      .catch(() => {
        setSummary(initialSummary);
        toast({ title: "Falha ao carregar resumo" });
      });
  }, [token]);

  const csvEscape = (value: string | number | null | undefined) => {
    const raw = String(value ?? "");
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const exportTransactionsCsv = () => {
    if (!transactions.length) return;
    const header = [
      "id",
      "usuario_id",
      "usuario_nome",
      "usuario_email",
      "tipo",
      "status",
      "valor_bruto",
      "valor_liquido",
      "id_transaction",
      "external_reference",
      "id_local",
      "criado_em",
    ];
    const rows = transactions.map((tx) => [
      tx.id,
      tx.userId,
      tx.userName,
      tx.userEmail,
      tx.tipo,
      tx.status,
      tx.valorBruto,
      tx.valorLiquido,
      tx.idTransaction,
      tx.externalReference,
      tx.localId,
      tx.createdAt,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transacoes.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadTransactions = (page = 1, overrides?: { user?: string }) => {
    if (!token) return;
    setTransactionsLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String((page - 1) * pageSize));
    const userFilter = overrides?.user ?? txUserFilter;
    if (userFilter.trim()) {
      params.set("user", userFilter.trim());
    }
    if (txStatusFilter.trim()) {
      params.set("status", txStatusFilter.trim());
    }
    if (txTipoFilter.trim()) {
      params.set("tipo", txTipoFilter.trim());
    }
    if (txStartDate) {
      params.set("startDate", txStartDate);
    }
    if (txEndDate) {
      params.set("endDate", txEndDate);
    }
    const minValue = normalizeMoneyInput(txMinValue);
    const maxValue = normalizeMoneyInput(txMaxValue);
    if (minValue) {
      params.set("minValue", minValue);
    }
    if (maxValue) {
      params.set("maxValue", maxValue);
    }
    if (txOrderBy) {
      params.set("orderBy", txOrderBy);
    }
    if (txOrderDir) {
      params.set("orderDir", txOrderDir);
    }

    fetch(`/api/admin/transactions?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data?.transactions || []);
        setTransactionsTotal(data?.total || 0);
        setTransactionsPage(page);
      })
      .catch(() => {
        setTransactions([]);
        setTransactionsTotal(0);
        toast({ title: "Falha ao carregar transacoes" });
      })
      .finally(() => setTransactionsLoading(false));
  };

  const clearFilters = () => {
    setTxUserFilter("");
    setTxStatusFilter("");
    setTxTipoFilter("");
    setTxStartDate("");
    setTxEndDate("");
    setTxMinValue("");
    setTxMaxValue("");
    setTxOrderBy("date");
    setTxOrderDir("desc");
    loadTransactions(1, { user: "" });
  };

  useEffect(() => {
    loadTransactions(1);
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const user = params.get("user");
    if (user) {
      setTxUserFilter(user);
      loadTransactions(1, { user });
    }
  }, [location.search]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Gerencial</h1>
            <p className="text-muted-foreground">Visao geral e configuracoes da plataforma</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Usuarios", value: summary.totalUsers, icon: Users, color: "text-primary" },
            { label: "Usuarios ativos", value: summary.activeUsers, icon: Users, color: "text-success" },
            { label: "Indicacoes", value: summary.totalReferrals, icon: Link2, color: "text-accent" },
            { label: "Transacoes", value: summary.totalTransactions, icon: ListChecks, color: "text-warning" },
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
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Resumo financeiro</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Depositos aprovados</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalCashinValue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saques aprovados</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalCashoutValue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Depositos (legado)</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalDepositValue)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Transacoes ({transactionsTotal})</h3>
            <div className="grid grid-cols-1 lg:grid-cols-8 gap-2 mb-4">
              <Input
                placeholder="Usuario ID, nome ou email"
                value={txUserFilter}
                onChange={(event) => setTxUserFilter(event.target.value)}
                className="bg-secondary/50"
              />
              <Input
                placeholder="Status (APROVADO, PENDENTE, CANCELADO)"
                value={txStatusFilter}
                onChange={(event) => setTxStatusFilter(event.target.value)}
                className="bg-secondary/50"
              />
              <Input
                placeholder="Tipo (CASH_IN, CASH_OUT)"
                value={txTipoFilter}
                onChange={(event) => setTxTipoFilter(event.target.value)}
                className="bg-secondary/50"
              />
              <Input
                placeholder="Valor minimo"
                value={txMinValue}
                onChange={(event) => setTxMinValue(event.target.value)}
                className="bg-secondary/50"
                inputMode="decimal"
              />
              <Input
                placeholder="Valor maximo"
                value={txMaxValue}
                onChange={(event) => setTxMaxValue(event.target.value)}
                className="bg-secondary/50"
                inputMode="decimal"
              />
              <Input
                type="date"
                value={txStartDate}
                onChange={(event) => setTxStartDate(event.target.value)}
                className="bg-secondary/50"
              />
              <Input
                type="date"
                value={txEndDate}
                onChange={(event) => setTxEndDate(event.target.value)}
                className="bg-secondary/50"
              />
              <div className="flex gap-2">
                <Button onClick={() => loadTransactions(1)} disabled={transactionsLoading}>
                  {transactionsLoading ? "Carregando..." : "Filtrar"}
                </Button>
                <Button variant="outline" onClick={clearFilters} disabled={transactionsLoading}>
                  Limpar
                </Button>
                <Button variant="outline" onClick={exportTransactionsCsv} disabled={!transactions.length}>
                  Exportar CSV
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={txOrderBy}
                onChange={(event) => setTxOrderBy(event.target.value)}
              >
                <option value="date">Ordenar por data</option>
                <option value="value">Ordenar por valor</option>
                <option value="status">Ordenar por status</option>
                <option value="tipo">Ordenar por tipo</option>
              </select>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={txOrderDir}
                onChange={(event) => setTxOrderDir(event.target.value)}
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
              <span className="text-xs text-muted-foreground">
                Use virgula para multiplos status/tipos.
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Transacao</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Nenhuma transacao encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{tx.userName || "-"}</span>
                          <span className="text-xs text-muted-foreground">{tx.userEmail || ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>{tx.tipo}</TableCell>
                      <TableCell>{tx.status}</TableCell>
                      <TableCell>{formatCurrency(tx.valorLiquido || tx.valorBruto)}</TableCell>
                      <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={tx.idTransaction || ""}>
                        {tx.idTransaction || tx.externalReference || tx.localId || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admgerencial/transacoes/${tx.id}`)}
                        >
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>
                Pagina {transactionsPage} de {Math.max(1, Math.ceil(transactionsTotal / pageSize))}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTransactions(Math.max(1, transactionsPage - 1))}
                  disabled={transactionsPage <= 1 || transactionsLoading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTransactions(transactionsPage + 1)}
                  disabled={transactionsPage >= Math.ceil(transactionsTotal / pageSize) || transactionsLoading}
                >
                  Proxima
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}
