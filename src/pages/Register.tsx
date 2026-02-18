import React from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, Phone } from "lucide-react";
import { motion } from "framer-motion";

function formatCPF(value: string) {
  // Remove tudo que não for dígito e limita a 11 dígitos
  const digits = value.replace(/\D/g, "").slice(0, 11);
  // Aplica a máscara somente até o limite
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9,11)}`;
}

function validateCPF(cpf: string) {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^([0-9])\1{10}$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(cpf.substring(10, 11));
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0,2)})${digits.slice(2)}`;
  return `(${digits.slice(0,2)})${digits.slice(2,7)}-${digits.slice(7)}`;
}

export default function Register() {
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    email: "",
    senha: "",
    confirmacao: "",
    indicacao: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cpfValid, setCpfValid] = useState(true);
  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    if (name === "cpf") {
      const formatted = formatCPF(value);
      setForm({ ...form, cpf: formatted });
      setCpfValid(formatted.length === 14 ? validateCPF(formatted) : true);
    } else if (name === "telefone") {
      setForm({ ...form, telefone: formatPhone(value) });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get("ref") || "";
    const stored = localStorage.getItem("referralCode") || "";
    const code = fromUrl || stored;
    if (code) {
      setForm((prev) => ({ ...prev, indicacao: code }));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (form.senha !== form.confirmacao) {
      setError("As senhas nao conferem");
      setIsSubmitting(false);
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.senha)) {
      setError("Senha fraca (min 8, 1 letra e 1 numero)");
      setIsSubmitting(false);
      return;
    }

    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11 || !validateCPF(cpfDigits)) {
      setError("CPF invalido");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          telefone: form.telefone,
          cpf: form.cpf,
          indicacao: form.indicacao || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Erro ao cadastrar");
      }

      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-xl shadow-lg bg-card border border-border"
      >
        <h2 className="text-2xl font-bold mb-2 text-center text-foreground">Cadastro</h2>
        <p className="text-muted-foreground mb-6 text-center">Crie sua conta para acessar a plataforma</p>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="nome">Nome completo</label>
            <Input
              id="nome"
              name="nome"
              type="text"
              required
              placeholder="Seu nome"
              value={form.nome}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="cpf">CPF</label>
            <Input
              id="cpf"
              name="cpf"
              type="text"
              required
              placeholder="Seu CPF"
              value={form.cpf}
              onChange={handleChange}
              className={cpfValid ? "" : "border-destructive"}
            />
            {!cpfValid && (
              <span className="text-xs text-destructive mt-1">CPF inválido</span>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="telefone">Telefone</label>
            <Input
              id="telefone"
              name="telefone"
              type="text"
              required
              placeholder="Seu telefone"
              value={form.telefone}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="email">Email</label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              value={form.email}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="senha">Senha</label>
            <Input
              id="senha"
              name="senha"
              type="password"
              required
              placeholder="Sua senha"
              value={form.senha}
              onChange={handleChange}
            />
            <p className="mt-1 text-xs text-muted-foreground">Minimo 8 caracteres, 1 letra e 1 numero.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="confirmacao">Confirmar senha</label>
            <Input
              id="confirmacao"
              name="confirmacao"
              type="password"
              required
              placeholder="Confirme sua senha"
              value={form.confirmacao}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="indicacao">Código de Indicação</label>
            <Input
              id="indicacao"
              name="indicacao"
              type="text"
              placeholder="Código de indicação (opcional)"
              value={form.indicacao}
              onChange={handleChange}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
          <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
            {isSubmitting ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <span className="text-sm text-muted-foreground">Já possui uma conta?</span>
          <Link to="/login" className="ml-1 text-primary font-medium hover:underline">Entrar</Link>
        </div>
      </motion.div>
    </div>
  );
}
