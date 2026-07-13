import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import squaadLogo from "@/assets/squaad-logo.jpeg";
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigation = [{
    name: "Início",
    href: "/",
    id: "home"
  }, {
    name: "O que fazemos",
    href: "#services",
    id: "services"
  }, {
    name: "Soluções",
    href: "#solutions",
    id: "solutions"
  }, {
    name: "Casos de Uso",
    href: "#cases",
    id: "cases"
  }, {
    name: "Tecnologia",
    href: "#tech",
    id: "tech"
  }, {
    name: "Diferenciais",
    href: "#differentials",
    id: "differentials"
  }, {
    name: "Contato",
    href: "#contact",
    id: "contact"
  }];
  const handleCTAClick = () => {
    window.open("https://wa.me/5575998261542?text=Olá! Quero saber mais sobre implantação de IA para meu negócio", "_blank");
  };
  const scrollToSection = (sectionId: string) => {
    if (location.pathname !== '/') return;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
    setIsMenuOpen(false);
  };
  return <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <img src={squaadLogo} alt="+ que Vencedores Business Solutions" className="h-16 md:h-20 w-auto object-scale-down" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navigation.map(item => <button key={item.name} onClick={() => scrollToSection(item.id)} className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium story-link">
                {item.name}
              </button>)}
          </nav>

          {/* CTA Button */}
          <div className="hidden md:flex">
            <Button onClick={handleCTAClick} className="btn-cta text-sm">
              Quero meu esquadrão agora
            </Button>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 text-muted-foreground hover:text-primary">
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && <div className="lg:hidden py-4 border-t border-border">
            <nav className="flex flex-col space-y-4">
              {navigation.map(item => <button key={item.name} onClick={() => scrollToSection(item.id)} className="text-left text-muted-foreground hover:text-primary transition-colors py-2">
                  {item.name}
                </button>)}
              <Button onClick={handleCTAClick} className="btn-cta mt-4">
                Quero meu esquadrão agora
              </Button>
            </nav>
          </div>}
      </div>
    </header>;
};
export default Header;