import { forwardRef, useState, type ComponentProps } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

import { Input } from './Input';

type PasswordInputProps = ComponentProps<typeof Input>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (props, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          {...props}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
          tabIndex={-1}
        >
          {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';