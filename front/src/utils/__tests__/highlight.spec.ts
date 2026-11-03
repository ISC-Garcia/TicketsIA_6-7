import { describe, expect, it } from 'vitest'
import { highlightText } from '../highlight'

const plain = (text: string) => ({ text, highlighted: false })
const mark = (text: string) => ({ text, highlighted: true })

describe('highlightText', () => {
  it('sin términos devuelve el texto completo', () => {
    expect(highlightText('sin cambios', [])).toEqual([plain('sin cambios')])
  })

  it('deja el texto igual si el término no aparece', () => {
    expect(highlightText('sin cambios', ['red'])).toEqual([plain('sin cambios')])
  })

  it('resalta un término en medio del texto', () => {
    expect(highlightText('falla el servidor hoy', ['servidor'])).toEqual([
      plain('falla el '),
      mark('servidor'),
      plain(' hoy'),
    ])
  })

  it('no distingue mayúsculas y conserva el texto original', () => {
    expect(highlightText('SERVIDOR caído', ['servidor'])).toEqual([
      mark('SERVIDOR'),
      plain(' caído'),
    ])
  })

  it('resalta solo la primera aparición', () => {
    expect(highlightText('red y red', ['red'])).toEqual([mark('red'), plain(' y red')])
  })

  it('resalta varios términos', () => {
    expect(highlightText('base de datos', ['base', 'datos'])).toEqual([
      mark('base'),
      plain(' de '),
      mark('datos'),
    ])
  })

  it('no vuelve a partir lo ya resaltado', () => {
    expect(highlightText('servidor', ['servidor', 'ser'])).toEqual([mark('servidor')])
  })
})
