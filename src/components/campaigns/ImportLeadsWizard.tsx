// Stub: ImportLeadsWizard não veio no pacote oficial. + que Vencedores usa AdminImportarKirvano
// como fluxo oficial de importação. Este componente fica como placeholder.
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportLeadsWizard({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar leads</DialogTitle>
          <DialogDescription>
            Para importar leads em lote, use o fluxo Kirvano (Admin → Importar Kirvano).
          </DialogDescription>
        </DialogHeader>
        <Button onClick={() => { onOpenChange(false); navigate('/admin/importar-kirvano'); }}>
          Ir para Importar Kirvano
        </Button>
      </DialogContent>
    </Dialog>
  );
}
