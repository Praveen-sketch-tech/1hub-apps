import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, className = '', id, ...props }, ref) {
  const inputId = id ?? props.name
  return (
    <div className="tool-field">
      {label && <label htmlFor={inputId} className="tool-field__label">{label}</label>}
      <input ref={ref} id={inputId} className={`tool-input ${error ? 'tool-control--error' : ''} ${className}`.trim()} {...props} />
      {error && <span className="tool-field__error">{error}</span>}
    </div>
  )
})
