import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { ArrowUpDown, ArrowDownLeft, ArrowUpRight, Copy, Check, QrCode, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/hooks/useCryptoData";
import { useAuth } from "@/auth/AuthContext";
import QRCode from "qrcode";

const cryptoOptions = [
  { id: "btc", name: "Bitcoin", symbol: "BTC", balance: 0.015 },
  { id: "eth", name: "Ethereum", symbol: "ETH", balance: 0.5 },
  { id: "sol", name: "Solana", symbol: "SOL", balance: 10 },
];

export default function Wallet() {
  const [copied, setCopied] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixCopy, setPixCopy] = useState("");
  const [cashinStatus, setCashinStatus] = useState<string | null>(null);
  const [cashoutStatus, setCashoutStatus] = useState<string | null>(null);
  const [saldoLiquido, setSaldoLiquido] = useState<number | null>(null);
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixQrDataUrl, setPixQrDataUrl] = useState<string | null>(null);
  const [pixExpiresAt, setPixExpiresAt] = useState<string | null>(null);
  const [pixTimeLeft, setPixTimeLeft] = useState<string | null>(null);
  const [pixPromoEndsAt, setPixPromoEndsAt] = useState<string | null>(null);
  const [pixPromoTimeLeft, setPixPromoTimeLeft] = useState<string | null>(null);
  const [cashoutPixKey, setCashoutPixKey] = useState("");
  const [cashoutPixType, setCashoutPixType] = useState("CPF");
  const [cashoutName, setCashoutName] = useState("");
  const [cashoutDocument, setCashoutDocument] = useState("");
  const [minDeposit, setMinDeposit] = useState(50);
  const [minWithdraw, setMinWithdraw] = useState(50);
  const { token, user } = useAuth();

  const isLikelyPngBase64 = (value: string) => value.startsWith("iVBORw0");
  const decodeBase64 = (value: string) => {
    try {
      return atob(value);
    } catch {
      return "";
    }
  };

  const formatRemaining = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/balance", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const saldo = Number(data?.saldoDisponivel || 0);
        setSaldoLiquido(saldo);
      })
      .catch(() => {
        setSaldoLiquido(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/settings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Number.isFinite(Number(data?.minDeposit))) {
          setMinDeposit(Number(data.minDeposit));
        }
        if (Number.isFinite(Number(data?.minWithdraw))) {
          setMinWithdraw(Number(data.minWithdraw));
        }
      })
      .catch(() => {
        setMinDeposit(50);
        setMinWithdraw(50);
      });
  }, [token]);

  useEffect(() => {
    if (!pixExpiresAt) {
      setPixTimeLeft(null);
      return undefined;
    }

    const update = () => {
      const diff = new Date(pixExpiresAt).getTime() - Date.now();
      setPixTimeLeft(formatRemaining(diff));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [pixExpiresAt]);

  useEffect(() => {
    if (!pixPromoEndsAt) {
      setPixPromoTimeLeft(null);
      return undefined;
    }

    const update = () => {
      const diff = new Date(pixPromoEndsAt).getTime() - Date.now();
      setPixPromoTimeLeft(formatRemaining(diff));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [pixPromoEndsAt]);

  useEffect(() => {
    let active = true;

    const buildQr = async () => {
      const raw = String(pixQrBase64 || "").trim();
      if (raw.startsWith("data:image/")) {
        if (active) setPixQrDataUrl(raw);
        return;
      }
      if (raw && isLikelyPngBase64(raw)) {
        if (active) setPixQrDataUrl(`data:image/png;base64,${raw}`);
        return;
      }

      const decoded = raw ? decodeBase64(raw) : "";
      const payload = decoded && decoded.startsWith("000201") ? decoded : pixCopy;
      if (!payload) {
        if (active) setPixQrDataUrl(null);
        return;
      }

      const dataUrl = await QRCode.toDataURL(payload, { width: 220, margin: 1 });
      if (active) setPixQrDataUrl(dataUrl);
    };

    buildQr().catch(() => {
      if (active) setPixQrDataUrl(null);
    });

    return () => {
      active = false;
    };
  }, [pixCopy, pixQrBase64]);

  const handleCashin = async () => {
    if (!token) return;
    setCashinStatus(null);
    setPixQrDataUrl(null);
    setPixExpiresAt(null);
    setPixTimeLeft(null);
    setPixPromoEndsAt(null);
    setPixPromoTimeLeft(null);

    const amount = Number(String(depositAmount).replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!amount || amount <= 0) {
      setCashinStatus("Informe um valor valido.");
      return;
    }
    if (amount < minDeposit) {
      setCashinStatus(`Deposito minimo: ${formatCurrency(minDeposit)}`);
      return;
    }

    const cpf = String(user?.cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11) {
      setCashinStatus("CPF nao cadastrado ou invalido.");
      return;
    }

    const response = await fetch("/api/valorion/cashin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount,
        customer: {
          name: user?.name || "Cliente",
          email: user?.email || "cliente@email.com",
          cpf,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCashinStatus(data?.message || "Erro ao gerar PIX");
      return;
    }

    setPixCopy(data?.paymentCode || "");
    setPixQrBase64(data?.paymentCodeBase64 || null);
    setPixExpiresAt(data?.expiresAt || null);
    setPixPromoEndsAt(new Date(Date.now() + 30 * 60 * 1000).toISOString());
    setCashinStatus("Pix gerado. Copie o codigo para pagamento.");
  };

  const handleCashout = async () => {
    if (!token) return;
    setCashoutStatus(null);
    const amount = Number(String(withdrawAmount).replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!amount || amount <= 0) {
      setCashoutStatus("Informe um valor valido.");
      return;
    }
    if (amount < minWithdraw) {
      setCashoutStatus(`Saque minimo: ${formatCurrency(minWithdraw)}`);
      return;
    }

    const response = await fetch("/api/valorion/cashout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount,
        pixKey: cashoutPixKey,
        pixType: cashoutPixType,
        beneficiaryName: cashoutName,
        beneficiaryDocument: cashoutDocument,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCashoutStatus(data?.message || "Erro ao solicitar saque");
      return;
    }

    setCashoutStatus("Saque solicitado com sucesso.");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <ArrowUpDown className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Carteira</h1>
            <p className="text-muted-foreground">Gerencie seus depósitos e saques</p>
          </div>
        </motion.div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <p className="text-sm text-muted-foreground mb-1">Saldo em Reais</p>
              <p className="text-2xl font-bold">
                {saldoLiquido !== null ? formatCurrency(saldoLiquido) : "--"}
              </p>
              <p className="text-xs text-success mt-1">Disponível para saque</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <p className="text-sm text-muted-foreground mb-1">Em Criptomoedas</p>
              <p className="text-2xl font-bold">R$ 33.542,50</p>
              <p className="text-xs text-muted-foreground mt-1">5 ativos</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="stat-card"
          >
            <div className="relative z-10">
              <p className="text-sm text-muted-foreground mb-1">Saldo Total</p>
              <p className="text-2xl font-bold gradient-text">R$ 45.892,50</p>
              <p className="text-xs text-success mt-1">+5.37% este mês</p>
            </div>
          </motion.div>
        </div>

        {/* Deposit/Withdraw Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <Tabs defaultValue="deposit" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6">
                <TabsTrigger 
                  value="deposit" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  Depositar
                </TabsTrigger>
                <TabsTrigger 
                  value="withdraw"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Sacar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="deposit" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                  {/* PIX Deposit */}
                  <div className="p-6 rounded-xl border border-border/50 bg-secondary/20">
                    <div className="flex items-center gap-3 mb-4">
                      <QrCode className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Depósito via PIX</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="aspect-square max-w-[200px] mx-auto bg-white rounded-xl p-4 flex items-center justify-center">
                        {pixQrDataUrl ? (
                          <img src={pixQrDataUrl} alt="QR Code PIX" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                            <QrCode className="h-24 w-24 text-primary" />
                          </div>
                        )}
                      </div>

                      {pixPromoTimeLeft && (
                        <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-center">
                          <p className="text-xs text-primary">Bonificacao ativa por</p>
                          <p className="text-lg font-semibold text-primary">{pixPromoTimeLeft}</p>
                        </div>
                      )}

                      {pixTimeLeft && (
                        <p className="text-xs text-muted-foreground text-center">
                          Expira em {pixTimeLeft}
                        </p>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Codigo PIX (copia e cola)</p>
                        <div className="flex gap-2">
                          <Input value={pixCopy} readOnly className="bg-secondary/50 text-sm" />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={handleCopy}
                            className="shrink-0"
                          >
                            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Valor do deposito</label>
                        <Input
                          type="text"
                          placeholder="R$ 0,00"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="text-lg bg-secondary/50"
                        />
                        <Button className="w-full gap-2" onClick={handleCashin}>
                          <ArrowDownLeft className="h-4 w-4" />
                          Gerar PIX
                        </Button>
                        {cashinStatus && <p className="text-xs text-muted-foreground">{cashinStatus}</p>}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>• Depósito mínimo: {formatCurrency(minDeposit)}</p>
                        <p>• Processamento: Instantâneo</p>
                        <p>• Taxa: Grátis</p>
                      </div>
                    </div>
                  </div>

                </div>
              </TabsContent>

              <TabsContent value="withdraw" className="space-y-6">
                <div className="max-w-md mx-auto space-y-6">
                  <div className="text-center p-4 rounded-xl bg-secondary/30">
                    <p className="text-sm text-muted-foreground mb-1">Saldo disponível</p>
                    <p className="text-3xl font-bold">
                      {saldoLiquido !== null ? formatCurrency(saldoLiquido) : "--"}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Valor do saque</label>
                      <Input
                        type="text"
                        placeholder="R$ 0,00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="text-lg bg-secondary/50"
                      />
                    </div>

                    <div className="flex gap-2">
                      {[100, 500, 1000, 5000].map((value) => (
                        <Button
                          key={value}
                          variant="outline"
                          size="sm"
                          onClick={() => setWithdrawAmount(formatCurrency(value))}
                          className="flex-1"
                        >
                          {formatCurrency(value)}
                        </Button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Chave PIX de destino</label>
                      <Input
                        type="text"
                        placeholder="CPF, E-mail, Telefone ou Chave aleatória"
                        className="bg-secondary/50"
                        value={cashoutPixKey}
                        onChange={(e) => setCashoutPixKey(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tipo de chave</label>
                        <Input
                          type="text"
                          placeholder="CPF | CNPJ | EMAIL | PHONE | RANDOM"
                          className="bg-secondary/50"
                          value={cashoutPixType}
                          onChange={(e) => setCashoutPixType(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Documento</label>
                        <Input
                          type="text"
                          placeholder="CPF/CNPJ"
                          className="bg-secondary/50"
                          value={cashoutDocument}
                          onChange={(e) => setCashoutDocument(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nome do favorecido</label>
                      <Input
                        type="text"
                        placeholder="Nome completo"
                        className="bg-secondary/50"
                        value={cashoutName}
                        onChange={(e) => setCashoutName(e.target.value)}
                      />
                    </div>

                    <Button className="w-full gap-2" size="lg" onClick={handleCashout}>
                      <ArrowUpRight className="h-4 w-4" />
                      Solicitar Saque
                    </Button>
                    {cashoutStatus && <p className="text-xs text-muted-foreground text-center">{cashoutStatus}</p>}

                    <div className="text-xs text-muted-foreground text-center space-y-1">
                      <p>• Saque mínimo: {formatCurrency(minWithdraw)}</p>
                      <p>• Processamento: Até 24 horas</p>
                      <p>• Taxa: R$ 2,50</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>

        {/* Crypto Holdings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Suas Criptomoedas</h3>
            <div className="space-y-2">
              {cryptoOptions.map((crypto) => (
                <div 
                  key={crypto.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {crypto.symbol[0]}
                    </div>
                    <div>
                      <p className="font-medium">{crypto.name}</p>
                      <p className="text-sm text-muted-foreground">{crypto.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{crypto.balance} {crypto.symbol}</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Depositar
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Sacar
                      </Button>
                    </div>
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
