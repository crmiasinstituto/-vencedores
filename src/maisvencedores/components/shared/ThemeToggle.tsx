import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Alterna Claro/Escuro em um clique.
 *
 * O app é dark por padrão (o :root já é escuro). O tema claro é uma classe .theme-light
 * carimbada no <html> que sobrescreve as variáveis (ver index.css). Fazemos isso na mão,
 * sem next-themes: o provider dele não estava montado, então o setTheme não fazia nada —
 * era essa a razão do toggle "não funcionar".
 */

const KEY = 'mv-theme';

function apply(light: boolean) {
  document.documentElement.classList.toggle('theme-light', light);
}

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    // Claro é o padrão na área de membros; só fica escuro se a pessoa escolheu.
    const saved = localStorage.getItem(KEY);
    const isLight = saved ? saved === 'light' : true;
    setLight(isLight);
    apply(isLight);
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    localStorage.setItem(KEY, next ? 'light' : 'dark');
    apply(next);
  };

  return (
    <Button variant="outline" size="sm" onClick={toggle} className="min-w-[112px] gap-2">
      {light ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {light ? 'Claro' : 'Escuro'}
    </Button>
  );
}
