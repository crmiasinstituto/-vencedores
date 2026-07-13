import React, { useState, useEffect } from 'react';

interface EventCountdownProps {
  targetDate: Date;
  className?: string;
  showProgress?: boolean;
  progressPercentage?: number;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const EventCountdown: React.FC<EventCountdownProps> = ({ 
  targetDate, 
  className = '',
  showProgress = false,
  progressPercentage = 87
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

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
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center animate-fade-in">
      <div className="relative bg-gradient-to-b from-carbon to-carbon/80 border border-yellow/30 rounded-xl p-3 md:p-5 min-w-[70px] md:min-w-[90px] shadow-lg shadow-yellow/10">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-yellow/5 rounded-xl blur-sm" />
        
        {/* Number - static, no animation per tick */}
        <span className="relative block text-3xl md:text-5xl font-bold text-yellow font-mono text-center">
          {value.toString().padStart(2, '0')}
        </span>
        
        {/* Divider line */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-yellow/10" />
      </div>
      
      <span className="mt-3 text-xs md:text-sm text-gray-400 uppercase tracking-wider font-medium">
        {label}
      </span>
    </div>
  );

  const Separator = () => (
    <div className="flex flex-col justify-center items-center px-1 md:px-3 pb-6">
      <span className="text-yellow text-3xl md:text-5xl font-bold opacity-80">
        :
      </span>
    </div>
  );

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Countdown blocks */}
      <div className="flex items-start justify-center gap-1 md:gap-2">
        <TimeBlock value={timeLeft.days} label="Dias" />
        <Separator />
        <TimeBlock value={timeLeft.hours} label="Horas" />
        <Separator />
        <TimeBlock value={timeLeft.minutes} label="Min" />
        <Separator />
        <TimeBlock value={timeLeft.seconds} label="Seg" />
      </div>
      
      {/* Progress bar for spots */}
      {showProgress && (
        <div className="mt-6 w-full max-w-md animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <div className="relative h-3 bg-carbon/80 rounded-full overflow-hidden border border-yellow/20">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow via-yellow-400 to-red-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-400 mt-2 flex items-center justify-center gap-2">
            <span className="text-red-400 font-bold">🔥 {progressPercentage}%</span> 
            das vagas já preenchidas
          </p>
        </div>
      )}
    </div>
  );
};
