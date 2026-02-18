import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type SettingsAudit = {
  id: number;
  action: string;
  createdAt: string;
  actorName?: string;
  actorEmail?: string;
  metadata?: Record<string, unknown> | null;
};

export default function AdminSettings() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [minDeposit, setMinDeposit] = useState("50");
  const [minWithdraw, setMinWithdraw] = useState("50");
  const [maxDeposit, setMaxDeposit] = useState("0");
  const [maxWithdraw, setMaxWithdraw] = useState("0");
  const [minReferralWithdraw, setMinReferralWithdraw] = useState("50");
  const [maxReferralWithdraw, setMaxReferralWithdraw] = useState("0");
  const [cashinFeePercent, setCashinFeePercent] = useState("0");
  const [cashoutFeePercent, setCashoutFeePercent] = useState("0");
  const [saving, setSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SettingsAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const normalizeNumberInput = (value: string) =>
    String(value || "")
      .replace(/[^0-9.,]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

  useEffect(() => {
    if (!token) return;
    fetch("/api/admin/settings/gateway", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setApiKey(data?.apiKey || "");
        if (data?.minDeposit !== undefined) {
          setMinDeposit(String(data.minDeposit));
        }
        if (data?.minWithdraw !== undefined) {
          setMinWithdraw(String(data.minWithdraw));
        }
        if (data?.maxDeposit !== undefined) {
          setMaxDeposit(String(data.maxDeposit));
        }
        if (data?.maxWithdraw !== undefined) {
          setMaxWithdraw(String(data.maxWithdraw));
        }
        if (data?.minReferralWithdraw !== undefined) {
          setMinReferralWithdraw(String(data.minReferralWithdraw));
        }
        if (data?.maxReferralWithdraw !== undefined) {
          setMaxReferralWithdraw(String(data.maxReferralWithdraw));
        }
        if (data?.cashinFeePercent !== undefined) {
          setCashinFeePercent(String(data.cashinFeePercent));
        }
        if (data?.cashoutFeePercent !== undefined) {
          setCashoutFeePercent(String(data.cashoutFeePercent));
        }
      })
      .catch(() => {
        setApiKey("");
      });
  }, [token]);

  const loadAudit = () => {
    if (!token) return;
    setAuditLoading(true);
    fetch("/api/admin/settings/audit?limit=20", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setAuditLogs(data?.logs || []);
      })
      .catch(() => {
        setAuditLogs([]);
      })
      .finally(() => setAuditLoading(false));
  };

  useEffect(() => {
    loadAudit();
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const minDepositValue = Number(normalizeNumberInput(minDeposit));
      const minWithdrawValue = Number(normalizeNumberInput(minWithdraw));
      const maxDepositValue = Number(normalizeNumberInput(maxDeposit));
      const maxWithdrawValue = Number(normalizeNumberInput(maxWithdraw));
      const minReferralWithdrawValue = Number(normalizeNumberInput(minReferralWithdraw));
      const maxReferralWithdrawValue = Number(normalizeNumberInput(maxReferralWithdraw));
      const cashinFeeValue = Number(normalizeNumberInput(cashinFeePercent));
      const cashoutFeeValue = Number(normalizeNumberInput(cashoutFeePercent));

      if (Number.isFinite(maxDepositValue) && maxDepositValue > 0 && maxDepositValue < minDepositValue) {
        toast({ title: "Deposito maximo deve ser maior que o minimo." });
        setSaving(false);
        return;
      }
      if (Number.isFinite(maxWithdrawValue) && maxWithdrawValue > 0 && maxWithdrawValue < minWithdrawValue) {
        toast({ title: "Saque maximo deve ser maior que o minimo." });
        setSaving(false);
        return;
      }
      if (Number.isFinite(minReferralWithdrawValue) && minReferralWithdrawValue > 0 && minReferralWithdrawValue < 1) {
        toast({ title: "Saque minimo de indicacoes invalido." });
        setSaving(false);
        return;
      }
      if (Number.isFinite(maxReferralWithdrawValue) && maxReferralWithdrawValue > 0 && maxReferralWithdrawValue < minWithdrawValue) {
        toast({ title: "Saque maximo de indicacoes deve ser maior que o minimo." });
        setSaving(false);
        return;
      }

      const response = await fetch("/api/admin/settings/gateway", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          apiKey,
          minDeposit: minDepositValue,
          minWithdraw: minWithdrawValue,
          maxDeposit: maxDepositValue,
          maxWithdraw: maxWithdrawValue,
          minReferralWithdraw: minReferralWithdrawValue,
          maxReferralWithdraw: maxReferralWithdrawValue,
          cashinFeePercent: cashinFeeValue,
          cashoutFeePercent: cashoutFeeValue,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({ title: data?.message || "Erro ao salvar configuracoes" });
        return;
      }
      toast({ title: "Configuracoes salvas com sucesso." });
      loadAudit();
    } catch {
      toast({ title: "Erro ao salvar configuracoes" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configuracoes Admin</h1>
            <p className="text-muted-foreground">Gateway, taxas e parametros da plataforma</p>
          </div>
        </motion.div>

        <div className="stat-card">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Gateway de Pagamentos</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure a chave do provedor para liberar a geracao de cobrancas e saques.
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key Valorion Pay</label>
                <Input
                  type="text"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Informe a API Key da Valorion Pay"
                  className="bg-secondary/50"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Deposito e Saque</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Defina limites minimos que o usuario deve respeitar para operacoes no wallet.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Deposito minimo (R$)</label>
                  <Input
                    type="text"
                    value={minDeposit}
                    onChange={(event) => setMinDeposit(event.target.value)}
                    placeholder="Ex: 50"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Saque minimo (R$)</label>
                  <Input
                    type="text"
                    value={minWithdraw}
                    onChange={(event) => setMinWithdraw(event.target.value)}
                    placeholder="Ex: 50"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Deposito maximo (R$)</label>
                  <Input
                    type="text"
                    value={maxDeposit}
                    onChange={(event) => setMaxDeposit(event.target.value)}
                    placeholder="0 = sem limite"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Saque maximo (R$)</label>
                  <Input
                    type="text"
                    value={maxWithdraw}
                    onChange={(event) => setMaxWithdraw(event.target.value)}
                    placeholder="0 = sem limite"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Saque minimo (Indicacoes) (R$)</label>
                  <Input
                    type="text"
                    value={minReferralWithdraw}
                    onChange={(event) => setMinReferralWithdraw(event.target.value)}
                    placeholder="Ex: 50"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Saque maximo (Indicacoes) (R$)</label>
                  <Input
                    type="text"
                    value={maxReferralWithdraw}
                    onChange={(event) => setMaxReferralWithdraw(event.target.value)}
                    placeholder="0 = sem limite"
                    className="bg-secondary/50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Taxas operacionais</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Percentuais aplicados no cash-in e cash-out. Use 0 para isentar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Taxa cash-in (%)</label>
                <Input
                  type="text"
                  value={cashinFeePercent}
                  onChange={(event) => setCashinFeePercent(event.target.value)}
                  placeholder="Ex: 1.5"
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Taxa cash-out (%)</label>
                <Input
                  type="text"
                  value={cashoutFeePercent}
                  onChange={(event) => setCashoutFeePercent(event.target.value)}
                  placeholder="Ex: 2.0"
                  className="bg-secondary/50"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar configuracoes"}
          </Button>
        </div>

        <div className="stat-card">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Historico de alteracoes</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Acao</TableHead>
                  <TableHead>Responsavel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      Carregando historico...
                    </TableCell>
                  </TableRow>
                ) : auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{log.actorName || "-"}</span>
                          <span className="text-xs text-muted-foreground">{log.actorEmail || ""}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
