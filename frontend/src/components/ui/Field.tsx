import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

interface FieldWrapperProps {
  label: string;
  action?: ReactNode;
  error?: string | null;
  children: ReactNode;
}

export function Field({ label, action, error, children }: FieldWrapperProps) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        {action}
      </div>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />;
}
