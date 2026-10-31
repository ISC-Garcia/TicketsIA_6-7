export interface TableColumn {
  name: string
  type: string
  description: string
}

export interface DatabaseTable {
  name: string
  rows: number
  size: string
  modifiedAt: string
  description: string
  columns: TableColumn[]
}

export interface Backup {
  date: string
  size: string
  duration: string
  status: 'Exitoso' | 'Fallido'
  detail?: string
  isRetry?: boolean
}
