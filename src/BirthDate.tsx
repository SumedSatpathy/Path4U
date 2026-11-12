import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { ageEligibility, birthdayCutoff, parseBirthday } from '../shared/age.mjs'
import { Dialog } from './ui'

const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1))))
const iso = (y: number, m: number, d: number) => [y, m, d].map(value => String(value).padStart(2, '0')).join('-')

export function BirthDate({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId()
  const limit = parseBirthday(birthdayCutoff())!
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(limit.year)
  const [month, setMonth] = useState(limit.month)
  const [focusDay, setFocusDay] = useState(limit.day)
  const currentDay = useRef<HTMLButtonElement>(null)
  const stage = ageEligibility(value)
  const monthLength = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const lastEnabled = year === limit.year && month === limit.month ? limit.day : monthLength
  const cursor = Math.min(focusDay, lastEnabled)
  const blanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const minYear = 1900

  function jump(y: number, m: number, d: number, focus = false) {
    const date = new Date(Date.UTC(y, m - 1, d))
    const next = iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
    if (date.getUTCFullYear() < minYear || next > birthdayCutoff()) return
    setYear(date.getUTCFullYear())
    setMonth(date.getUTCMonth() + 1)
    setFocusDay(date.getUTCDate())
    if (focus) requestAnimationFrame(() => currentDay.current?.focus())
  }

  function shiftMonth(by: number, focus = false) {
    jump(year, month + by, 1, focus)
  }

  function dayKey(event: KeyboardEvent, day: number) {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (delta !== undefined) { event.preventDefault(); jump(year, month, day + delta, true) }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      shiftMonth(event.key === 'PageUp' ? -1 : 1, true)
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
      jump(year, month, day - weekday + (event.key === 'End' ? 6 : 0), true)
    }
  }

  return <div className="dob-field">
    <label htmlFor={id}>Date of birth</label>
    <div className="dob-input">
      <input id={id} autoComplete="bday" inputMode="text" placeholder="YYYY-MM-DD" value={value} maxLength={10}
        aria-describedby={id + '-feedback'} aria-invalid={Boolean(value && stage !== 'eligible')} onChange={event => onChange(event.target.value)} />
      <button className="icon-button" type="button" aria-label="Select your birthday" aria-haspopup="dialog" onClick={() => {
        const parsed = parseBirthday(value)
        const selected = stage === 'eligible' && parsed && parsed.year >= minYear ? parsed : limit
        setYear(selected.year); setMonth(selected.month); setFocusDay(selected.day); setOpen(true)
      }}><CalendarDays size={19} /></button>
    </div>
    <p id={id + '-feedback'} className={'dob-feedback ' + (stage === 'eligible' ? 'dob-success' : value.length === 10 ? 'field-error' : 'field-help')} aria-live="polite">
      {stage === 'eligible' && value > birthdayCutoff(new Date(), 18) ? 'You meet the age requirement. Registration for ages 15–17 is pending guardian consent.' :
        stage === 'eligible' ? <><Check size={15} /> You're eligible to join Path4U.</> :
        stage === 'underage' ? 'Path4U is currently available to users aged 15 and above.' :
          value.length === 10 ? 'Enter a valid birthday in YYYY-MM-DD format.' : 'Type YYYY-MM-DD or use the calendar.'}
    </p>
    <Dialog open={open} onClose={() => setOpen(false)} title="Select your birthday" description="Choose a month and year to jump directly to your date." className="birthday-dialog" initialFocusRef={currentDay}>
      <div className="calendar-heading">
        <button type="button" className="icon-button" aria-label="Previous month" disabled={year === minYear && month === 1} onClick={() => shiftMonth(-1)}><ChevronLeft size={17} /></button>
        <select className="field" aria-label="Birthday month" value={month} onChange={event => { setMonth(Number(event.target.value)); setFocusDay(1) }}>
          {months.slice(0, year === limit.year ? limit.month : 12).map((item, index) => <option key={item} value={index + 1}>{item}</option>)}
        </select>
        <select className="field" aria-label="Birthday year" value={year} onChange={event => {
          const next = Number(event.target.value)
          setYear(next); setMonth(next === limit.year ? Math.min(month, limit.month) : month); setFocusDay(1)
        }}>{Array.from({ length: limit.year - minYear + 1 }, (_, index) => limit.year - index).map(item => <option key={item}>{item}</option>)}</select>
        <button type="button" className="icon-button" aria-label="Next month" disabled={year === limit.year && month === limit.month} onClick={() => shiftMonth(1)}><ChevronRight size={17} /></button>
      </div>
      <div className="calendar-days" aria-label={months[month - 1] + ' ' + year}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}
        {Array.from({ length: blanks }, (_, index) => <span key={'gap-' + index} />)}
        {Array.from({ length: monthLength }, (_, index) => {
          const day = index + 1
          const date = iso(year, month, day)
          return <button type="button" key={date} ref={day === cursor ? currentDay : undefined} tabIndex={day === cursor ? 0 : -1}
            aria-label={months[month - 1] + ' ' + day + ', ' + year} aria-pressed={value === date} disabled={day > lastEnabled}
            onKeyDown={event => dayKey(event, day)} onClick={() => { onChange(date); setOpen(false) }}>{day}</button>
        })}
      </div>
    </Dialog>
  </div>
}
