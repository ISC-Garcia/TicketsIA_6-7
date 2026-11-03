import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'

import { backups, tables } from '@/mocks/database'

import BackupsTab from '../BackupsTab.vue'
import TablesTab from '../TablesTab.vue'

let mounted: VueWrapper | undefined

afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

describe('TablesTab', () => {
  it('E9-04: lista las tablas con su total real', () => {
    mounted = mount(TablesTab, { props: { tables } })

    const rows = mounted.findAll('.tables__row')
    // Encabezado, tres tablas y total.
    expect(rows).toHaveLength(5)
    expect(rows[1]!.text()).toBe('tickets99,008102 MB2026-10-28 10:14:08')
    expect(rows[3]!.text()).toContain('Sin datos')
    expect(rows[4]!.text()).toBe('Total102 MB')
  })

  it('E9-04: el panel muestra la descripción, los datos y las columnas', async () => {
    mounted = mount(TablesTab, { props: { tables }, attachTo: document.body })

    await mounted.findAll('.tables__row')[1]!.trigger('click')

    const panel = mounted.find('dialog')
    expect(panel.find('h2').text()).toBe('tickets')
    expect(panel.text()).toContain('Cada ticket de soporte')
    expect(panel.findAll('.tables__stat dd').map((value) => value.text())).toEqual([
      '99,008',
      '102 MB',
      '2026-10-28 10:14:08',
    ])
    const columns = panel
      .findAll('tbody tr')
      .map((row) => row.findAll('td').map((cell) => cell.text()))
    expect(columns[0]).toEqual([
      'id',
      'character varying(10)',
      'Identificador del ticket, como TCK-200003',
    ])
    expect(columns[2]).toEqual(['analysis', 'jsonb', '—'])
    expect(mounted.findAll('.tables__row')[1]!.classes()).toContain('tables__row--selected')

    await panel
      .findAll('button')
      .find((button) => button.text() === 'Cerrar')!
      .trigger('click')
    expect(mounted.find('dialog').exists()).toBe(false)
  })

  it('E9-04: una tabla sin descripción ni datos lo dice', async () => {
    mounted = mount(TablesTab, {
      props: { tables: [{ name: 'nueva', rows: 0, sizeBytes: 8192, columns: [] }] },
      attachTo: document.body,
    })

    await mounted.find('.tables__open').trigger('click')

    expect(mounted.find('.tables__description').text()).toBe('Sin descripción.')
    expect(mounted.findAll('.tables__stat dd')[2]!.text()).toBe('Sin datos')
  })
})

describe('BackupsTab', () => {
  it('E9-04: distingue el fallo y su reintento, con su huella SHA-256', () => {
    mounted = mount(BackupsTab, { props: { backups } })

    const rows = mounted.findAll('tbody tr')
    const cells = rows.map((row) => row.findAll('td').map((cell) => cell.text()))
    expect(cells[0]).toEqual([
      '2026-10-28 10:18:31',
      '3.6 MB',
      '1.0 s',
      'Exitoso',
      'SHA-256 9973e0fbf84110d8…',
    ])
    expect(rows[1]!.classes()).toContain('backups__row--retry')
    expect(cells[1]![0]).toBe('2026-10-27 03:00:05 Reintento')
    expect(cells[2]).toEqual([
      '2026-10-27 03:00:00',
      '—',
      '0.2 s',
      'Fallido',
      'pg_dump: error: connection to server failed',
    ])
    expect(rows[2]!.find('.backups__status--failed').exists()).toBe(true)
    expect(rows[0]!.find('.backups__detail').attributes('title')).toBe(
      `SHA-256 ${backups[0]!.sha256}`,
    )
  })

  it('E9-04: sin respaldos lo dice', () => {
    mounted = mount(BackupsTab, { props: { backups: [] } })

    expect(mounted.text()).toContain('No se ha ejecutado ningún respaldo en los últimos 7 días.')
  })
})
