export type SortKey = 'name' | 'size' | 'type' | 'modified'
export type SortDirection = 'asc' | 'desc'

export interface FileRecord {
  id: string
  file: File
  name: string
  size: number
  type: string
  extension: string
  modified: number
  hash?: string
  duplicateGroup?: string
}

export interface RenameRules {
  prefix: string
  suffix: string
  find: string
  replace: string
  useRegex: boolean
  startNumber: number
  pad: number
  addSequence: boolean
}
