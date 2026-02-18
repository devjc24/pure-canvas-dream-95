import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { Users, Link as LinkIcon, Gift, Check, Copy, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { formatCurrency } from "@/hooks/useCryptoData";

export default function Referrals() {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    totalBalance: 0,
    availableBalance: 0,
    commissionPercent: 10,
    minDeposit: 50,
    minWithdraw: 50,
    maxWithdraw: 0,
  });
  const [referrals, setReferrals] = useState<
    Array<{ id: number; name: string; createdAt: string; reward: number; status: string }>
  >([]);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    pixType: "",
    pixKey: "",
  });
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const { token } = useAuth();

  const referralLink = useMemo(() => {
    return referralCode ? `https://crypto.devjc.fun/r/${referralCode}` : "";
  }, [referralCode]);

  useEffect(() => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/me", { headers }).then((res) => res.json()),
      fetch("/api/referrals/summary", { headers }).then((res) => res.json()),
      fetch("/api/referrals/list", { headers }).then((res) => res.json()),
      fetch("/api/profile/bank", { headers }).then((res) => res.json()),
    ])
      .then(([me, summaryData, listData, bankData]) => {
        setReferralCode(me?.user?.referral_code || null);
        setSummary({
          total: summaryData?.total || 0,
          active: summaryData?.active || 0,
          totalBalance: summaryData?.totalBalance || 0,
          availableBalance: summaryData?.availableBalance || summaryData?.totalBalance || 0,
          commissionPercent: summaryData?.commissionPercent || 10,
          minDeposit: summaryData?.minDeposit || 50,
          minWithdraw: summaryData?.minReferralWithdraw || 50,
          maxWithdraw: summaryData?.maxReferralWithdraw || 0,
        });
        setReferrals(listData?.referrals || []);
        const bank = bankData?.data || {};
        setWithdrawForm((prev) => ({
          ...prev,
          pixType: bank.pix_key_type || prev.pixType,
          pixKey: bank.pix_key || prev.pixKey,
        }));
      })
      .catch(() => {
        setReferralCode(null);
      });
  }, [token]);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = async () => {
    if (!token) return;
    setWithdrawError(null);
    setWithdrawSuccess(null);

    const amountValue = Number(String(withdrawForm.amount).replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setWithdrawError("Informe um valor valido");
      return;
    }
    if (!withdrawForm.pixType || !withdrawForm.pixKey) {
      setWithdrawError("Informe a chave Pix");
      return;
    }

    setWithdrawBusy(true);
    try {
      const response = await fetch("/api/referrals/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountValue,
          pixType: withdrawForm.pixType,
          pixKey: withdrawForm.pixKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Erro ao solicitar saque");
      }

      setWithdrawSuccess("Saque solicitado com sucesso");
      setWithdrawForm((prev) => ({ ...prev, amount: "" }));
      setSummary((prev) => ({
        ...prev,
        totalBalance: Math.max(0, prev.totalBalance - amountValue),
        availableBalance: Math.max(0, prev.availableBalance - amountValue),
      }));
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : "Erro ao solicitar saque");
    } finally {
      setWithdrawBusy(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
            <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-foreground">Indicações</h1>
            <p className="text-muted-foreground">Convide amigos e ganhe recompensas</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Indicações", value: `${summary.total}`, icon: UserPlus, color: "text-primary" },
            { label: "Ativas", value: `${summary.active}`, icon: Check, color: "text-success" },
            { label: "Saldo de indicações", value: formatCurrency(summary.totalBalance), icon: Gift, color: "text-accent" },
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

        {/* Referral Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Seu link de indicação</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={referralLink} readOnly className="bg-secondary/50 w-full" />
              <Button variant="outline" onClick={handleCopy} className="shrink-0 w-full sm:w-auto">
                {copied ? (
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    Copiado
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Copiar
                  </span>
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                • Ganhe {summary.commissionPercent}% do primeiro deposito (minimo {formatCurrency(summary.minDeposit)}).
              </p>
              <p>• Seu indicado também recebe um bonus de boas-vindas.</p>
            </div>
          </div>
        </motion.div>

        {/* Referral Wallet */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="stat-card"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Carteira de indicações</h3>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Disponível para saque</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.availableBalance)}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Saque minimo: {formatCurrency(summary.minWithdraw)}.</p>
                <p>
                  {summary.maxWithdraw > 0
                    ? `Saque maximo: ${formatCurrency(summary.maxWithdraw)}.`
                    : "Saque maximo: sem limite."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor do saque</label>
                <Input
                  placeholder="R$ 0,00"
                  className="bg-secondary/50"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de chave Pix</label>
                <Select
                  value={withdrawForm.pixType || undefined}
                  onValueChange={(value) => setWithdrawForm((prev) => ({ ...prev, pixType: value }))}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Telefone">Telefone</SelectItem>
                    <SelectItem value="Aleatoria">Aleatoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Chave Pix</label>
                <Input
                  placeholder="Sua chave Pix"
                  className="bg-secondary/50"
                  value={withdrawForm.pixKey}
                  onChange={(e) => setWithdrawForm((prev) => ({ ...prev, pixKey: e.target.value }))}
                />
              </div>
            </div>
            {withdrawError && <p className="text-sm text-destructive">{withdrawError}</p>}
            {withdrawSuccess && <p className="text-sm text-success">{withdrawSuccess}</p>}
            <Button onClick={handleWithdraw} disabled={withdrawBusy}>
              {withdrawBusy ? "Processando..." : "Solicitar saque"}
            </Button>
          </div>
        </motion.div>

        {/* Referral List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Suas indicações</h3>
            <div className="space-y-3">
              {referrals.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhuma indicacao ainda.</div>
              )}
              {referrals.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-lg bg-secondary/30"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Indicado em {new Date(item.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm font-medium">{formatCurrency(item.reward)}</p>
                    <p className={`text-xs ${item.status === "Ativo" ? "text-success" : "text-muted-foreground"}`}>
                      {item.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}
