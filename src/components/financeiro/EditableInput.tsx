import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface EditableInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  type?: 'number' | 'slider' | 'currency' | 'percentage';
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}

export function EditableInput({
  label,
  value,
  onChange,
  type = 'number',
  min = 0,
  max = 100,
  step = 1,
  prefix,
  suffix
}: EditableInputProps) {
  if (type === 'slider') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">{label}</Label>
          <span className="text-sm font-medium text-primary">
            {prefix}{value}{suffix}
          </span>
        </div>
        <Slider
          value={[value]}
          onValueChange={(v) => onChange(v[0])}
          min={min}
          max={max}
          step={step}
          className="w-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className={`bg-white/5 border-white/10 ${prefix ? 'pl-10' : ''} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
