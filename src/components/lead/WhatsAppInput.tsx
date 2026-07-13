import React, { forwardRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { CheckCircle } from 'lucide-react';

interface WhatsAppInputProps extends React.ComponentProps<typeof Input> {
  onDDDChange?: (ddd: string) => void;
}

export const WhatsAppInput = forwardRef<HTMLInputElement, WhatsAppInputProps>(
  ({ onDDDChange, onChange, ...props }, ref) => {
    const [value, setValue] = useState('');

    const formatWhatsApp = (input: string) => {
      // Remove todos os caracteres não numéricos
      const numbers = input.replace(/\D/g, '');
      
      // Limita a 11 dígitos (2 DDD + 9 dígitos)
      const limited = numbers.slice(0, 11);
      
      // Aplica a máscara (XX) 9XXXX-XXXX
      if (limited.length <= 2) {
        return limited;
      } else if (limited.length <= 3) {
        return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
      } else if (limited.length <= 7) {
        return `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}${limited.slice(3)}`;
      } else {
        return `(${limited.slice(0, 2)}) ${limited.slice(2, 3)}${limited.slice(3, 7)}-${limited.slice(7)}`;
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formatted = formatWhatsApp(inputValue);
      setValue(formatted);

      // Detecta DDD (primeiros 2 dígitos)
      const numbers = inputValue.replace(/\D/g, '');
      if (numbers.length >= 2) {
        const ddd = numbers.slice(0, 2);
        onDDDChange?.(ddd);
      }

      // Chama o onChange original se existir
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: formatted
          }
        };
        onChange(syntheticEvent);
      }
    };

    const digits = value.replace(/\D/g, '');
    const isComplete = digits.length === 11;

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="tel"
          value={value}
          onChange={handleChange}
          placeholder="(11) 99999-9999"
          maxLength={15}
          className="bg-white/90 backdrop-blur-sm border-white/30 text-black placeholder-gray-600 focus:border-yellow focus:ring-yellow/20 pr-10"
        />
        {isComplete && (
          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
        )}
      </div>
    );
  }
);

WhatsAppInput.displayName = 'WhatsAppInput';