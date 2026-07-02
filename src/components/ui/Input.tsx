import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  startElement?: ReactNode;
  errorText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ startElement, errorText, className = '', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        <div className="relative flex items-center">
          {startElement && (
            <div className="absolute left-3 text-gray-400 pointer-events-none">
              {startElement}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-white border rounded-md py-2 text-sm text-gray-900 transition-shadow outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500
              ${startElement ? 'pl-9 pr-3' : 'px-3'}
              ${errorText ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
              ${className}
            `}
            {...props}
          />
        </div>
        {errorText && <span className="text-xs text-red-500 font-medium">{errorText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';