import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
  options?: string[];
}

interface ChatSimulatorProps {
  onLeadCapture?: (data: LeadData) => void;
}

interface LeadData {
  name: string;
  email: string;
  phone: string;
  business: string;
  interest: string;
}

const conversationFlow: Record<string, { text: string; options?: string[]; nextStep?: string; action?: string }> = {
  greeting: {
    text: "Olá! 👋 Sou a IA da IaMilitia. Como posso ajudar você a automatizar seu negócio hoje?",
    options: [
      "Quero saber sobre automação",
      "Preciso de um agente de vendas IA",
      "Quero reduzir custos operacionais",
      "Falar com um especialista"
    ]
  },
  automation: {
    text: "Perfeito! Nossa automação pode aumentar sua produtividade em até 300%. Qual é o principal gargalo do seu negócio?",
    options: [
      "Atendimento ao cliente",
      "Processos administrativos", 
      "Vendas e prospecção",
      "Gestão de dados"
    ]
  },
  sales_agent: {
    text: "Nossos agentes IA de vendas trabalham 24/7 e já aumentaram as vendas de nossos clientes em até 150%. Qual seu segmento?",
    options: [
      "E-commerce",
      "Serviços profissionais",
      "Educação",
      "Clínicas e saúde"
    ]
  },
  cost_reduction: {
    text: "Excelente! Nossos clientes economizam em média R$ 15.000/mês em custos operacionais. Quantos funcionários sua empresa tem?",
    options: [
      "1-10 funcionários",
      "11-50 funcionários",
      "51-200 funcionários",
      "Mais de 200 funcionários"
    ]
  },
  specialist: {
    text: "Ótima escolha! Nossos especialistas podem mostrar exatamente como a IA pode transformar seu negócio. Para agendar, preciso de alguns dados:",
    action: "collect_lead"
  }
};

export default function ChatSimulator({ onLeadCapture }: ChatSimulatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState('greeting');
  const [leadData, setLeadData] = useState<Partial<LeadData>>({});
  const [collectingLead, setCollectingLead] = useState(false);
  const [leadStep, setLeadStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const leadQuestions = [
    { field: 'name', question: 'Qual é o seu nome?' },
    { field: 'email', question: 'Qual é o seu email?' },
    { field: 'phone', question: 'Qual é o seu telefone?' },
    { field: 'business', question: 'Qual é o seu segmento de negócio?' }
  ];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setTimeout(() => addBotMessage(conversationFlow.greeting.text, conversationFlow.greeting.options), 1000);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addBotMessage = (text: string, options?: string[]) => {
    setIsTyping(true);
    setTimeout(() => {
      const newMessage: Message = {
        id: Date.now().toString(),
        text,
        sender: 'bot',
        timestamp: new Date(),
        options
      };
      setMessages(prev => [...prev, newMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const addUserMessage = (text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleOptionClick = (option: string) => {
    addUserMessage(option);
    
    if (collectingLead) return;

    let nextStep = '';
    if (option.includes('automação')) nextStep = 'automation';
    else if (option.includes('agente de vendas')) nextStep = 'sales_agent';
    else if (option.includes('custos')) nextStep = 'cost_reduction';
    else if (option.includes('especialista')) nextStep = 'specialist';
    else nextStep = 'specialist';

    setCurrentStep(nextStep);
    const response = conversationFlow[nextStep];
    
    if (response.action === 'collect_lead') {
      setCollectingLead(true);
      setLeadStep(0);
      setTimeout(() => addBotMessage(response.text), 1000);
      setTimeout(() => addBotMessage(leadQuestions[0].question), 2000);
    } else {
      setTimeout(() => addBotMessage(response.text, response.options), 1000);
    }
  };

  const handleLeadInput = () => {
    if (!currentInput.trim()) return;

    addUserMessage(currentInput);
    
    const currentQuestion = leadQuestions[leadStep];
    setLeadData(prev => ({ ...prev, [currentQuestion.field]: currentInput }));
    
    setCurrentInput('');
    
    if (leadStep < leadQuestions.length - 1) {
      setLeadStep(leadStep + 1);
      setTimeout(() => addBotMessage(leadQuestions[leadStep + 1].question), 1000);
    } else {
      // Finalizar coleta
      const finalData = { ...leadData, [currentQuestion.field]: currentInput } as LeadData;
      finalData.interest = currentStep;
      
      setTimeout(() => {
        addBotMessage(`Perfeito, ${finalData.name}! Recebi seus dados. Nossa equipe entrará em contato em até 1 hora para apresentar uma proposta personalizada. 🚀`);
        addBotMessage("Enquanto isso, que tal conhecer alguns casos de sucesso? Clique no botão abaixo para ver como transformamos outros negócios:");
      }, 1000);
      
      setTimeout(() => {
        window.open("https://wa.me/5575998261542?text=Quero saber mais sobre implantação de IA", "_blank");
      }, 3000);
      
      onLeadCapture?.(finalData);
      setCollectingLead(false);
    }
  };

  const handleInputSubmit = () => {
    if (collectingLead) {
      handleLeadInput();
    } else {
      addUserMessage(currentInput);
      setCurrentInput('');
      setTimeout(() => addBotMessage("Interessante! Para te ajudar melhor, que tal falar com um dos nossos especialistas?", ["Falar com especialista"]), 1000);
    }
  };

  return (
    <>
      {/* Chat Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl"
          size="lg"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
        
        {/* Notification pulse */}
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [1, 0.7, 1]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 100 }}
            className="fixed bottom-24 right-6 w-96 h-[500px] z-50"
          >
            <Card className="w-full h-full flex flex-col shadow-2xl border-2 border-primary/20">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h4 className="font-semibold">IA Militia</h4>
                    <div className="flex items-center gap-1 text-xs opacity-90">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      Online
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start gap-2 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        message.sender === 'bot' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {message.sender === 'bot' ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <div className={`rounded-lg p-3 ${
                        message.sender === 'bot'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}>
                        <p className="text-sm">{message.text}</p>
                        {message.options && (
                          <div className="mt-3 space-y-2">
                            {message.options.map((option, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                className="w-full text-left justify-start text-xs"
                                onClick={() => handleOptionClick(option)}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {/* Typing indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    onKeyPress={(e) => e.key === 'Enter' && handleInputSubmit()}
                    className="flex-1"
                  />
                  <Button onClick={handleInputSubmit} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}