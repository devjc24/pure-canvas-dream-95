import { useEffect, useState } from "react";
import { Bot, Sparkles, CheckCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  cryptoSymbol?: string | null;
  cryptoIconUrl?: string | null;
  currentPrice?: number;
  expectedGainPct?: number;
  createdAt: string;
  isRead: boolean;
};

export function NotificationCenter() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState<NotificationItem | null>(null);

  const loadUnread = () => {
    if (!token) return;
    fetch("/api/notifications/unread-count", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setUnread(Number(data?.unread || 0));
      })
      .catch(() => {
        setUnread(0);
      });
  };

  const loadNotifications = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/notifications?limit=20&auto=1", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setItems(data?.notifications || []);
        loadUnread();
      })
      .catch(() => {
        setItems([]);
        toast({ title: "Falha ao carregar notificacoes" });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    fetch("/api/notifications/auto", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(() => {
        loadUnread();
      })
      .catch(() => {
        loadUnread();
      });
  }, [token]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  useEffect(() => {
    if (!token || unread <= 0) {
      setLatest(null);
      return;
    }
    fetch("/api/notifications?limit=1&auto=1", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const first = data?.notifications?.[0] || null;
        setLatest(first);
      })
      .catch(() => {
        setLatest(null);
      });
  }, [token, unread]);

  const markAsRead = (id: number) => {
    if (!token) return;
    fetch(`/api/notifications/${id}/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(() => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
        loadUnread();
      })
      .catch(() => {
        toast({ title: "Falha ao marcar notificacao" });
      });
  };

  const markAllRead = () => {
    if (!token) return;
    fetch("/api/notifications/read-all", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(() => {
        setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnread(0);
      })
      .catch(() => {
        toast({ title: "Falha ao marcar todas" });
      });
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        {unread > 0 ? (
          <div className="absolute -left-40 bottom-2 flex items-center">
            <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-secondary px-3 py-1 text-xs font-semibold text-foreground shadow">
              {latest?.cryptoIconUrl ? (
                <img
                  src={latest.cryptoIconUrl}
                  alt={latest.cryptoSymbol || latest.title}
                  className="h-4 w-4 rounded-full"
                />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              <span>{latest?.title || "Nova oportunidade"}</span>
            </div>
            <div className="h-0 w-0 border-y-8 border-y-transparent border-l-8 border-l-secondary" />
          </div>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          className={cn(
            "relative h-14 w-14 rounded-full shadow-lg transition",
            unread > 0
              ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(59,130,246,0.45)]"
              : "bg-background",
          )}
          title="CoinX IA - Centro de notificacoes"
          aria-label="CoinX IA - Centro de notificacoes"
        >
          <Bot className="h-8 w-8" />
          {unread > 0 ? (
            <span className="absolute -top-2 -right-2 h-6 min-w-[1.5rem] rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
        <div className="mt-2 text-center text-[11px] font-semibold text-muted-foreground">CoinX IA</div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              CoinX IA - Centro de notificacoes
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Oportunidades e alertas do CoinX IA</p>
            <Button variant="ghost" size="sm" className="gap-2" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" />
              Marcar todas
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando notificacoes...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma notificacao no momento.</div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markAsRead(item.id)}
                  className={cn(
                    "w-full rounded-xl border border-border/60 p-4 text-left transition",
                    item.isRead ? "bg-background" : "bg-secondary/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.cryptoIconUrl ? (
                        <img
                          src={item.cryptoIconUrl}
                          alt={item.cryptoSymbol || item.title}
                          className="h-6 w-6 rounded-full"
                        />
                      ) : null}
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    </div>
                    {!item.isRead ? (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {item.cryptoSymbol ? <span>{item.cryptoSymbol}</span> : null}
                    {item.currentPrice ? <span>R$ {item.currentPrice.toFixed(2)}</span> : null}
                    {item.expectedGainPct ? <span>Alvo {item.expectedGainPct}%</span> : null}
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
