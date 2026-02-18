import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Shield,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Eye,
  FileText,
  Users,
  
  Target,
  AlertTriangle,
  Star,
  Check,
  X,
  MessageCircle,
  Smartphone,
  Lock,
} from "lucide-react";

import type { Easing } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as Easing },
  }),
};

export default function Landing() {
  const navigate = useNavigate();

  const goRegister = () => navigate("/register");
  const goLogin = () => navigate("/login");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-xl font-extrabold tracking-tight">
            <span className="text-primary">Trade</span> Nest Spot
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goLogin}>
              Entrar
            </Button>
            <Button size="sm" onClick={goRegister}>
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative py-20 sm:py-32 px-4">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center space-y-8">
          <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
            <Badge variant="secondary" className="mb-4 text-xs px-3 py-1">
              <Zap className="h-3 w-3 mr-1" /> Sinais gerados por inteligência artificial
            </Badge>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            custom={1}
            variants={fadeUp}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight"
          >
            Pare de operar no impulso.{" "}
            <span className="gradient-text">Opere com processo.</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Sinais de cripto com IA, gestão de risco integrada e alertas em tempo real.
            Sem promessas de lucro — apenas método, disciplina e transparência total.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button size="lg" className="gap-2 text-base glow-effect" onClick={goRegister}>
              Começar grátis <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 text-base" onClick={goLogin}>
              <Eye className="h-4 w-4" /> Ver demonstração
            </Button>
          </motion.div>

          <motion.p
            initial="hidden"
            animate="visible"
            custom={4}
            variants={fadeUp}
            className="text-sm text-muted-foreground"
          >
            <button onClick={goRegister} className="underline underline-offset-4 hover:text-primary transition-colors">
              Quero receber sinais
            </button>{" "}
            ·{" "}
            <button onClick={goRegister} className="underline underline-offset-4 hover:text-primary transition-colors">
              Entrar na comunidade
            </button>
          </motion.p>
        </div>

        {/* Credibility strip */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={5}
          variants={fadeUp}
          className="mx-auto max-w-4xl mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { icon: Bell, label: "Alertas em tempo real" },
            { icon: FileText, label: "Relatórios detalhados" },
            { icon: Shield, label: "Gestão de risco" },
            { icon: MessageCircle, label: "Suporte dedicado" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 justify-center rounded-lg border border-border/50 bg-card/50 px-3 py-3 text-sm text-muted-foreground"
            >
              <Icon className="h-4 w-4 text-primary shrink-0" />
              {label}
            </div>
          ))}
        </motion.div>
      </section>

      <Separator />

      {/* ═══════════════ POR QUE FUNCIONA ═══════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold">Por que isso funciona</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Não é mágica, é método. A combinação de IA + disciplina coloca você no controle.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: "IA + Disciplina",
                desc: "Algoritmos analisam padrões 24/7 para gerar sinais com critérios objetivos — sem emoção, sem achismo.",
              },
              {
                icon: Zap,
                title: "Alertas instantâneos",
                desc: "Receba notificações no momento certo. O timing faz diferença e você não perde oportunidades.",
              },
              {
                icon: CheckCircle2,
                title: "Checklist entrada/saída",
                desc: "Cada sinal vem com ponto de entrada, stop-loss e take-profit definidos. Você sabe o risco antes de entrar.",
              },
              {
                icon: Target,
                title: "Foco em risco/retorno",
                desc: "Operamos com relação risco/retorno controlada. O objetivo é consistência, não aposta.",
              },
              {
                icon: BarChart3,
                title: "Histórico e relatórios",
                desc: "Todos os sinais ficam registrados. Você acompanha o que funcionou e o que não funcionou — transparência total.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                custom={i}
                variants={fadeUp}
              >
                <Card className="h-full border-border/50 bg-card/60 hover:border-primary/30 transition-colors">
                  <CardHeader>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ═══════════════ COMO A IA OPERA ═══════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold">Como a IA de sinais opera</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Transparência: você sabe exatamente como cada sinal é gerado.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Coleta de dados",
                desc: "Preços, volume, orderbook e indicadores de mais de 200 ativos são monitorados continuamente.",
              },
              {
                step: "02",
                title: "Filtros inteligentes",
                desc: "Algoritmos eliminam ruído e cruzam múltiplos indicadores para identificar oportunidades com boa relação risco/retorno.",
              },
              {
                step: "03",
                title: "Geração do sinal",
                desc: "O sinal é criado com entrada, stop-loss, take-profit e score de confiança. Tudo registrado em log.",
              },
              {
                step: "04",
                title: "Alerta para você",
                desc: "Você recebe o sinal em tempo real. Você decide se executa. Você está no controle.",
              },
            ].map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                custom={i}
                variants={fadeUp}
                className="relative"
              >
                <div className="space-y-3">
                  <span className="text-4xl font-black text-primary/20">{step}</span>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 text-primary" />
              Transparência: logs e relatórios de cada sinal
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-4" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              Você decide, você executa
            </div>
          </div>

          <div className="text-center">
            <Button variant="outline" className="gap-2" onClick={goRegister}>
              Ver exemplo de sinal <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      {/* ═══════════════ PROVA SOCIAL ═══════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold">O que nossos usuários dizem</h2>
            <p className="text-muted-foreground">Experiências reais de quem usa a plataforma.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                name: "Lucas M.",
                text: "Antes eu entrava em trades sem plano nenhum. Com o Trade Nest Spot, cada operação tem critérios claros. Mudou minha forma de operar.",
              },
              {
                name: "Ana C.",
                text: "Os alertas são rápidos e os relatórios me ajudam a entender o que deu certo e o que não deu. É a transparência que eu precisava.",
              },
              {
                name: "Rafael T.",
                text: "Não é uma ferramenta de dinheiro fácil — é uma ferramenta de processo. Me ajudou a ter disciplina e controlar risco.",
              },
            ].map(({ name, text }, i) => (
              <motion.div
                key={name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                custom={i}
                variants={fadeUp}
              >
                <Card className="h-full border-border/50 bg-card/60">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground italic">"{text}"</p>
                    <p className="text-sm font-semibold">{name}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* O que você recebe */}
          <div className="mt-12 space-y-6">
            <h3 className="text-2xl font-bold text-center">O que você recebe</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {[
                { icon: TrendingUp, label: "Sinais de compra e venda com IA" },
                { icon: Bell, label: "Alertas em tempo real" },
                { icon: Eye, label: "Watchlist personalizada" },
                { icon: BarChart3, label: "Relatórios de performance" },
                { icon: Smartphone, label: "Notificações push" },
                { icon: Users, label: "Comunidade de traders" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/40"
                >
                  <Icon className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ═══════════════ COMPARATIVO ═══════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold">Antes vs. Depois</h2>
            <p className="text-muted-foreground">
              Sem garantias, mas com método. Veja a diferença.
            </p>
          </div>

          <Card className="border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2">Operar no feeling 😬</TableHead>
                  <TableHead className="w-1/2">Operar com processo + IA 🎯</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Entrar sem stop-loss", "Stop-loss e take-profit definidos"],
                  ["Sem registro das operações", "Histórico e relatórios completos"],
                  ["Emoção guiando decisões", "Critérios objetivos da IA"],
                  ["Descobrir oportunidades tarde", "Alertas em tempo real"],
                  ["Sem controle de risco", "Gestão de risco integrada"],
                  ["Operar sozinho", "Comunidade + suporte"],
                ].map(([before, after], i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-2">
                        <X className="h-4 w-4 text-destructive shrink-0" />
                        {before}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success shrink-0" />
                        {after}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </section>

      <Separator />

      {/* ═══════════════ PLANOS ═══════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold">Escolha seu plano</h2>
            <p className="text-muted-foreground">Comece grátis. Escale quando estiver pronto.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                name: "Starter",
                price: "Grátis",
                desc: "Para quem quer conhecer a plataforma",
                features: ["3 sinais por semana", "Watchlist básica", "Relatório semanal", "Comunidade"],
                highlighted: false,
              },
              {
                name: "Pro",
                price: "R$ 79/mês",
                desc: "Para quem leva trading a sério",
                features: [
                  "Sinais ilimitados",
                  "Alertas em tempo real",
                  "Relatórios completos",
                  "Checklist entrada/saída",
                  "Suporte prioritário",
                ],
                highlighted: true,
              },
              {
                name: "Trader",
                price: "R$ 149/mês",
                desc: "Para profissionais que querem tudo",
                features: [
                  "Tudo do Pro",
                  "API de sinais",
                  "Dashboard avançado",
                  "Análise de portfólio",
                  "Consultoria mensal",
                  "Acesso antecipado a features",
                ],
                highlighted: false,
              },
            ].map(({ name, price, desc, features, highlighted }, i) => (
              <motion.div
                key={name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                custom={i}
                variants={fadeUp}
              >
                <Card
                  className={`h-full flex flex-col ${
                    highlighted
                      ? "border-primary/60 ring-2 ring-primary/20 bg-card"
                      : "border-border/50 bg-card/60"
                  }`}
                >
                  <CardHeader>
                    {highlighted && (
                      <Badge className="w-fit mb-2 bg-primary/10 text-primary border-primary/30">
                        Mais popular
                      </Badge>
                    )}
                    <CardTitle className="text-xl">{name}</CardTitle>
                    <CardDescription>{desc}</CardDescription>
                    <p className="text-3xl font-extrabold pt-2">{price}</p>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-2">
                      {features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full gap-2"
                      variant={highlighted ? "default" : "outline"}
                      onClick={goRegister}
                    >
                      Começar agora <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">Cancele quando quiser. Sem fidelidade.</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Aviso de risco: criptoativos envolvem alto risco. Resultados passados não garantem resultados futuros.
            </p>
          </div>
        </div>
      </section>

      <Separator />

      {/* ═══════════════ FAQ ═══════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold">Perguntas frequentes</h2>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {[
              {
                q: "Isso é conselho financeiro?",
                a: "Não. O Trade Nest Spot é uma ferramenta de apoio à decisão. Nenhum conteúdo aqui constitui recomendação de investimento. Você é responsável por suas próprias decisões.",
              },
              {
                q: "Os sinais funcionam sempre?",
                a: "Não existe sistema que acerte 100% das vezes. Nossos sinais são baseados em análise técnica e IA, mas mercados são imprevisíveis. O foco é gestão de risco e consistência a longo prazo.",
              },
              {
                q: "Como recebo os sinais?",
                a: "Via dashboard em tempo real, notificações push e alertas no app. Você escolhe como quer ser notificado.",
              },
              {
                q: "Tem app ou notificação mobile?",
                a: "Sim. A plataforma é totalmente responsiva e as notificações chegam no seu dispositivo em tempo real.",
              },
              {
                q: "Posso usar com pouco capital?",
                a: "Sim. Não há valor mínimo para usar a plataforma. Os sinais incluem gestão de risco proporcional ao seu capital.",
              },
              {
                q: "Vocês têm histórico dos sinais?",
                a: "Sim. Todos os sinais são registrados com data, resultado e métricas. Você pode consultar o histórico completo nos relatórios da plataforma.",
              },
              {
                q: "Posso cancelar a qualquer momento?",
                a: "Sim. Sem fidelidade, sem multa. Cancele quando quiser diretamente no painel.",
              },
              {
                q: "Como funciona a gestão de risco?",
                a: "Cada sinal vem com stop-loss e take-profit pré-definidos. Além disso, a plataforma sugere tamanho de posição baseado no seu capital e tolerância ao risco.",
              },
            ].map(({ q, a }, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-lg px-4">
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <Separator />

      {/* ═══════════════ CTA FINAL ═══════════════ */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold">
            Pronto para operar com{" "}
            <span className="gradient-text">método?</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Crie sua conta grátis e comece a receber sinais com IA, gestão de risco e transparência total.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="gap-2 text-base glow-effect" onClick={goRegister}>
              Começar grátis <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 text-base" onClick={goLogin}>
              Já tenho conta
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-border/50 py-10 px-4">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-lg font-bold">
              <span className="text-primary">Trade</span> Nest Spot
            </span>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <button onClick={goLogin} className="hover:text-foreground transition-colors">
                Login
              </button>
              <button onClick={goRegister} className="hover:text-foreground transition-colors">
                Cadastro
              </button>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
            <p>
              <strong>Aviso de risco:</strong> Criptoativos envolvem alto risco. Nada aqui é garantia de resultado
              ou recomendação financeira. Resultados passados não garantem resultados futuros. Faça sua própria
              análise antes de tomar qualquer decisão de investimento.
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Trade Nest Spot. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
