import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Instagram, Sparkles, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

function maskWhatsapp(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export interface CaptureData {
  nome: string;
  whatsapp: string;
  instagram: string;
  authorized_mural: boolean;
}

interface Props {
  onSubmit: (data: CaptureData) => void | Promise<void>;
  loading?: boolean;
}

export function DiscCaptureModal({ onSubmit, loading }: Props) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [authorized, setAuthorized] = useState(true);
  const [touched, setTouched] = useState(false);

  const nomeValid = nome.trim().split(/\s+/).filter(Boolean).length >= 2;
  const whatsValid = whatsapp.replace(/\D/g, "").length >= 10;
  const igValid = /^[a-zA-Z0-9._]{1,30}$/.test(instagram.replace(/^@/, "").trim());
  const valid = nomeValid && whatsValid && igValid && authorized;

  function handleSubmit() {
    setTouched(true);
    if (!valid) return;
    onSubmit({
      nome: nome.trim(),
      whatsapp: whatsapp.replace(/\D/g, ""),
      instagram: instagram.replace(/^@/, "").trim().toLowerCase(),
      authorized_mural: authorized,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
      className="w-full max-w-md mx-auto overflow-hidden rounded-3xl shadow-[0_25px_80px_-12px_rgba(0,0,0,0.35)]"
    >
      {/* Header amarelo */}
      <div className="relative bg-gradient-to-br from-[#3B82F6] via-[#F5B800] to-[#E8A900] px-6 pt-6 pb-8 text-center overflow-hidden">
        <div className="absolute top-[-30px] right-[-20px] w-32 h-32 rounded-full bg-white/15" />
        <div className="absolute bottom-[-40px] left-[-15px] w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute top-4 left-6 w-8 h-8 rounded-full bg-white/20" />

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/15 text-black/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
            <Brain className="w-3.5 h-3.5" />
            Analise de perfil + DISC
          </div>
          <h2 className="text-[1.5rem] lg:text-[1.7rem] font-extrabold text-black leading-[1.15] tracking-tight">
            Vamos analisar seu perfil
          </h2>
          <p className="text-black/65 text-sm mt-2 font-medium">
            Instagram + Perfil Comportamental. Em 90 segundos.
          </p>
        </motion.div>
      </div>

      {/* Conector curvo */}
      <div className="relative">
        <svg viewBox="0 0 420 24" className="w-full block" preserveAspectRatio="none">
          <path d="M0,0 L420,0 L420,24 Q350,0 210,0 Q70,0 0,24 Z" fill="#3B82F6" />
          <path d="M0,24 Q70,0 210,0 Q350,0 420,24 L420,24 L0,24 Z" fill="white" />
        </svg>
      </div>

      {/* Form branco */}
      <div className="bg-white px-6 pb-6 pt-1">
        <div className="space-y-4">
          <div>
            <Label htmlFor="disc-nome" className="text-gray-700 text-sm font-semibold">
              Nome completo
            </Label>
            <Input
              id="disc-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Eduardo"
              className="mt-1.5 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3B82F6] focus:ring-[#3B82F6]/30 rounded-xl text-base"
              autoComplete="name"
            />
            {touched && !nomeValid && (
              <p className="text-xs text-red-500 mt-1">Coloca nome e sobrenome.</p>
            )}
          </div>

          <div>
            <Label htmlFor="disc-whatsapp" className="text-gray-700 text-sm font-semibold">
              WhatsApp
            </Label>
            <Input
              id="disc-whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(maskWhatsapp(e.target.value))}
              placeholder="(71) 99999-9999"
              inputMode="tel"
              className="mt-1.5 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3B82F6] focus:ring-[#3B82F6]/30 rounded-xl text-base"
              autoComplete="tel"
            />
            {touched && !whatsValid && (
              <p className="text-xs text-red-500 mt-1">DDD + numero, minimo 10 digitos.</p>
            )}
          </div>

          <div>
            <Label htmlFor="disc-instagram" className="text-gray-700 text-sm font-semibold">
              Instagram
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="disc-instagram"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
                placeholder="seuusuario"
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3B82F6] focus:ring-[#3B82F6]/30 pl-10 h-12 rounded-xl text-base"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <Instagram className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            {touched && !igValid && (
              <p className="text-xs text-red-500 mt-1">Usuario invalido (letras, numeros, . ou _).</p>
            )}
          </div>

          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="disc-lgpd"
              checked={authorized}
              onCheckedChange={(v) => setAuthorized(Boolean(v))}
              className="mt-0.5 border-gray-300 data-[state=checked]:bg-[#3B82F6] data-[state=checked]:border-[#3B82F6] data-[state=checked]:text-black"
            />
            <label htmlFor="disc-lgpd" className="text-xs text-gray-500 leading-snug cursor-pointer">
              Aceito receber contato da + que Vencedores e autorizo a exibicao da minha foto publica do
              Instagram + primeiro nome no mural ao vivo do evento.{" "}
              <a href="/privacidade" target="_blank" className="text-[#D4A800] hover:text-[#B89000] underline font-medium">
                Politica de privacidade
              </a>
            </label>
          </div>
        </div>

        <Button
          size="lg"
          disabled={!valid || loading}
          onClick={handleSubmit}
          className="mt-5 w-full h-14 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#E8A900] hover:from-[#FFD61F] hover:to-[#F5B800] text-black font-extrabold text-[15px] shadow-[0_6px_24px_-4px_rgba(250,200,0,0.5)] hover:shadow-[0_10px_32px_-4px_rgba(250,200,0,0.7)] hover:scale-[1.01] transition-all disabled:opacity-50 disabled:hover:scale-100 border-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analisar meu perfil
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <p className="mt-3 text-[11px] text-gray-400 text-center">
          Seus dados sao protegidos pela LGPD.
        </p>
      </div>
    </motion.div>
  );
}
