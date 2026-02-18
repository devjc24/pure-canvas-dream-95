import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, type CryptoData } from "@/hooks/useCryptoData";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert } from "@/components/ui/alert";

type TradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crypto: CryptoData | null;
};

export function TradeModal({ open, onOpenChange, crypto }: TradeModalProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [tradeAmount, setTradeAmount] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [buyValue, setBuyValue] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<string | null>(null);
  const [tradeMsg, setTradeMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasProcessing, setHasProcessing] = useState(false);
  const [alreadyProfited, setAlreadyProfited] = useState(false);

  useEffect(() => {
    if (!open) {
      setTradeAmount("");
      setBalance(null);
      setBalanceLoading(false);
      return;
    }
    if (!token) return;
    setBalanceLoading(true);
    fetch("/api/wallet/balance", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setBalance(Number(data?.saldoDisponivel ?? 0));
      })
      .catch(() => {
        setBalance(null);
      })
      .finally(() => setBalanceLoading(false));
  }, [open, token, crypto?.id]);

  // Busca valor de compra sugerido do backend
  useEffect(() => {
    if (!open || !crypto || !token) {
      setBuyValue(null);
      setTradeStatus(null);
      setTradeMsg(null);
      return;
    }
    setBuyValue(null);
    setTradeStatus(null);
    setTradeMsg(null);
    setProcessing(false);
    setBalanceLoading(true);
    fetch("/api/wallet/balance", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setBalance(Number(data?.saldoDisponivel ?? 0));
        // Calcula valor de compra (6.3% a 10%) igual backend
        const saldo = Number(data?.saldoDisponivel ?? 0);
        if (saldo > 0) {
          const perc = Math.random() * (10 - 6.3) + 6.3;
          let val = Number((saldo * (perc / 100)).toFixed(2));
          if (val < 1) val = saldo;
          if (val > saldo) val = saldo;
          setBuyValue(val);
        } else {
          setBuyValue(null);
        }
      })
      .catch(() => {
        setBalance(null);
        setBuyValue(null);
      })
      .finally(() => setBalanceLoading(false));
  }, [open, token, crypto?.id]);

  // Checa se há trade em processamento ao abrir o modal
  useEffect(() => {
    if (!open || !token) {
      setHasProcessing(false);
      setAlreadyProfited(false);
      return;
    }
    fetch("/api/trade/processing", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setHasProcessing(!!data?.processing);
      })
      .catch(() => setHasProcessing(false));
  }, [open, token]);

  const handleTrade = async () => {
    if (!crypto || !token || !buyValue || buyValue > (balance ?? 0)) return;
    setProcessing(true);
    setTradeStatus(null);
    setTradeMsg(null);
    onOpenChange(false); // Fecha o modal imediatamente ao iniciar a compra
    try {
      const res = await fetch("/api/trade/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ crypto_symbol: crypto.symbol }),
      });
      const data = await res.json();
      if (res.status === 400 && data.message?.includes("lucro neste sinal")) {
        setAlreadyProfited(true);
        toast({ title: "Limite de lucro atingido", description: data.message, variant: "destructive" });
        return;
      }
      if (data.status === "processando") {
        setTradeStatus("processando");
        setTradeMsg("Sua compra está em processamento! O lucro será creditado automaticamente em até 5 minutos.");
        toast({ title: "Compra em processamento", description: "Sua compra está sendo processada. Aguarde o crédito do lucro.", variant: "default" });
      } else if (data.status === "perda") {
        setTradeStatus("perda");
        setTradeMsg("Compra fora do sinal. O valor foi descontado do seu saldo.");
        toast({ title: "Compra fora do sinal", description: "Você comprou fora do período do sinal. O valor foi descontado.", variant: "destructive" });
      } else {
        setTradeStatus("erro");
        setTradeMsg(data.message || "Erro ao negociar");
        toast({ title: "Erro ao negociar", description: data.message || "Erro ao negociar", variant: "destructive" });
      }
    } catch (e) {
      setTradeStatus("erro");
      setTradeMsg("Erro ao negociar");
      toast({ title: "Erro ao negociar", description: "Erro ao negociar", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen);
          if (!nextOpen) {
            setTradeAmount("");
            setBalance(null);
            setBuyValue(null);
            setTradeStatus(null);
            setTradeMsg(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Negociar</DialogTitle>
          </DialogHeader>
          {hasProcessing && (
            <Alert className="mb-2 bg-yellow-50 border-yellow-400 text-yellow-900">
              Você já possui uma negociação em processamento. Aguarde a finalização para negociar novamente.
            </Alert>
          )}
          {alreadyProfited && (
            <Alert className="mb-2 bg-red-50 border-red-400 text-red-900">
              Você já obteve lucro neste sinal. Só poderá lucrar novamente no próximo sinal.
            </Alert>
          )}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {crypto?.image ? (
                <img
                  src={crypto.image}
                  alt={crypto.name}
                  className="h-10 w-10 rounded-full"
                />
              ) : null}
              <div>
                <p className="text-sm text-muted-foreground">Criptomoeda</p>
                <p className="text-base font-semibold">{crypto?.name || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor atual</p>
              <p className="text-base font-semibold">
                {crypto ? formatCurrency(crypto.current_price) : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo atual</p>
              <p className="text-base font-semibold">
                {balanceLoading ? "Carregando..." : balance !== null ? formatCurrency(balance) : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor da compra</p>
              <p className="text-base font-semibold">
                {buyValue !== null ? formatCurrency(buyValue) : "-"}
              </p>
            </div>
            {tradeStatus === "processando" && (
              <div className="text-yellow-600 text-sm font-semibold flex items-center gap-2">
                <span>⏳</span> {tradeMsg}
              </div>
            )}
            {tradeStatus === "perda" && (
              <div className="text-red-600 text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span> {tradeMsg}
              </div>
            )}
            {tradeStatus === "erro" && (
              <div className="text-red-600 text-sm font-semibold flex items-center gap-2">
                <span>❌</span> {tradeMsg}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
              Cancelar
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button onClick={() => setConfirmOpen(true)} disabled={processing || !buyValue || buyValue > (balance ?? 0) || hasProcessing || alreadyProfited}>
                      {processing ? "Processando..." : hasProcessing ? "Aguardando processamento" : alreadyProfited ? "Aguardando próximo sinal" : "Negociar"}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {hasProcessing
                    ? "Você já possui uma negociação em processamento. Aguarde a finalização."
                    : alreadyProfited
                    ? "Você já obteve lucro neste sinal. Aguarde o próximo sinal."
                    : "Negociar esta moeda agora"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja confirmar a compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a negociar {crypto?.name} no valor de {buyValue !== null ? formatCurrency(buyValue) : "-"}. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                handleTrade();
              }}
              disabled={hasProcessing}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
