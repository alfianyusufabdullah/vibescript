import React, { useRef, useEffect } from 'react';

const MAX_INPUT_HEIGHT_PX = 120;

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled: boolean;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  className = '',
  textareaRef: externalRef,
}) => {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || localRef;
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [value, textareaRef]);

  // Adjust height on text changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
    }
  }, [value, textareaRef]);

  // Render highlights for @filename or @filename:lineStart-lineEnd or @filename:lineStart
  const renderHighlightedText = (text: string) => {
    if (!text) {
      return <span className="text-zinc-400 select-none pointer-events-none">{placeholder}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    // Matches @filename:line-line or @filename:line or @filename
    const regex = /@([a-zA-Z0-9_\-.]+)(?::\d+(?:-\d+)?)?/g;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchLength = match[0].length;

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      // Render a highlighted background span with text-transparent so it takes up exact width
      // but only shows the background behind the textarea's visible text.
      parts.push(
        <span
          key={matchIndex}
          className="inline bg-zinc-200/80 rounded-sm text-transparent font-inherit select-none"
          style={{
            boxShadow: '0 0 0 2px rgba(228, 228, 231, 0.8), 0 0 0 3px rgba(212, 212, 216, 0.6)',
            padding: '0',
            margin: '0',
          }}
        >
          {match[0]}
        </span>,
      );

      lastIndex = matchIndex + matchLength;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // Preserve trailing newline for height alignment
    if (text.endsWith('\n')) {
      parts.push('\n ');
    }

    return parts;
  };

  return (
    <div className="relative w-full min-h-[24px] flex items-end">
      {/* Backdrop for highlights - text is transparent so it doesn't double-render, only backgrounds show */}
      <div
        ref={backdropRef}
        className={`absolute inset-x-0 bottom-0 top-0 pointer-events-none whitespace-pre-wrap break-words overflow-hidden text-xs leading-relaxed text-transparent pr-9 py-0.5 max-h-[${MAX_INPUT_HEIGHT_PX}px]`}
        style={{
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          padding: '2px 36px 2px 0px',
          margin: '0',
        }}
      >
        {renderHighlightedText(value)}
      </div>

      {/* Actual interactive textarea - text is visible here */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} relative w-full bg-transparent border-0 outline-none resize-none leading-relaxed pr-9 py-0.5 max-h-[${MAX_INPUT_HEIGHT_PX}px] focus:ring-0 focus:outline-none`}
        style={{
          boxSizing: 'border-box',
          color: 'inherit', // Normal visible text color
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          padding: '2px 36px 2px 0px',
          margin: '0',
          height: 'auto',
        }}
      />
    </div>
  );
};
