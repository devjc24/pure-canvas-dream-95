import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { Bell, Plus, Send, Trash2, Zap } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ScheduleRow = {
  id: number;
  title: string;
  message: string;
  cryptoSymbol?: string | null;
  expectedGainPct?: number | null;
  currentPrice?: number | null;
  startAt: string;
  endAt?: string | null;
  intervalMinutes: number;
  lastSentAt?: string | null;
  active: boolean;
};

type SinalRow = {
  id: number;
  cryptoSymbol: string;
  horarioInicio: string;
  horarioFim: string;
  lucroPercentual: number;
  criadoEm: string;
};

export default function AdminNotifications() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalItems, setSignalItems] = useState<SinalRow[]>([]);
  const [signalSaving, setSignalSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [cryptoSymbol, setCryptoSymbol] = useState("");
  const [expectedGainPct, setExpectedGainPct] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("1440");
  const [active, setActive] = useState(true);

  const [signalSymbol, setSignalSymbol] = useState("");
  const [signalStartAt, setSignalStartAt] = useState("");
  const [signalEndAt, setSignalEndAt] = useState("");
  const [signalLucro, setSignalLucro] = useState("");

  const loadSchedules = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/notifications/schedules", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setItems(data?.schedules || []);
      })
      .catch(() => {
        setItems([]);
        toast({ title: "Falha ao carregar notificacoes" });
      })
      .finally(() => setLoading(false));
  };

  const loadSignals = () => {
    if (!token) return;
    setSignalLoading(true);
    fetch("/api/admin/sinais?limit=10", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setSignalItems(data?.sinais || []);
      })
      .catch(() => {
        setSignalItems([]);
        toast({ title: "Falha ao carregar sinais" });
      })
      .finally(() => setSignalLoading(false));
  };

  useEffect(() => {
    loadSchedules();
    loadSignals();
  }, [token]);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setCryptoSymbol("");
    setExpectedGainPct("");
    setCurrentPrice("");
    setStartAt("");
    setEndAt("");
    setIntervalMinutes("1440");
    setActive(true);
  };

  const resetSignalForm = () => {
    setSignalSymbol("");
    setSignalStartAt("");
    setSignalEndAt("");
    setSignalLucro("");
  };

  const handleCreate = () => {
    if (!token) return;
    if (!title.trim() || !message.trim() || !startAt) {
      toast({ title: "Preencha titulo, mensagem e inicio" });
      return;
    }
    setSaving(true);
    fetch("/api/admin/notifications/schedules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: title.trim(),
        message: message.trim(),
        cryptoSymbol: cryptoSymbol.trim() || null,
        expectedGainPct: expectedGainPct ? Number(expectedGainPct) : null,
        currentPrice: currentPrice ? Number(currentPrice) : null,
        startAt,
        endAt: endAt || null,
        intervalMinutes: Number(intervalMinutes) || 1440,
        active,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Falha ao salvar");
        }
        toast({ title: "Notificacao agendada" });
        setCreateOpen(false);
        resetForm();
        loadSchedules();
      })
      .catch(() => {
        toast({ title: "Falha ao salvar notificacao" });
      })
      .finally(() => setSaving(false));
  };

  const toggleActive = (schedule: ScheduleRow) => {
    if (!token) return;
    fetch(`/api/admin/notifications/schedules/${schedule.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ active: !schedule.active }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao atualizar");
        setItems((prev) =>
          prev.map((item) => (item.id === schedule.id ? { ...item, active: !item.active } : item)),
        );
      })
      .catch(() => {
        toast({ title: "Falha ao atualizar" });
      });
  };

  const sendNow = (scheduleId: number) => {
    if (!token) return;
    fetch(`/api/admin/notifications/schedules/${scheduleId}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao enviar");
        toast({ title: "Notificacao enviada" });
        loadSchedules();
      })
      .catch(() => {
        toast({ title: "Falha ao enviar notificacao" });
      });
  };

  const removeSchedule = (scheduleId: number) => {
    if (!token) return;
    fetch(`/api/admin/notifications/schedules/${scheduleId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao remover");
        toast({ title: "Notificacao removida" });
        loadSchedules();
      })
      .catch(() => {
        toast({ title: "Falha ao remover" });
      });
  };

  const createSignal = () => {
    if (!token) return;
    if (!signalSymbol.trim() || !signalStartAt || !signalEndAt || !signalLucro) {
      toast({ title: "Preencha moeda, inicio, fim e lucro" });
      return;
    }
    setSignalSaving(true);
    fetch("/api/admin/sinais", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cryptoSymbol: signalSymbol.trim(),
        horarioInicio: signalStartAt,
        horarioFim: signalEndAt,
        lucroPercentual: Number(signalLucro),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao criar sinal");
        toast({ title: "Sinal criado e notificado" });
        resetSignalForm();
        loadSignals();
      })
      .catch(() => {
        toast({ title: "Falha ao criar sinal" });
      })
      .finally(() => setSignalSaving(false));
  };

  const generateSignalNow = () => {
    if (!token) return;
    setSignalSaving(true);
    fetch("/api/admin/sinais/gerar-agora", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao gerar sinal");
        toast({ title: "Sinal gerado e notificado" });
        loadSignals();
      })
      .catch(() => {
        toast({ title: "Falha ao gerar sinal" });
      })
      .finally(() => setSignalSaving(false));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Notificacoes Admin</h1>
              <p className="text-muted-foreground">Agendamento e controle de oportunidades</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova notificacao
          </Button>
        </motion.div>

        <div className="stat-card">
          <div className="relative z-10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ultimo envio</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Carregando notificacoes...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Nenhuma notificacao configurada.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.title}</span>
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {item.message}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>{new Date(item.startAt).toLocaleString()}</span>
                          <span>{item.endAt ? new Date(item.endAt).toLocaleString() : "Sem fim"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.intervalMinutes} min</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={item.active ? "default" : "outline"}
                          onClick={() => toggleActive(item)}
                        >
                          {item.active ? "Ativo" : "Inativo"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.lastSentAt ? new Date(item.lastSentAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => sendNow(item.id)}>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover notificacao?</AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeSchedule(item.id)}>
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="stat-card">
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Sinais da IA</h3>
                <p className="text-sm text-muted-foreground">
                  Crie sinais em horarios especificos ou gere um sinal imediato para simular.
                </p>
              </div>
              <Button onClick={generateSignalNow} variant="outline" className="gap-2" disabled={signalSaving}>
                <Zap className="h-4 w-4" />
                Gerar sinal agora
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Moeda (simbolo)</label>
                <Input
                  placeholder="BTC"
                  value={signalSymbol}
                  onChange={(event) => setSignalSymbol(event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Inicio</label>
                <Input
                  type="datetime-local"
                  value={signalStartAt}
                  onChange={(event) => setSignalStartAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fim</label>
                <Input
                  type="datetime-local"
                  value={signalEndAt}
                  onChange={(event) => setSignalEndAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Lucro (%)</label>
                <Input
                  placeholder="15"
                  value={signalLucro}
                  onChange={(event) => setSignalLucro(event.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={createSignal} disabled={signalSaving}>
                {signalSaving ? "Salvando..." : "Criar sinal e notificar"}
              </Button>
              <Button variant="outline" onClick={resetSignalForm}>
                Limpar
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Moeda</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Lucro</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signalLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Carregando sinais...
                    </TableCell>
                  </TableRow>
                ) : signalItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Nenhum sinal registrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  signalItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.cryptoSymbol?.toUpperCase()}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>{new Date(item.horarioInicio).toLocaleString()}</span>
                          <span>{new Date(item.horarioFim).toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.lucroPercentual}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.criadoEm).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova notificacao</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Titulo</label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mensagem</label>
                <Input value={message} onChange={(event) => setMessage(event.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cripto (simbolo)</label>
                  <Input
                    placeholder="BTC"
                    value={cryptoSymbol}
                    onChange={(event) => setCryptoSymbol(event.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lucro esperado (%)</label>
                  <Input
                    placeholder="8"
                    value={expectedGainPct}
                    onChange={(event) => setExpectedGainPct(event.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preco atual (R$)</label>
                  <Input
                    placeholder="0"
                    value={currentPrice}
                    onChange={(event) => setCurrentPrice(event.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Intervalo (min)</label>
                  <Input
                    placeholder="1440"
                    value={intervalMinutes}
                    onChange={(event) => setIntervalMinutes(event.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Inicio</label>
                  <Input
                    type="datetime-local"
                    value={startAt}
                    onChange={(event) => setStartAt(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fim (opcional)</label>
                  <Input
                    type="datetime-local"
                    value={endAt}
                    onChange={(event) => setEndAt(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  id="notif-active"
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                />
                <label htmlFor="notif-active">Ativo</label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
