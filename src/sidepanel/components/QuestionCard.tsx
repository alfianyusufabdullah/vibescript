import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface QuestionCardProps {
  question: string;
  options?: string[];
  onSubmit: (answer: string) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, options, onSubmit }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (answer: string) => {
    const trimmed = answer.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(inputValue);
    }
  };

  return (
    <div className="animate-slide-up border border-zinc-200 border-b-0 rounded-lg rounded-b-none bg-white px-3 pt-3 pb-3 space-y-2.5 shadow-sm">
      <p className="text-sm font-semibold text-zinc-800 leading-snug">{question}</p>

      {options && options.length > 0 && (
        <div className="flex flex-col divide-y divide-zinc-100 border border-zinc-200 rounded-md overflow-hidden">
          {options.map((opt, i) => (
            <button
              key={opt}
              onClick={() => submit(opt)}
              className="flex items-center gap-2.5 px-3 py-2 text-left text-xs text-zinc-700 bg-white hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <span className="flex-shrink-0 w-4 h-4 rounded-full border border-zinc-300 flex items-center justify-center text-[9px] text-zinc-400 font-medium">
                {i + 1}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={options && options.length > 0 ? 'Atau ketik jawaban lain...' : 'Ketik jawaban...'}
          className="h-7 text-xs"
        />
        <Button
          size="sm"
          onClick={() => submit(inputValue)}
          disabled={!inputValue.trim()}
          className="h-7 w-7 p-0 flex-shrink-0"
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};
