import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export const attachmentTypes = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.txt'
const maxBytes = 2_500_000
const formats: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain' }
export type Attachment = { name: string; size: number; mime: string; text?: string; file: File }

export async function readAttachment(file: File, textOnly = false): Promise<Attachment> {
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? ''
  const mime = formats[extension]
  if (!mime || (textOnly && mime.startsWith('image/'))) throw new Error(textOnly ? 'Choose a PDF, DOCX, or text file.' : 'Choose a JPG, PNG, WebP, PDF, DOCX, or text file.')
  if (file.type && file.type !== mime && file.type !== 'application/octet-stream' && !(extension === 'docx' && file.type === 'application/zip')) throw new Error('The selected file does not match its extension.')
  if (file.size < 1 || file.size > maxBytes) throw new Error('Choose a file under 2.5 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const prefix = String.fromCharCode(...bytes.subarray(0, 12))
  const result: Attachment = { name: file.name, size: file.size, mime, file }
  if (mime.startsWith('image/')) {
    const valid = mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === 'image/png' ? prefix.startsWith('\x89PNG\r\n\x1a\n') : prefix.startsWith('RIFF') && prefix.slice(8) === 'WEBP'
    if (!valid) throw new Error('The image format does not match the selected file.')
    return result
  }
  if (extension === 'txt') {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.includes('\0')) throw new Error('Choose a UTF-8 text file.')
    result.text = text.trim().slice(0, 20_000)
  } else if (extension === 'docx') {
    if (!prefix.startsWith('PK\x03\x04')) throw new Error('Choose a valid Word document.')
    const { unzipSync, strFromU8 } = await import('fflate')
    const files = unzipSync(bytes, { filter: file => file.name === 'word/document.xml' && file.originalSize <= 750_000 })
    const entry = files['word/document.xml']
    if (!entry) throw new Error('The Word document is invalid or its content exceeds the reading limit.')
    const xml = new DOMParser().parseFromString(strFromU8(entry), 'application/xml')
    if (xml.querySelector('parsererror')) throw new Error('The Word document could not be read.')
    const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    result.text = Array.from(xml.getElementsByTagNameNS(namespace, 'p'), p => Array.from(p.getElementsByTagNameNS(namespace, 't'), t => t.textContent).join('')).join('\n').trim().slice(0, 20_000)
  } else {
    if (!prefix.startsWith('%PDF-')) throw new Error('Choose a valid PDF file.')
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
    GlobalWorkerOptions.workerSrc = workerUrl
    const doc = getDocument({ data: bytes, enableXfa: false, stopAtErrors: true })
    try {
      const pdf = await doc.promise
      if (pdf.numPages > 30) throw new Error('Choose a PDF with 30 pages or fewer.')
      let text = ''
      for (let number = 1; number <= pdf.numPages && text.length < 20_000; number++) {
        const page = await pdf.getPage(number)
        const content = await page.getTextContent()
        text += content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('') + '\n'
      }
      result.text = text.trim().slice(0, 20_000)
    } finally { await doc.destroy() }
  }
  if (!result.text && (textOnly || extension !== 'pdf')) throw new Error('No readable text was found. Try a text-based document.')
  return result
}

export async function encodeAttachment(attachment: Attachment) {
  const reader = new FileReader()
  const data = await new Promise<string>((resolve, reject) => {
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject(new Error('Attachment could not be read.'))
    reader.onerror = () => reject(new Error('Attachment could not be read.'))
    reader.readAsDataURL(attachment.file)
  })
  return { mime: attachment.mime, data }
}
