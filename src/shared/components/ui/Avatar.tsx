import { initials } from '@core/utils/formatters'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: number
}

export function Avatar({ src, name, size = 40 }: AvatarProps) {
  const style = { width: size, height: size }
  if (src) {
    return <img src={src} alt={name ?? 'Avatar'} style={style} className="rounded-full object-cover" />
  }
  return (
    <div
      style={style}
      className="flex items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
    >
      {initials(name)}
    </div>
  )
}
