import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', children, style, className = '', ...props }) => {
  let bg = 'var(--surface)';
  let color = 'var(--ink)';
  let border = '1px solid var(--line)';

  if (variant === 'primary') {
    bg = 'var(--accent)';
    color = 'oklch(100% 0 0)';
    border = '1px solid var(--accent)';
  } else if (variant === 'ghost') {
    bg = 'transparent';
    color = 'var(--ink)';
    border = '1px solid transparent';
  } else if (variant === 'destructive') {
    bg = 'var(--failed)';
    color = 'oklch(100% 0 0)';
    border = '1px solid var(--failed)';
  }

  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        color: color,
        border: border,
        borderRadius: 'var(--r-cell)',
        padding: '6px 14px',
        fontWeight: 500,
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-sans)',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: 'all var(--dur-fast) var(--ease-out)',
        minHeight: '44px',
        gap: '8px',
        outline: 'none',
        ...style,
      }}
      className={`btn-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
