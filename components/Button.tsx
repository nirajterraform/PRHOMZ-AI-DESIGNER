
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold transition-all relative overflow-hidden disabled:bg-google-border disabled:text-google-gray";
  
  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-10 py-4 text-base"
  };

  const variants = {
    primary: "bg-google-blue text-google-bg hover:brightness-110 shadow-md",
    secondary: "bg-google-surface border border-google-border text-google-dark hover:bg-google-border shadow-sm",
    ghost: "bg-transparent text-google-gray hover:text-google-dark hover:bg-google-surface"
  };

  return (
    <button 
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      <span className={isLoading ? "opacity-0" : "opacity-100 flex items-center"}>{children}</span>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-google-bg/30 border-t-google-bg rounded-full animate-spin"></div>
        </div>
      )}
    </button>
  );
};
