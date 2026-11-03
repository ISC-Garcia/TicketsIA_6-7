export interface TextSegment {
  text: string
  highlighted: boolean
}

function splitSegment(segment: TextSegment, term: string): TextSegment[] {
  if (segment.highlighted) return [segment]

  const index = segment.text.toLowerCase().indexOf(term.toLowerCase())

  if (index < 0) return [segment]

  const end = index + term.length

  return [
    { text: segment.text.slice(0, index), highlighted: false },
    { text: segment.text.slice(index, end), highlighted: true },
    { text: segment.text.slice(end), highlighted: false },
  ].filter((part) => part.text)
}

export function highlightText(text: string, terms: string[]): TextSegment[] {
  let segments: TextSegment[] = [{ text, highlighted: false }]

  for (const term of terms) {
    segments = segments.flatMap((segment) => splitSegment(segment, term))
  }

  return segments
}
