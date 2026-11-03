// Nombre y primer apellido: en nombres completos, el apellido paterno es la penúltima palabra.
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/)
  const surname = words.length > 2 ? words[words.length - 2] : words[1]

  return [words[0], surname]
    .filter(Boolean)
    .map((word) => word!.charAt(0).toUpperCase())
    .join('')
}
