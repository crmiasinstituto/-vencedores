import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  File,
  Download,
  Clock,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import {
  CATEGORY_CONFIG,
  DIFFICULTY_COLOR,
  type Accelerator,
} from './types';

function fileIcon(type: string | null) {
  if (type?.includes('pdf')) return <FileText className="w-6 h-6 text-red-400" />;
  if (type?.includes('doc')) return <FileText className="w-6 h-6 text-blue-400" />;
  if (type?.includes('sheet') || type?.includes('xls'))
    return <FileText className="w-6 h-6 text-green-400" />;
  return <File className="w-6 h-6 text-white/40" />;
}

export function AcceleratorCard({
  accelerator,
  index,
  onClick,
}: {
  accelerator: Accelerator;
  index: number;
  onClick: (a: Accelerator) => void;
}) {
  const config = CATEGORY_CONFIG[accelerator.category] || CATEGORY_CONFIG.geral;
  const diffColor = accelerator.difficulty
    ? DIFFICULTY_COLOR[accelerator.difficulty]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <Card
        onClick={() => onClick(accelerator)}
        className="bg-white/5 border-white/10 rounded-2xl cursor-pointer hover:border-[#3B82F6]/30 transition-all duration-200 hover:scale-[1.02] group overflow-hidden h-full"
      >
        {accelerator.thumbnail ? (
          <div className="relative h-32 w-full overflow-hidden bg-white/5">
            <img
              src={accelerator.thumbnail}
              alt={accelerator.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {accelerator.is_featured && (
              <Badge className="absolute top-2 left-2 bg-[#3B82F6] text-black border-0 text-[10px] font-bold">
                <Sparkles className="w-3 h-3 mr-1" />
                Destaque
              </Badge>
            )}
          </div>
        ) : null}

        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            {!accelerator.thumbnail && (
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-[#3B82F6]/10 transition-colors">
                {fileIcon(accelerator.file_type)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white line-clamp-1">
                {accelerator.title}
              </p>
              {accelerator.description && (
                <p className="text-xs text-white/40 mt-1 line-clamp-2">
                  {accelerator.description}
                </p>
              )}

              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                <Badge
                  className="text-[10px] border"
                  style={{
                    backgroundColor: `${config.color}15`,
                    color: config.color,
                    borderColor: `${config.color}30`,
                  }}
                >
                  {config.label}
                </Badge>

                {diffColor && (
                  <Badge
                    className="text-[10px] border"
                    style={{
                      backgroundColor: `${diffColor}15`,
                      color: diffColor,
                      borderColor: `${diffColor}30`,
                    }}
                  >
                    {accelerator.difficulty}
                  </Badge>
                )}

                {accelerator.related_module_id && (
                  <Badge className="text-[10px] bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    Trilha
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 mt-3 text-[10px] text-white/30">
                {accelerator.setup_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {accelerator.setup_time}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {accelerator.download_count || 0}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
