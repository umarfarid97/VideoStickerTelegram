import React, { useState } from 'react';
import { Send, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export const TelegramBotGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCommand = (cmd: string, index: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const steps = [
    {
      num: 1,
      title: 'Open Telegram & Start @Stickers',
      desc: 'Open Telegram and search for the official sticker management bot: ',
      command: '@Stickers',
      actionText: 'open bot',
      link: 'https://t.me/Stickers',
    },
    {
      num: 2,
      title: 'Create a New Video Sticker Pack',
      desc: 'Send this command to create a new animated/video sticker pack: ',
      command: '/newvideo',
    },
    {
      num: 3,
      title: 'Name Your Sticker Pack',
      desc: 'Type a title for your pack (e.g., "My Cool Memes").',
    },
    {
      num: 4,
      title: 'Send the Downloaded .webm File',
      desc: 'Important: Attach the .webm file as a Document / File (do not send as regular compressed video!).',
    },
    {
      num: 5,
      title: 'Assign an Emoji & Publish',
      desc: 'Send an emoji that corresponds to your sticker (e.g. ⭐ or 😂), then send ',
      command: '/publish',
    },
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white m-0">
              How to upload your WebM sticker to Telegram
            </h4>
            <p className="text-xs text-slate-400 m-0">
              Step-by-step instructions for the Telegram @Stickers bot
            </p>
          </div>
        </div>

        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 space-y-3 text-xs">
          {steps.map((step, idx) => (
            <div
              key={step.num}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40"
            >
              <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-xs">
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white mb-0.5">{step.title}</div>
                <div className="text-slate-300">
                  {step.desc}
                  {step.command && (
                    <div className="inline-flex items-center gap-1.5 ml-1 mt-1">
                      <code className="font-mono bg-slate-950 px-2 py-0.5 rounded text-sky-300 border border-slate-800">
                        {step.command}
                      </code>
                      <button
                        onClick={() => copyCommand(step.command, idx)}
                        className="p-1 hover:text-white text-slate-400 rounded transition"
                        title="Copy command"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-sky-400 underline hover:text-sky-300"
                    >
                      Open @Stickers
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
