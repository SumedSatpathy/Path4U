import type { DocumentFormat, Draft } from './documents'

type Line = { text: string; kind: 'heading' | 'body' | 'bullet' | 'table' | 'space'; level?: number; cells?: string[] }
type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean; url?: string }

function lines(markdown: string): Line[] {
  return markdown.split(/\r?\n/).flatMap<Line>(row => {
    const text = row.trim()
    if (!text) return [{ kind: 'space', text: '' }]
    if (/^\|?[\s:|-]+\|[\s:|-]+$/.test(text) && text.includes('-')) return []
    if (/^```/.test(text)) return []
    const heading = text.match(/^(#{1,6})\s+(.+)$/)
    if (heading) return [{ kind: 'heading', level: heading[1].length, text: heading[2] }]
    if (/^[-*+]\s/.test(text)) return [{ kind: 'bullet', text: text.slice(2) }]
    if (text.startsWith('|') && text.endsWith('|')) {
      const cells = text.slice(1, -1).split('|').map(cell => cell.trim()).slice(0, 12)
      return [{ kind: 'table', text: cells.join('  |  '), cells }]
    }
    return [{ kind: 'body', text }]
  })
}

function spans(text: string): Span[] {
  const markup = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g
  const result: Span[] = []
  let cursor = 0
  for (const part of text.matchAll(markup)) {
    const index = part.index ?? 0
    if (index > cursor) result.push({ text: text.slice(cursor, index) })
    result.push({ text: part[1] ?? part[2] ?? part[3] ?? part[4], bold: !!part[1], italic: !!part[2], code: !!part[3], url: part[5] })
    cursor = index + part[0].length
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor) })
  return result
}

function contentLines(draft: Draft) {
  const content = lines(draft.content)
  if (content[0]?.kind === 'heading' && content[0].level === 1) return content
  return [{ kind: 'heading', level: 1, text: draft.title } satisfies Line, ...content]
}

export async function documentBlob(draft: Draft, format: DocumentFormat) {
  const content = contentLines(draft)
  if (format === 'docx') {
    const { BorderStyle, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx')
    const font = draft.template === 'Classic Professional' ? 'Georgia' : 'Aptos'
    const paragraph = (line: Line) => new Paragraph({
      heading: line.kind === 'heading' ? line.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2 : undefined,
      border: line.kind === 'heading' && line.level !== 1 && draft.template === 'Modern Technical' ? { bottom: { style: BorderStyle.SINGLE, size: 3, color: 'AAAAAA' } } : undefined,
      bullet: line.kind === 'bullet' ? { level: 0 } : undefined,
      spacing: { after: line.kind === 'space' ? 45 : 105 },
      children: spans(line.text).map(span => span.url ? new ExternalHyperlink({
        link: span.url, children: [new TextRun({ text: span.text, style: 'Hyperlink' })],
      }) : new TextRun({ text: span.text, bold: span.bold || line.kind === 'heading', italics: span.italic, font: span.code ? 'Consolas' : font, color: '202020' })),
    })
    const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = []
    for (let index = 0; index < content.length; index++) {
      const line = content[index]
      if (!line.cells) { children.push(paragraph(line)); continue }
      const rows = [line.cells]
      while (content[index + 1]?.cells) rows.push(content[++index].cells!)
      const columns = Math.max(...rows.map(row => row.length))
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map((row, rowIndex) => new TableRow({
          tableHeader: rowIndex === 0,
          children: Array.from({ length: columns }, (_, column) => new TableCell({
            width: { size: 100 / columns, type: WidthType.PERCENTAGE },
            children: [paragraph({ kind: 'body', text: row[column] ?? '' })],
          })),
        })),
      }))
    }
    const file = new Document({ title: draft.title, creator: 'Path4U', styles: { default: { document: { run: { font, size: 22, color: '202020' } } } }, sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 950, right: 950 } } }, children }] })
    return Packer.toBlob(file)
  }

  const { jsPDF } = await import('jspdf')
  const file = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const font = draft.template === 'Classic Professional' ? 'times' : 'helvetica'
  const margin = 48
  const right = file.internal.pageSize.getWidth() - margin
  const bottom = file.internal.pageSize.getHeight() - margin
  let y = margin
  const fits = (height: number) => {
    if (y + height > bottom) { file.addPage(); y = margin }
  }
  file.setProperties({ title: draft.title, creator: 'Path4U' })
  file.setTextColor(28, 28, 28)
  for (const line of content) {
    if (line.kind === 'space') { y += 7; continue }
    if (line.cells?.length) {
      const size = 9
      const width = (right - margin) / line.cells.length
      file.setFont(font, 'normal').setFontSize(size)
      const rows = line.cells.map(cell => file.splitTextToSize(spans(cell).map(item => item.text).join(''), width - 8) as string[])
      const rowCount = Math.max(...rows.map(row => row.length))
      for (let index = 0; index < rowCount; index++) {
        fits(15)
        rows.forEach((row, column) => {
          const left = margin + column * width
          file.setDrawColor(185).rect(left, y, width, 15)
          if (row[index]) file.text(row[index], left + 4, y + 10)
        })
        y += 15
      }
      y += 2
      continue
    }
    const size = line.kind === 'heading' ? line.level === 1 ? 23 : 14 : 10.5
    const height = size * 1.45
    if (line.kind === 'heading') { fits(height * 2); y += 4 }
    const start = margin + (line.kind === 'bullet' ? 12 : 0)
    let x = start
    if (line.kind === 'bullet') {
      fits(height)
      file.setFont(font, 'normal').setFontSize(size).text('•', margin, y + size)
    }
    for (const span of spans(line.text)) {
      const family = span.code ? 'courier' : font
      const style = span.bold || line.kind === 'heading' ? 'bold' : span.italic ? 'italic' : 'normal'
      file.setFont(family, style).setFontSize(size)
      for (const word of span.text.split(/(\s+)/).filter(Boolean)) {
        if (x === start && !word.trim()) continue
        const chunks = file.getTextWidth(word) > right - start ? file.splitTextToSize(word, right - start) as string[] : [word]
        for (const chunk of chunks) {
          const width = file.getTextWidth(chunk)
          if (x + width > right) { y += height; x = start; if (!chunk.trim()) continue }
          fits(height)
          if (span.url) file.textWithLink(chunk, x, y + size, { url: span.url })
          else file.text(chunk, x, y + size)
          x += width
        }
      }
    }
    y += height + (line.kind === 'heading' ? 3 : 2)
  }
  return file.output('blob')
}
