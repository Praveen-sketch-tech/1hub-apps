import { forwardRef, type SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, className='', id, children, ...props }, ref) {
  const inputId=id ?? props.name
  return <div className="tool-field">{label&&<label htmlFor={inputId} className="tool-field__label">{label}</label>}<select ref={ref} id={inputId} className={`tool-control ${error?'tool-control--error':''} ${className}`} {...props}>{children}</select>{error&&<span className="tool-field__error">{error}</span>}</div>
})
