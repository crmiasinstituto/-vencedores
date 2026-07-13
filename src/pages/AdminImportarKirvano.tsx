import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  success: boolean;
  total_rows: number;
  approved_in_csv: number;
  inserted: number;
  skipped_duplicate: number;
  skipped_not_approved: number;
  errors: Array<{ codigo: string; nome: string; reason: string }>;
}

export default function AdminImportarKirvano() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('O arquivo precisa ser .csv');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const { data, error } = await supabase.functions.invoke('kirvano-csv-import', {
        body: form,
      });

      if (error) throw error;
      setResult(data as ImportResult);

      if (data?.inserted > 0) {
        toast.success(`${data.inserted} venda(s) importada(s)`);
      } else if (data?.skipped_duplicate > 0) {
        toast.info('Tudo já estava no CRM — nada novo pra importar');
      } else {
        toast.warning('Nenhuma venda processada');
      }
    } catch (e) {
      console.error(e);
      toast.error(`Falha na importação: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Importar vendas Kirvano · + que Vencedores</title></Helmet>

      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Importar vendas Kirvano (CSV)
          </h1>
          <p className="text-muted-foreground text-sm">
            Baixe o relatório de vendas no painel Kirvano e suba aqui. Só importa o que ainda
            não está no CRM — pode rodar quantas vezes quiser sem duplicar.
          </p>
        </header>

        <Card className="p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-base mb-1">Como gerar o CSV</h2>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Entrar em <code className="text-foreground">app.kirvano.com</code> → Relatórios → Vendas</li>
              <li>Filtrar pela Masterclass IA (período desejado)</li>
              <li>Clicar em <strong>Exportar CSV</strong></li>
              <li>Subir o arquivo aqui embaixo</li>
            </ol>
          </div>

          <label
            htmlFor="csv-input"
            className="flex flex-col items-center justify-center border-2 border-dashed border-yellow/30 hover:border-yellow/60 bg-yellow/[0.02] hover:bg-yellow/[0.05] rounded-xl px-6 py-10 cursor-pointer transition-colors"
          >
            <Upload className="w-8 h-8 text-yellow mb-3" />
            <p className="text-sm font-medium">
              {file ? file.name : 'Clique pra escolher o CSV'}
            </p>
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
            <input
              id="csv-input"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
            />
          </label>

          <Button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full mt-5 bg-yellow text-black hover:bg-yellow/90 font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando…
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Importar para o CRM
              </>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Vendas duplicadas são ignoradas automaticamente. Nenhuma mensagem de WhatsApp é
            disparada — você manda manualmente em pequenos lotes pra evitar ban.
          </p>
        </Card>

        {result && (
          <Card className="p-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold">Resultado da importação</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Stat label="Linhas no CSV" value={result.total_rows} />
              <Stat label="Aprovadas" value={result.approved_in_csv} />
              <Stat label="Inseridas" value={result.inserted} accent="green" />
              <Stat label="Já existiam" value={result.skipped_duplicate} accent="muted" />
            </div>

            {result.errors.length > 0 && (
              <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-sm font-semibold text-red-500">
                    {result.errors.length} erro(s)
                  </p>
                </div>
                <ul className="text-xs space-y-1 text-red-300 list-disc list-inside">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>
                      <strong>{err.codigo}</strong> {err.nome}: {err.reason}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>... e mais {result.errors.length - 10}</li>
                  )}
                </ul>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Stat({
  label, value, accent,
}: { label: string; value: number; accent?: 'green' | 'muted' }) {
  const colorClass =
    accent === 'green' ? 'text-green-500' :
    accent === 'muted' ? 'text-muted-foreground' :
    'text-foreground';
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
