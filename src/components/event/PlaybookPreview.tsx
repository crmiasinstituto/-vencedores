import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Sparkles } from "lucide-react";
import jsPDF from "jspdf";

interface PlaybookData {
  icpDocument: string;
  manifesto: string;
  namesSuggestions: { name: string; tagline: string; justification: string }[];
  pitch60s: string;
  participantJourney: { before: string; during: string; after: string };
  salesCopy: { headline: string; bullets: string[]; cta: string };
}

interface PlaybookPreviewProps {
  playbook: PlaybookData | null;
  isLoading: boolean;
  onGenerate: () => void;
  eventData: any;
}

export function PlaybookPreview({ playbook, isLoading, onGenerate, eventData }: PlaybookPreviewProps) {
  const downloadPDF = () => {
    if (!playbook) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPos = 20;

    const addTitle = (text: string, size: number = 16) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(218, 165, 32); // Golden
      doc.text(text, margin, yPos);
      yPos += size / 2 + 5;
    };

    const addText = (text: string, size: number = 11) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(text, maxWidth);
      
      lines.forEach((line: string) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin, yPos);
        yPos += size / 2 + 2;
      });
      yPos += 5;
    };

    const checkNewPage = (needed: number = 40) => {
      if (yPos > 270 - needed) {
        doc.addPage();
        yPos = 20;
      }
    };

    // Header
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(218, 165, 32);
    doc.text("PLAYBOOK DO EVENTO", pageWidth / 2, 25, { align: "center" });
    yPos = 55;

    // ICP Document
    addTitle("📌 DOCUMENTO DE ICP");
    addText(playbook.icpDocument);
    
    checkNewPage();

    // Manifesto
    addTitle("🔥 MANIFESTO DO EVENTO");
    addText(playbook.manifesto);

    checkNewPage();

    // Names Suggestions
    addTitle("💡 SUGESTÕES DE NOME");
    playbook.namesSuggestions.forEach((suggestion, index) => {
      checkNewPage(30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(218, 165, 32);
      doc.text(`${index + 1}. ${suggestion.name}`, margin, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100);
      doc.text(`"${suggestion.tagline}"`, margin + 5, yPos);
      yPos += 8;
      addText(suggestion.justification);
    });

    checkNewPage();

    // Pitch 60s
    addTitle("🎙️ PITCH DE 60 SEGUNDOS");
    addText(playbook.pitch60s);

    checkNewPage();

    // Participant Journey
    addTitle("🧭 JORNADA DO PARTICIPANTE");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("ANTES:", margin, yPos);
    yPos += 8;
    addText(playbook.participantJourney.before);
    
    checkNewPage();
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("DURANTE:", margin, yPos);
    yPos += 8;
    addText(playbook.participantJourney.during);
    
    checkNewPage();
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("DEPOIS:", margin, yPos);
    yPos += 8;
    addText(playbook.participantJourney.after);

    checkNewPage();

    // Sales Copy
    addTitle("📝 COPY DE VENDAS");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    const headlineLines = doc.splitTextToSize(playbook.salesCopy.headline, maxWidth);
    headlineLines.forEach((line: string) => {
      doc.text(line, margin, yPos);
      yPos += 10;
    });
    yPos += 5;

    playbook.salesCopy.bullets.forEach(bullet => {
      checkNewPage();
      addText(`• ${bullet}`);
    });

    yPos += 5;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(218, 165, 32);
    doc.text(`CTA: ${playbook.salesCopy.cta}`, margin, yPos);

    // Founders
    if (eventData?.founders?.length > 0) {
      doc.addPage();
      yPos = 20;
      addTitle("👥 OS 4 FUNDADORES");
      
      eventData.founders.forEach((founder: any, index: number) => {
        if (founder.name) {
          checkNewPage(50);
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(218, 165, 32);
          doc.text(`${founder.name}`, margin, yPos);
          yPos += 8;
          doc.setFontSize(11);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100, 100, 100);
          doc.text(`${founder.archetype} • ${founder.expertise}`, margin, yPos);
          yPos += 8;
          if (founder.bio) {
            addText(founder.bio);
          }
          yPos += 5;
        }
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount} • Gerado por + que Vencedores`, pageWidth / 2, 290, { align: "center" });
    }

    doc.save("playbook-evento-squaad.pdf");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-primary animate-spin" />
          <Sparkles className="w-6 h-6 text-primary absolute -top-2 -right-2 animate-pulse" />
        </div>
        <p className="text-lg text-foreground font-medium">Gerando seu Playbook com IA...</p>
        <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
      </div>
    );
  }

  if (!playbook) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[400px] space-y-6 text-center"
      >
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <FileText className="w-12 h-12 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Pronto para gerar seu Playbook?
          </h3>
          <p className="text-muted-foreground max-w-md">
            Com base em todas as informações que você preencheu, nossa IA vai criar um 
            documento estratégico completo para seu evento.
          </p>
        </div>
        <Button 
          size="lg" 
          onClick={onGenerate}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Gerar Playbook com IA
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header com download */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-foreground">Seu Playbook está pronto! 🎉</h3>
          <p className="text-muted-foreground">Revise o conteúdo e faça o download do PDF</p>
        </div>
        <Button onClick={downloadPDF} className="bg-primary text-primary-foreground">
          <Download className="w-4 h-4 mr-2" />
          Baixar PDF
        </Button>
      </div>

      {/* ICP Document */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <h4 className="text-lg font-bold text-primary mb-4">📌 Documento de ICP</h4>
        <p className="text-foreground whitespace-pre-line">{playbook.icpDocument}</p>
      </div>

      {/* Manifesto */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <h4 className="text-lg font-bold text-primary mb-4">🔥 Manifesto do Evento</h4>
        <p className="text-foreground whitespace-pre-line italic">{playbook.manifesto}</p>
      </div>

      {/* Names */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <h4 className="text-lg font-bold text-primary mb-4">💡 Sugestões de Nome</h4>
        <div className="grid gap-4">
          {playbook.namesSuggestions.map((suggestion, index) => (
            <div key={index} className="bg-background/50 rounded-lg p-4 border border-border/30">
              <p className="font-bold text-foreground text-lg">{suggestion.name}</p>
              <p className="text-primary italic">"{suggestion.tagline}"</p>
              <p className="text-muted-foreground text-sm mt-2">{suggestion.justification}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pitch */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <h4 className="text-lg font-bold text-primary mb-4">🎙️ Pitch de 60 Segundos</h4>
        <p className="text-foreground whitespace-pre-line">{playbook.pitch60s}</p>
      </div>

      {/* Journey */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <h4 className="text-lg font-bold text-primary mb-4">🧭 Jornada do Participante</h4>
        <div className="space-y-4">
          <div>
            <p className="font-medium text-foreground">ANTES:</p>
            <p className="text-muted-foreground">{playbook.participantJourney.before}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">DURANTE:</p>
            <p className="text-muted-foreground">{playbook.participantJourney.during}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">DEPOIS:</p>
            <p className="text-muted-foreground">{playbook.participantJourney.after}</p>
          </div>
        </div>
      </div>

      {/* Sales Copy */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <h4 className="text-lg font-bold text-primary mb-4">📝 Copy de Vendas</h4>
        <p className="text-xl font-bold text-foreground mb-4">{playbook.salesCopy.headline}</p>
        <ul className="space-y-2 mb-4">
          {playbook.salesCopy.bullets.map((bullet, index) => (
            <li key={index} className="flex items-start gap-2 text-muted-foreground">
              <span className="text-primary">•</span>
              {bullet}
            </li>
          ))}
        </ul>
        <p className="text-primary font-bold">{playbook.salesCopy.cta}</p>
      </div>

      {/* Download button at bottom */}
      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={downloadPDF} className="bg-primary text-primary-foreground">
          <Download className="w-5 h-5 mr-2" />
          Baixar Playbook em PDF
        </Button>
      </div>
    </motion.div>
  );
}
