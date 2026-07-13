import React from 'react';
import { Star, TrendingUp, Quote, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TestimonialCardProps {
  name: string;
  role: string;
  age: number;
  city: string;
  photo: string;
  quote: string;
  resultBefore: string;
  resultAfter: string;
  metric?: string;
  index?: number;
}

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
  name,
  role,
  age,
  city,
  photo,
  quote,
  resultBefore,
  resultAfter,
  metric,
  index = 0
}) => {
  return (
    <div
      className="h-full animate-fade-in hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300"
      style={{ animationDelay: `${index * 0.15}s`, animationFillMode: 'both' }}
    >
      <Card className="bg-gradient-to-br from-carbon via-carbon/90 to-carbon/70 border-yellow/20 p-6 md:p-8 h-full hover:border-yellow/40 transition-all duration-500 relative overflow-hidden group">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-yellow/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Quote icon */}
        <div className="absolute top-4 right-4 opacity-10">
          <Quote className="w-12 h-12 text-yellow" />
        </div>
        
        <div className="relative">
          {/* Stars - static */}
          <div className="flex items-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-yellow text-yellow" />
            ))}
          </div>
          
          {/* Quote */}
          <p className="text-gray-300 text-lg italic leading-relaxed mb-6">
            "{quote}"
          </p>
          
          {/* Profile */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow/30 to-yellow/10 flex items-center justify-center text-3xl border-2 border-yellow/30">
                {photo}
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-carbon" />
            </div>
            
            <div>
              <h4 className="font-bold text-white text-lg">{name}</h4>
              <p className="text-gray-400 text-sm">
                {role}, {age} anos
              </p>
              <p className="text-yellow text-xs flex items-center gap-1">
                📍 {city}
              </p>
            </div>
          </div>
          
          {/* Results comparison */}
          <div className="bg-gradient-to-r from-carbon/80 to-carbon/50 border border-yellow/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400 font-medium">RESULTADO COMPROVADO</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <span className="text-xs text-gray-500 uppercase">Antes</span>
                <p className="text-red-400 font-bold text-lg line-through">{resultBefore}</p>
              </div>
              
              <div className="text-yellow text-2xl">
                <ArrowRight className="w-6 h-6" />
              </div>
              
              <div className="flex-1 text-right">
                <span className="text-xs text-gray-500 uppercase">Depois</span>
                <p className="text-green-400 font-bold text-lg">{resultAfter}</p>
              </div>
            </div>
            
            {metric && (
              <Badge className="mt-3 w-full justify-center bg-green-500/20 text-green-400 border-green-500/30">
                {metric}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
