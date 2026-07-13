import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StickyBarProps {
  checkoutUrl: string;
  targetDate: Date;
}

export const StickyBar: React.FC<StickyBarProps> = ({ checkoutUrl, targetDate }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky bar after scrolling 500px
      setIsVisible(window.scrollY > 500 && !isDismissed);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDismissed]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const formatTime = () => {
    return `${timeLeft.days.toString().padStart(2, '0')}:${timeLeft.hours.toString().padStart(2, '0')}:${timeLeft.minutes.toString().padStart(2, '0')}:${timeLeft.seconds.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-carbon via-carbon/95 to-carbon border-b border-yellow/30 shadow-lg shadow-yellow/10 backdrop-blur-xl"
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
              {/* Countdown */}
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow hidden sm:block" />
                <span className="text-yellow font-mono font-bold text-lg">
                  ⏰ {formatTime()}
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center gap-3">
                <span className="text-gray-500 line-through text-sm">R$297</span>
                <span className="text-yellow font-black text-lg sm:text-xl">a partir de R$97</span>
              </div>

              {/* CTA Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
              <Button
                  onClick={() => window.location.href = checkoutUrl}
                  className="bg-gradient-to-r from-yellow via-yellow-400 to-yellow text-carbon font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-yellow/30 hover:shadow-yellow/50 transition-all"
                >
                  <span className="flex items-center gap-2">
                    GARANTIR VAGA
                    <Rocket className="w-4 h-4" />
                  </span>
                </Button>
              </motion.div>

              {/* Close button */}
              <button
                onClick={() => setIsDismissed(true)}
                className="text-gray-500 hover:text-white transition-colors p-1"
                aria-label="Fechar barra de promoção"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
