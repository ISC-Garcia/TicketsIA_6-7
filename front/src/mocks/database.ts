import type { Backup, DatabaseTable } from '@/types/database'

export const tables: DatabaseTable[] = [
  {
    name: 'tickets',
    rows: 99217,
    size: '312 MB',
    modifiedAt: '2026-10-28 10:14:08',
    description:
      'Registro principal de cada ticket de soporte: datos capturados, prioridad, estado, técnico asignado y tiempos.',
    columns: [
      {
        name: 'id_ticket',
        type: 'Texto',
        description: 'Identificador del ticket, por ejemplo TCK-200003',
      },
      { name: 'area_solicitante', type: 'Texto', description: 'Área que reporta el problema' },
      { name: 'descripcion', type: 'Texto largo', description: 'Descripción que analiza la IA' },
      {
        name: 'dispositivo_afectado',
        type: 'Texto',
        description: 'Dispositivo reportado o detectado',
      },
      { name: 'prioridad', type: 'Texto', description: 'Crítica, Alta, Media o Baja' },
      { name: 'estado', type: 'Texto', description: 'Abierto, En atención o Resuelto' },
      { name: 'tecnico_asignado', type: 'Texto', description: 'Usuario responsable' },
      { name: 'fecha_creacion', type: 'Fecha y hora', description: 'Momento del registro' },
      {
        name: 'tiempo_resolucion_horas',
        type: 'Decimal',
        description: 'Horas desde el registro hasta la resolución',
      },
    ],
  },
  {
    name: 'clasificaciones_ia',
    rows: 99217,
    size: '96 MB',
    modifiedAt: '2026-10-28 09:57:05',
    description:
      'Resultado del modelo de Machine Learning y del análisis de lenguaje para cada ticket.',
    columns: [
      { name: 'id_ticket', type: 'Texto', description: 'Ticket clasificado' },
      { name: 'prioridad_predicha', type: 'Texto', description: 'Clase asignada por el modelo' },
      { name: 'confianza', type: 'Decimal', description: 'Probabilidad de la clase asignada' },
      { name: 'probabilidades', type: 'JSON', description: 'Probabilidad por clase' },
      { name: 'departamento_sugerido', type: 'Texto', description: 'Departamento inferido' },
      { name: 'sentimiento', type: 'Texto', description: 'Positivo, Neutral o Negativo' },
      {
        name: 'entidades',
        type: 'JSON',
        description: 'Dispositivos y códigos de error detectados',
      },
      {
        name: 'palabras_clave',
        type: 'JSON',
        description: 'Términos relevantes de la descripción',
      },
      { name: 'fecha_clasificacion', type: 'Fecha y hora', description: 'Momento del análisis' },
    ],
  },
  {
    name: 'bitacora_tickets',
    rows: 312480,
    size: '74 MB',
    modifiedAt: '2026-10-28 10:14:08',
    description:
      'Registro cronológico de los eventos del sistema: altas, clasificaciones, cambios de estado, reasignaciones, ediciones y sesiones.',
    columns: [
      { name: 'id_evento', type: 'Entero', description: 'Identificador del evento' },
      { name: 'fecha_hora', type: 'Fecha y hora', description: 'Momento del evento' },
      { name: 'usuario', type: 'Texto', description: 'Usuario que realizó la acción, o Sistema' },
      { name: 'tipo_evento', type: 'Texto', description: 'Categoría del evento' },
      { name: 'id_ticket', type: 'Texto', description: 'Ticket relacionado, si aplica' },
      { name: 'detalle', type: 'Texto', description: 'Descripción del evento' },
      { name: 'valor_anterior', type: 'JSON', description: 'Valores previos en ediciones' },
      { name: 'valor_nuevo', type: 'JSON', description: 'Valores nuevos en ediciones' },
    ],
  },
  {
    name: 'usuarios',
    rows: 4,
    size: '0.1 MB',
    modifiedAt: '2026-10-20 16:12:40',
    description: 'Cuentas con acceso al sistema y su rol.',
    columns: [
      { name: 'usuario', type: 'Texto', description: 'Nombre de usuario' },
      { name: 'nombre', type: 'Texto', description: 'Nombre completo' },
      { name: 'rol', type: 'Texto', description: 'Técnico de TI, Coordinador o Auditor' },
      { name: 'estado', type: 'Texto', description: 'Activo o Inactivo' },
      { name: 'fecha_alta', type: 'Fecha y hora', description: 'Creación de la cuenta' },
    ],
  },
  {
    name: 'sesiones',
    rows: 1286,
    size: '3.9 MB',
    modifiedAt: '2026-10-28 09:58:12',
    description: 'Inicios y cierres de sesión de los usuarios del sistema.',
    columns: [
      { name: 'id_sesion', type: 'Entero', description: 'Identificador de la sesión' },
      { name: 'usuario', type: 'Texto', description: 'Usuario de la sesión' },
      { name: 'inicio', type: 'Fecha y hora', description: 'Inicio de sesión' },
      { name: 'cierre', type: 'Fecha y hora', description: 'Cierre de sesión' },
      { name: 'duracion_min', type: 'Entero', description: 'Duración en minutos' },
    ],
  },
]

export const backups: Backup[] = [
  { date: '2026-10-28 03:00', size: '486 MB', duration: '2 min 14 s', status: 'Exitoso' },
  { date: '2026-10-27 03:00', size: '485 MB', duration: '2 min 12 s', status: 'Exitoso' },
  { date: '2026-10-26 03:00', size: '484 MB', duration: '2 min 11 s', status: 'Exitoso' },
  {
    date: '2026-10-25 03:00',
    size: '482 MB',
    duration: '15 min 00 s',
    status: 'Fallido',
    detail: 'Tiempo de espera agotado',
  },
  {
    date: '2026-10-25 03:20',
    size: '482 MB',
    duration: '2 min 20 s',
    status: 'Exitoso',
    detail: 'Reintento exitoso a las 03:20',
    isRetry: true,
  },
  { date: '2026-10-24 03:00', size: '481 MB', duration: '2 min 09 s', status: 'Exitoso' },
  { date: '2026-10-23 03:00', size: '480 MB', duration: '2 min 08 s', status: 'Exitoso' },
  { date: '2026-10-22 03:00', size: '478 MB', duration: '2 min 06 s', status: 'Exitoso' },
]
