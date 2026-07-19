import type { HTMLAttributes,ReactNode } from 'react'
interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'>{title?:ReactNode;description?:ReactNode;children:ReactNode}
export function Panel({title,description,children,className='',...props}:PanelProps){return <section className={`tool-panel ${className}`} {...props}>{(title||description)&&<header className="tool-panel__header">{title&&<h2 className="tool-panel__title">{title}</h2>}{description&&<p className="tool-panel__description">{description}</p>}</header>}{children}</section>}
