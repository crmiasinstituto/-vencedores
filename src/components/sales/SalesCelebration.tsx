import { motion, AnimatePresence } from 'framer-motion';
import { X, PartyPopper, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Sale {
  id: string;
  name: string;
  instagram?: string;
  instagram_profile_pic_url?: string;
  product_name: string;
  amount: number;
  created_at: string;
}

interface SalesCelebrationProps {
  sale: Sale | null;
  isVisible: boolean;
  onClose: () => void;
}

export function SalesCelebration({ sale, isVisible, onClose }: SalesCelebrationProps) {
  if (!sale) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Confetti Effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  y: -20, 
                  x: Math.random() * window.innerWidth,
                  rotate: 0,
                  opacity: 1
                }}
                animate={{ 
                  y: window.innerHeight + 100,
                  rotate: Math.random() * 720 - 360,
                  opacity: 0
                }}
                transition={{ 
                  duration: 3 + Math.random() * 2,
                  delay: Math.random() * 0.5,
                  ease: "easeOut"
                }}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#3B82F6'][Math.floor(Math.random() * 6)]
                }}
              />
            ))}
          </div>

          {/* Main Card */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            className="relative bg-gradient-to-br from-yellow/20 to-yellow/5 border-2 border-yellow rounded-2xl p-8 max-w-lg w-full mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>

            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ 
                duration: 0.5,
                repeat: 3,
                repeatType: "reverse"
              }}
              className="flex justify-center mb-4"
            >
              <Trophy className="w-16 h-16 text-yellow" />
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-bold text-yellow mb-2"
            >
              🎉 NOVA VENDA! 🎉
            </motion.h2>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-muted-foreground mb-6"
            >
              Bem-vindo(a) à Imersão!
            </motion.p>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-4 mb-6"
            >
              {sale.instagram_profile_pic_url ? (
                <img 
                  src={sale.instagram_profile_pic_url} 
                  alt={sale.name}
                  className="w-24 h-24 rounded-full border-4 border-yellow object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-yellow bg-yellow/20 flex items-center justify-center">
                  <PartyPopper className="w-10 h-10 text-yellow" />
                </div>
              )}

              <div>
                <h3 className="text-2xl font-bold text-foreground">{sale.name}</h3>
                {sale.instagram && (
                  <p className="text-muted-foreground">@{sale.instagram}</p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-card/50 rounded-lg p-4 mb-4"
            >
              <p className="text-sm text-muted-foreground mb-1">{sale.product_name}</p>
              <p className="text-3xl font-bold text-green-500">
                R$ {sale.amount.toFixed(2).replace('.', ',')}
              </p>
            </motion.div>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xs text-muted-foreground"
            >
              {new Date(sale.created_at).toLocaleString('pt-BR')}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
