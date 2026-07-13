import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

// Compact, dependency-free emoji picker. Para uma experiencia leve no
// chat — sem o overhead de uma lib (emoji-picker-react vem com ~200kb).
// Cobre as categorias que mais aparecem em conversa comercial BR.
const EMOJI_TABS: { name: string; icon: string; emojis: string[] }[] = [
  {
    name: 'Sorrisos',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','😘',
      '😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫',
      '🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔',
      '😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳',
    ],
  },
  {
    name: 'Gestos',
    icon: '👍',
    emojis: [
      '👍','👎','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇',
      '☝️','🫵','👋','🤚','🖐️','✋','🖖','👏','🙌','🫶','🤝','🙏','💪','🦾','🫳','🫴',
      '🤲','🖐️','🤜','🤛','✊','👊','💅','🤳','🦵','🦶','👂','👃','🧠','🫀','🫁','👀',
    ],
  },
  {
    name: 'Coração',
    icon: '❤️',
    emojis: [
      '❤️','🩷','🧡','💛','💚','💙','🩵','💜','🖤','🩶','🤍','🤎','❤️‍🔥','❤️‍🩹','💔','❣️',
      '💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋','😻','💍','💎','💐','🌹',
    ],
  },
  {
    name: 'Festa',
    icon: '🎉',
    emojis: [
      '🎉','🎊','🎈','🎂','🎁','🍾','🥂','🍻','🥳','🎆','🎇','✨','⭐','🌟','💫','💥',
      '🎀','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️','🎪','🎭','🎨','🎤','🎧','🎬',
    ],
  },
  {
    name: 'Trabalho',
    icon: '💼',
    emojis: [
      '💼','📈','📊','📉','💹','💰','💵','💴','💶','💷','💸','🧾','💳','🪙','📌','📍',
      '📎','🖇️','📏','📐','✂️','📂','📁','🗂️','📅','📆','🗒️','📝','✏️','🖊️','🖋️','💻',
      '📱','⌨️','🖥️','🖨️','📞','☎️','📠','📧','📨','📩','📤','📥','🔒','🔓','🔑','🗝️',
      '⏰','⏱️','⏳','📌','✅','❌','⚠️','🚀','🎯','💡','🔔','📣','📢','🆕','🆗','🆙',
    ],
  },
  {
    name: 'Sinais',
    icon: '✅',
    emojis: [
      '✅','☑️','✔️','❌','✖️','❎','⛔','🚫','💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫',
      '⚪','🟤','♠️','♣️','♥️','♦️','➕','➖','➗','✳️','✴️','❇️','〰️','💲','〽️','⚜️',
      '🔱','📛','🆗','🆒','🆕','🆓','🆙','🆑','🅰️','🅱️','🆎','🅾️','‼️','⁉️','❓','❔','❕','❗',
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  buttonClassName?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, buttonClassName }) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={buttonClassName || 'h-9 w-9 text-[#8696a0] hover:text-yellow-400 hover:bg-yellow-500/10 flex-shrink-0 transition-colors'}
          title="Emojis"
          type="button"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-[#1f2c33] border-border" side="top" align="start">
        {/* Tabs */}
        <div className="flex border-b border-border/40 px-1">
          {EMOJI_TABS.map((tab, i) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-2 text-lg transition-colors ${
                activeTab === i
                  ? 'text-white border-b-2 border-green-400 bg-white/5'
                  : 'text-white/40 hover:text-white/70'
              }`}
              type="button"
              title={tab.name}
            >
              {tab.icon}
            </button>
          ))}
        </div>
        {/* Grid */}
        <div className="grid grid-cols-8 gap-0.5 p-2 max-h-64 overflow-y-auto">
          {EMOJI_TABS[activeTab].emojis.map((emoji, i) => (
            <button
              key={`${activeTab}-${i}-${emoji}`}
              onClick={() => { onSelect(emoji); }}
              className="text-xl p-1.5 rounded hover:bg-white/10 transition-colors leading-none"
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
