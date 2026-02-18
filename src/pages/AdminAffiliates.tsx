import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AffiliateRow = {
  id: number;
  name: string;
  email: string;
  cpf: string;
  referralCode: string;
  createdAt: string;
  totalReferred: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
};

type AffiliateSummary = {
  totalAffiliates: number;
  totalReferred: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  commissionPercent: number;
};

export default function AdminAffiliates() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<AffiliateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const csvEscape = (value: string | number | null | undefined) => {
    const raw = String(value ?? "");
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const exportCsv = () => {
    if (!items.length) return;
    const header = [
      "id",
      "nome",
      "email",
      "cpf",
      "referral_code",
      "criado_em",
      "total_referidos",
      "total_commission",
      "paid_commission",
      "pending_commission",
    ];
    const rows = items.map((row) => [
      row.id,
      row.name,
      row.email,
      row.cpf,
      row.referralCode,
      row.createdAt,
      row.totalReferred,
      row.totalCommission,
      row.paidCommission,
      row.pendingCommission,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "afiliados.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadAffiliates = (nextPage = 1) => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String((nextPage - 1) * pageSize));
    if (search.trim()) {
      params.set("search", search.trim());
    }

    fetch(`/api/admin/affiliates?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setItems(data?.affiliates || []);
        setTotal(data?.total || 0);
        setPage(nextPage);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  const loadSummary = () => {
    if (!token) return;
    setSummaryLoading(true);
    fetch("/api/admin/affiliates/summary", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setSummary(data || null);
      })
      .catch(() => {
        setSummary(null);
      })
      .finally(() => setSummaryLoading(false));
  };

  useEffect(() => {
    loadAffiliates(1);
    loadSummary();
  }, [token]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Afiliados</h1>
            <p className="text-muted-foreground">Listagem e gerenciamento de indicacoes</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[
                {
                  label: "Afiliados",
                  value: summary?.totalAffiliates ?? 0,
                  subtitle: `Indicados: ${summary?.totalReferred ?? 0}`,
                },
                {
                  label: "Comissao total",
                  value: summary ? `R$ ${summary.totalCommission.toFixed(2)}` : "R$ 0,00",
                  subtitle: `Percentual: ${summary?.commissionPercent ?? 0}%`,
                },
                {
                  label: "Pagas / Pendentes",
                  value: summary
                    ? `R$ ${summary.paidCommission.toFixed(2)} / R$ ${summary.pendingCommission.toFixed(2)}`
                    : "R$ 0,00 / R$ 0,00",
                  subtitle: summaryLoading ? "Carregando..." : "",
                },
              ].map((stat) => (
                <div key={stat.label} className="stat-card !p-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  {stat.subtitle ? (
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex flex-col md:flex-row gap-2 mb-4">
              <Input
                placeholder="Buscar por nome, email, CPF ou codigo"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="bg-secondary/50"
              />
              <div className="flex gap-2">
                <Button onClick={() => loadAffiliates(1)} disabled={loading}>
                  {loading ? "Carregando..." : "Buscar"}
                </Button>
                <Button variant="outline" onClick={exportCsv} disabled={!items.length}>
                  Exportar CSV
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Indicados</TableHead>
                  <TableHead>Comissao</TableHead>
                  <TableHead>Pagas</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Nenhum afiliado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.cpf}</TableCell>
                      <TableCell>{row.referralCode}</TableCell>
                      <TableCell>{row.totalReferred}</TableCell>
                      <TableCell>R$ {row.totalCommission.toFixed(2)}</TableCell>
                      <TableCell>R$ {row.paidCommission.toFixed(2)}</TableCell>
                      <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>
                Pagina {page} de {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAffiliates(Math.max(1, page - 1))}
                  disabled={page <= 1 || loading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAffiliates(page + 1)}
                  disabled={page >= Math.ceil(total / pageSize) || loading}
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
