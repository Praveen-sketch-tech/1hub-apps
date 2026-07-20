import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className = '', id, ...props },
  ref,
) {
  const inputId = id ?? props.name
  return (
    <div className="tool-field">
      {label && <label htmlFor={inputId} className="tool-field__label">{label}</label>}
      <textarea
        ref={ref}
        id={inputId}
        className={`tool-control tool-textarea ${error ? 'tool-control--error' : ''} ${className}`}
        {...props}
      />
      {error && <span className="tool-field__error">{error}</span>}
    </div>
  )
})
