import { ArrowLeft } from 'lucide-react'
import { goBack } from './routes'

export function BackButton() {
  return <button type="button" className="button button-ghost page-back-button" onClick={goBack}><ArrowLeft size={17} aria-hidden="true" /><span>Back</span></button>
}
