import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface VHSQuestionCardProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const VHSQuestionCard: React.FC<VHSQuestionCardProps> = ({
  icon: Icon,
  title,
  description,
  children,
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className={`
        bg-gradient-to-br from-carbon/90 via-carbon to-carbon/80
        border border-yellow/20 rounded-2xl p-6 md:p-8
        shadow-xl shadow-yellow/5
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-yellow/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-yellow" />
          </div>
        )}
        <div>
          <h3 className="text-lg md:text-xl font-bold text-white">
            {title}
          </h3>
          {description && (
            <p className="text-gray-400 text-sm mt-1">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {children}
      </div>
    </motion.div>
  );
};

// Subcomponents for form fields
interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export const OptionButton: React.FC<OptionButtonProps> = ({
  selected,
  onClick,
  children,
  className = ''
}) => (
  <motion.button
    type="button"
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    animate={{
      scale: selected ? 1.02 : 1,
      boxShadow: selected ? '0 0 20px rgba(250, 200, 0, 0.25)' : 'none'
    }}
    transition={{ duration: 0.2 }}
    onClick={onClick}
    className={`
      w-full p-4 rounded-xl text-left transition-all duration-200
      ${selected 
        ? 'border-2 border-yellow bg-yellow/20 text-white shadow-lg' 
        : 'border border-gray-700 bg-carbon/50 text-gray-300 hover:border-yellow/50 hover:bg-carbon/70'
      }
      ${className}
    `}
  >
    <div className="flex items-center gap-3">
      <div className={`
        w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200
        ${selected ? 'border-yellow bg-yellow' : 'border-gray-500'}
      `}>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2 h-2 rounded-full bg-carbon"
          />
        )}
      </div>
      <span className="font-medium">{children}</span>
    </div>
  </motion.button>
);

interface MultiSelectOptionProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export const MultiSelectOption: React.FC<MultiSelectOptionProps> = ({
  selected,
  onClick,
  children
}) => (
  <motion.button
    type="button"
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    animate={{
      scale: selected ? 1.01 : 1,
      boxShadow: selected ? '0 0 15px rgba(250, 200, 0, 0.2)' : 'none'
    }}
    transition={{ duration: 0.2 }}
    onClick={onClick}
    className={`
      w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-3
      ${selected 
        ? 'border-2 border-yellow bg-yellow/20 text-white' 
        : 'border border-gray-700 bg-carbon/30 text-gray-400 hover:border-gray-500 hover:bg-carbon/50'
      }
    `}
  >
    <motion.div 
      animate={{
        backgroundColor: selected ? 'hsl(48, 96%, 53%)' : 'transparent',
        borderColor: selected ? 'hsl(48, 96%, 53%)' : '#4B5563'
      }}
      transition={{ duration: 0.2 }}
      className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
    >
      <motion.svg 
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: selected ? 1 : 0, 
          scale: selected ? 1 : 0 
        }}
        transition={{ duration: 0.15 }}
        className="w-3 h-3 text-carbon" 
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </motion.svg>
    </motion.div>
    <span className="text-sm font-medium">{children}</span>
  </motion.button>
);

interface SliderInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export const SliderInput: React.FC<SliderInputProps> = ({
  value,
  onChange,
  min = 1,
  max = 10,
  label
}) => {
  const getColor = (val: number) => {
    if (val <= 3) return 'text-red-400';
    if (val <= 5) return 'text-orange-400';
    if (val <= 7) return 'text-yellow';
    return 'text-green-400';
  };

  const getLabel = (val: number) => {
    if (val <= 3) return 'Baixo';
    if (val <= 5) return 'Médio';
    if (val <= 7) return 'Alto';
    if (val <= 9) return 'Muito Alto';
    return 'Máximo';
  };

  return (
    <div className="space-y-4">
      {label && (
        <label className="block text-gray-300 text-sm font-medium">{label}</label>
      )}
      <div className="flex items-center gap-4">
        <span className="text-gray-500 text-sm font-medium">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow"
        />
        <span className="text-gray-500 text-sm font-medium">{max}</span>
      </div>
      <div className="text-center">
        <p className={`font-bold text-4xl ${getColor(value)}`}>{value}</p>
        <p className="text-gray-400 text-sm mt-1">{getLabel(value)}</p>
      </div>
    </div>
  );
};
