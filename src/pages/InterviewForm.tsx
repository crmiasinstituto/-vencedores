import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import squaadLogo from "@/assets/squaad-logo.jpeg";

export default function InterviewForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Por favor, informe seu nome.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("candidates").insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        position: position.trim() || null,
        status: "registered",
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Cadastro realizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Tente novamente."));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-500/30 bg-gray-900/80 backdrop-blur">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Cadastro Realizado!</h2>
            <p className="text-muted-foreground">
              Obrigado pelo interesse, {name}! Nossa equipe entrara em contato em breve para agendar sua entrevista.
            </p>
            <div className="flex items-center gap-2 mt-4 opacity-60">
              <img src={squaadLogo} alt="+ que Vencedores" className="w-6 h-6 rounded" />
              <span className="text-xs text-muted-foreground">Powered by + que Vencedores</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 bg-gray-900/80 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={squaadLogo} alt="+ que Vencedores" className="w-12 h-12 rounded-lg" />
          </div>
          <div>
            <CardTitle className="text-xl text-white">Processo Seletivo + que Vencedores</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Preencha seus dados para participar do nosso processo seletivo
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Vaga de interesse</Label>
              <Input
                id="position"
                placeholder="Ex: Desenvolvedor, Designer, Vendas..."
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Enviar Cadastro
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
