import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface VHSOnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

const stepNames = [
  'Momento',
  'Vida',
  'Sonhos',
  'Dores',
  '2026',
  'Expectativas'
];

export const VHSOnboardingProgress: React.FC<VHSOnboardingProgressProps> = ({
  currentStep,
  totalSteps
}) => {
  const progress = ((currentStep - 1) / totalSteps) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      {/* Progress bar */}
      <div className="relative h-2 bg-carbon/80 rounded-full overflow-hidden border border-yellow/20 mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow via-yellow-400 to-yellow-500 rounded-full"
        />
      </div>

      {/* Step indicators */}
      <div className="flex justify-between items-center">
        {stepNames.map((name, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={index} className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  opacity: isCompleted || isCurrent ? 1 : 0.4
                }}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  transition-all duration-300 border-2
                  ${isCompleted 
                    ? 'bg-yellow text-carbon border-yellow' 
                    : isCurrent 
                      ? 'bg-carbon text-yellow border-yellow shadow-lg shadow-yellow/30' 
                      : 'bg-carbon/50 text-gray-500 border-gray-600'
                  }
                `}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : stepNumber}
              </motion.div>
              <span className={`
                mt-2 text-[10px] md:text-xs font-medium hidden sm:block
                ${isCurrent ? 'text-yellow' : isCompleted ? 'text-gray-300' : 'text-gray-500'}
              `}>
                {name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile current step name */}
      <div className="sm:hidden text-center mt-4">
        <span className="text-yellow font-semibold text-sm">
          {stepNames[currentStep - 1]}
        </span>
        <span className="text-gray-400 text-sm ml-2">
          ({currentStep}/{totalSteps})
        </span>
      </div>
    </div>
  );
};
