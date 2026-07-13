// Hook pra capturar slides renderizados no DOM e exportar como PNG individual ou ZIP
// Os slides ficam em containers off-screen com data-slide-index
import { useState } from 'react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';

async function captureNode(node: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(node, {
    width: 1080,
    height: 1350,
    scale: 1,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob falhou'))),
      'image/png',
      0.95,
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function useCarouselExport() {
  const [exporting, setExporting] = useState(false);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);

  async function exportSlide(slideIndex: number, topic: string) {
    setExportingIndex(slideIndex);
    try {
      const node = document.querySelector<HTMLElement>(
        `[data-export-slide="${slideIndex}"]`,
      );
      if (!node) throw new Error(`Slide ${slideIndex} nao encontrado no DOM`);
      const blob = await captureNode(node);
      const fname = `${slugify(topic) || 'carrossel'}-${String(slideIndex + 1).padStart(2, '0')}.png`;
      downloadBlob(blob, fname);
    } finally {
      setExportingIndex(null);
    }
  }

  async function exportAll(slideCount: number, topic: string) {
    setExporting(true);
    try {
      const zip = new JSZip();
      const slug = slugify(topic) || 'carrossel';
      for (let i = 0; i < slideCount; i++) {
        setExportingIndex(i);
        const node = document.querySelector<HTMLElement>(`[data-export-slide="${i}"]`);
        if (!node) throw new Error(`Slide ${i} nao encontrado`);
        const blob = await captureNode(node);
        zip.file(`${String(i + 1).padStart(2, '0')}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${slug}.zip`);
    } finally {
      setExporting(false);
      setExportingIndex(null);
    }
  }

  return { exportSlide, exportAll, exporting, exportingIndex };
}
