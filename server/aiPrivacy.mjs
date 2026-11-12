import {geminiConfig} from './geminiConfig.mjs'
export function privateAIAllowed(env,consent) {return geminiConfig(env).privateAI && consent===true}
export function containsPersonalData(value) {
 const text=typeof value==='string' ? value : JSON.stringify(value)
 return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+\d[\d ().-]{7,}|\b(?:my resume|my cv|review (?:this|the|my|attached) (?:resume|cv)|date of birth|passport|national id)\b/i.test(text)
}

// A minimization aid, not a guarantee of anonymization. Private processing still
// requires the reviewed arrangement and per-request consent above.
export function redactContactDetails(text) {
 return text.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email removed]')
  .replace(/(?:\+\d[\d ().-]{7,}\d|\b\d{3}[- .]\d{3}[- .]\d{4}\b)/g,'[phone removed]')
}
