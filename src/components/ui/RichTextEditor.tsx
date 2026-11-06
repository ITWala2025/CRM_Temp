import React, { useState } from 'react';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Code, RotateCcw } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter content...',
  className = '',
  disabled = false,
}) => {
  const [isPreview, setIsPreview] = useState(false);

  const applyFormat = (prefix: string, suffix: string = '') => {
    if (disabled) return;
    const textarea = document.getElementById('rich-text-area') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || 'text';
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 10);
  };

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm ${className}`}>
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            title="Bold"
            onClick={() => applyFormat('**', '**')}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => applyFormat('*', '*')}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Heading 1"
            onClick={() => applyFormat('# ', '\n')}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Heading 2"
            onClick={() => applyFormat('## ', '\n')}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-gray-300 mx-1" />
          <button
            type="button"
            title="Bullet List"
            onClick={() => applyFormat('- ', '\n')}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Numbered List"
            onClick={() => applyFormat('1. ', '\n')}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Code Block"
            onClick={() => applyFormat('```\n', '\n```')}
            disabled={disabled}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsPreview(!isPreview)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
        >
          {isPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Editor Body */}
      {isPreview ? (
        <div className="p-3 min-h-[160px] max-h-[350px] overflow-y-auto prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap font-sans bg-gray-50/50">
          {value || <span className="text-gray-400 italic">No content to preview</span>}
        </div>
      ) : (
        <textarea
          id="rich-text-area"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={6}
          className="w-full p-3 font-mono text-sm border-0 focus:ring-0 focus:outline-none resize-y min-h-[160px] text-gray-800"
        />
      )}
    </div>
  );
};

export default RichTextEditor;

