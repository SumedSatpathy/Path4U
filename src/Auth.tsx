import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, MailCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { ageEligibility, birthdayCutoff, passwordAcceptable } from '../shared/age.mjs'
import { failureMessage } from './api'
import { BirthDate } from './BirthDate'
import { PageContent } from './PageContent'
import { href, navigate, useUnsavedChanges } from './routes'
import { useAccount, type Location, type Preferences } from './session'
import { Logo, SearchBox } from './ui'
import './auth.css'

const statuses = ['School Student', 'Pre-University / Foundation', 'Diploma Student', 'Undergraduate Student', 'Postgraduate Student', 'PhD / Research Student', 'Intern', 'Recent Graduate', 'Employed Professional', 'Freelancer', 'Career Switcher', 'Entrepreneur', 'Other']
const interests = ['Artificial Intelligence', 'AI Engineering', 'Machine Learning', 'Data Science', 'Data Analytics', 'Computer Science', 'Software Engineering', 'Web Development', 'UI/UX Design', 'Cloud Computing', 'Cybersecurity', 'DevOps', 'Mobile Development', 'Blockchain', 'Game Development', 'Robotics', 'Internet of Things', 'Database Engineering', 'Finance', 'FinTech', 'Accounting', 'Investment', 'Business Analytics', 'Entrepreneurship', 'Marketing', 'Product Management', 'Project Management', 'E-Commerce', 'Human Resources', 'Graphic Design', 'Digital Media', 'Animation', 'Content Creation', 'Healthcare Technology', 'Education Technology', 'Engineering', 'Research', 'Sustainability']
const skillOptions = ['Python', 'JavaScript', 'TypeScript', 'React', 'SQL', 'Java', 'C++', 'Excel', 'Power BI', 'Figma', 'Git', 'Docker', 'AWS', 'Google Cloud', 'Communication', 'Research', 'Project Management']
const goals = ['Find an internship', 'Find a full-time job', 'Discover hackathons', 'Earn certifications', 'Learn new technologies', 'Improve my resume', 'Build a portfolio', 'Prepare for interviews', 'Switch careers', 'Start freelancing', 'Explore research', 'Find scholarships', 'Improve professional skills']
const emptyLocation = { country: '', region: '', city: '' }
const locationComplete = (location: Location) => Object.values(location).every(value => value.trim())
const initial: Preferences = { organization: '', field: '', stage: 'Student', interests: [], skills: [], goals: [] }

function AuthLink({ to, children }: { to: string; children: React.ReactNode }) {
  function go(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a className="text-link" href={href(to)} onClick={go}>{children}</a>
}

function Password({ label, value, onChange, autocomplete, strength = false }: { label: string; value: string; onChange: (value: string) => void; autocomplete: string; strength?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [caps, setCaps] = useState(false)
  const score = value.length >= 16 && new Set(value).size >= 9 ? 3 : passwordAcceptable(value) ? 2 : 1
  return <div className="auth-password">
    <label className="field">{label}<span className="password-control">
      <input required type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={autocomplete}
        maxLength={200} onKeyUp={event => setCaps(event.getModifierState('CapsLock'))} onBlur={() => setCaps(false)} />
      <button type="button" className="icon-button" aria-label={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()} onClick={() => setVisible(current => !current)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </span></label>
    {caps && <small className="field-help">Caps Lock is on.</small>}
    {strength && <div className="password-strength"><div aria-hidden="true"><motion.span animate={{ width: value ? (score * 100 / 3) + '%' : '0%' }} /></div><small>{value ? ['Weak', 'Fair', 'Strong'][score - 1] + ' · Length and variety estimate' : 'Use at least 12 characters.'}</small></div>}
  </div>
}

function Choices({ options, values, onChange }: { options: string[]; values: string[]; onChange: (items: string[]) => void }) {
  return <div className="auth-chips">{options.map(item => <button type="button" key={item} className="button button-secondary button-small" aria-pressed={values.includes(item)}
    onClick={() => onChange(values.includes(item) ? values.filter(value => value !== item) : [...values, item])}>{item}</button>)}</div>
}

function LocationFields({ value, onChange, required = false }: { value: Location; onChange: (value: Location) => void; required?: boolean }) {
  return <div className="auth-location">{([['country', 'Country', 'country-name'], ['region', 'State or region', 'address-level1'], ['city', 'City', 'address-level2']] as const).map(([key, label, autocomplete]) =>
    <label className="field" key={key}>{label}<input value={value[key]} autoComplete={autocomplete} maxLength={80} required={required} onChange={event => onChange({ ...value, [key]: event.target.value })} /></label>)}</div>
}

function SearchChoices({ options, values, onChange, label }: { options: string[]; values: string[]; onChange: (items: string[]) => void; label: string }) {
  const [query, setQuery] = useState('')
  const all = [...new Set([...values, ...options])]
  const filtered = all.filter(item => item.toLowerCase().includes(query.trim().toLowerCase()))
  function add() {
    const entry = query.trim().slice(0, 70)
    if (entry && !values.some(value => value.toLowerCase() === entry.toLowerCase()) && values.length < 24) onChange([...values, entry])
    setQuery('')
  }
  return <div className="auth-search-choices">
    <SearchBox embedded value={query} onChange={setQuery} label={'Search ' + label} placeholder={'Search ' + label} />
    {filtered.length ? <Choices options={filtered} values={values} onChange={items => { if (items.length <= 24) onChange(items) }} /> : <p>No matching options.</p>}
    {query.trim() && !all.some(item => item.toLowerCase() === query.trim().toLowerCase()) && <button className="button button-secondary button-small" type="button" onClick={add} disabled={values.length >= 24}>Add “{query.trim().slice(0, 70)}”</button>}
    <small className="muted">{values.length} selected · Up to 24</small>
  </div>
}

const onboardingSteps = ["Let's personalize your Path4U.", 'Where are you in your journey?', 'What are you interested in?', 'What skills do you already have?', 'What is your current skill level?', 'What are your goals?', 'Where are you based?', 'How much time can you dedicate to learning?', 'What is your course budget?']

function Onboarding({ edit }: { edit: boolean }) {
  const { session, action } = useAccount()
  const user = session?.user
  const [prefs, setPrefs] = useState<Preferences>(() => ({ ...initial, location: user?.location, ...user?.preferences }))
  const original = useRef(JSON.stringify(prefs))
  const clearProfileDirty=useUnsavedChanges(JSON.stringify(prefs) !== original.current)
  const [step, setStep] = useState(edit ? 1 : 0)
  const [dob, setDob] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { document.querySelector<HTMLElement>('.auth-form h1')?.focus() }, [step, user?.eligible])
  if (!user) return <><h1>Set up your profile</h1><p>Sign in to continue.</p><AuthLink to="/login">Sign in</AuthLink></>

  async function next(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    try {
      if (!user?.eligible) {
        if (ageEligibility(dob) !== 'eligible') return
        setBusy(true)
        await action('attest', { dob })
        setDob('')
        return
      }
      if (step === 1 && (!prefs.organization.trim() || !prefs.field.trim())) throw new Error('Enter your organization and field.')
      if (step === 2 && !prefs.interests.length) throw new Error('Select at least one interest.')
      if (step === 5 && !prefs.goals.length) throw new Error('Select at least one goal.')
      if (step === 6 && prefs.location && Object.values(prefs.location).some(Boolean) && !locationComplete(prefs.location)) throw new Error('Enter your country, region, and city.')
      if (step === onboardingSteps.length - 1) {
        setBusy(true)
        await action('onboarding', prefs)
        original.current=JSON.stringify(prefs)
        clearProfileDirty()
      }
      setStep(step + 1)
    } catch (failure) { setError(failureMessage(failure)) }
    finally { setBusy(false) }
  }

  if (step === onboardingSteps.length) return <><h1 tabIndex={-1}>Your path is ready.</h1><a className="button button-primary" href={href('/dashboard')}>Explore My Dashboard <ArrowRight size={16} /></a></>
  return <form className="auth-form" onSubmit={next} noValidate>
    <p className="eyebrow">{user.eligible ? 'Profile setup · ' + (step + 1) + ' / ' + onboardingSteps.length : 'Age eligibility'}</p>
    <h1 tabIndex={-1}>{!user.eligible ? 'Confirm your eligibility' : onboardingSteps[step]}</h1>
    {!user.eligible ? <BirthDate value={dob} onChange={setDob} /> : <>
      {step === 0 && <p>Choose what you want to learn and the opportunities you want to find.</p>}
      {step === 1 && <>
        <Choices options={statuses} values={prefs.statuses ?? []} onChange={items => setPrefs({ ...prefs, statuses: items, stage: items.some(item => /student|intern|foundation/i.test(item)) ? 'Student' : items.includes('Recent Graduate') ? 'Graduate' : items.length ? 'Professional' : prefs.stage })} />
        <label className="field">University or organization<input value={prefs.organization} maxLength={120} onChange={event => setPrefs({ ...prefs, organization: event.target.value })} /></label>
        <label className="field">Course or professional field<input value={prefs.field} maxLength={120} onChange={event => setPrefs({ ...prefs, field: event.target.value })} /></label>
      </>}
      {step === 2 && <SearchChoices key="interests" label="interests" options={interests} values={prefs.interests} onChange={items => setPrefs({ ...prefs, interests: items })} />}
      {step === 3 && <SearchChoices key="skills" label="skills" options={skillOptions} values={prefs.skills} onChange={items => setPrefs({ ...prefs, skills: items })} />}
      {step === 4 && <Choices options={['Beginner', 'Intermediate', 'Advanced', 'Not Sure']} values={prefs.level ? [prefs.level] : []} onChange={items => setPrefs({ ...prefs, level: items.at(-1) ?? '' })} />}
      {step === 5 && <Choices options={[...new Set([...goals, ...prefs.goals])]} values={prefs.goals} onChange={items => setPrefs({ ...prefs, goals: items })} />}
      {step === 6 && <>
        <LocationFields value={prefs.location ?? emptyLocation} onChange={location => setPrefs({ ...prefs, location })} />
        <label className="field">Work preference<select value={prefs.workMode ?? ''} onChange={event => setPrefs({ ...prefs, workMode: event.target.value })}><option value="">Any</option><option>Remote</option><option>Hybrid</option><option>Onsite</option></select></label>
        <label className="auth-checkbox"><input type="checkbox" checked={prefs.relocate ?? false} onChange={event => setPrefs({ ...prefs, relocate: event.target.checked })} /> Willing to relocate</label>
      </>}
      {step === 7 && <label className="field">Weekly learning time<select value={prefs.weeklyHours ?? ''} onChange={event => setPrefs({ ...prefs, weeklyHours: event.target.value })}><option value="">Skip for now</option><option>1–3 hours</option><option>4–6 hours</option><option>7–10 hours</option><option>10+ hours</option><option>Custom schedule</option></select></label>}
      {step === 8 && <label className="field">Course budget<select value={prefs.budget ?? ''} onChange={event => setPrefs({ ...prefs, budget: event.target.value })}><option value="">Skip for now</option><option>Free courses only</option>{/^(malaysia|my)$/i.test(prefs.location?.country ?? '') && <><option>Under RM100</option><option>RM100–RM500</option></>}<option>Flexible budget</option><option>Employer or university-funded</option></select></label>}
    </>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <div className="choice-row">
      {step > 0 && user.eligible && <button type="button" className="button button-secondary" disabled={busy} onClick={() => { setError(''); setStep(step - 1) }}><ArrowLeft size={16} /> Previous step</button>}
      <button className="button button-primary" disabled={busy || (!user.eligible && (ageEligibility(dob) !== 'eligible' || dob > birthdayCutoff(new Date(), 18)))} type="submit">{busy ? 'Saving…' : step === onboardingSteps.length - 1 ? 'Save my profile' : 'Continue'} <ArrowRight size={16} /></button>
    </div>
  </form>
}

export function AuthPage({ path, params }: { path: string; params: URLSearchParams }) {
  const { action, session } = useAccount()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [location, setLocation] = useState(emptyLocation)
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [verificationNeeded, setVerificationNeeded] = useState(false)
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!resendAt) { setRemaining(0); return }
    const update = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)))
    update()
    if (Date.now() >= resendAt) return
    const timer = window.setInterval(() => { update(); if (Date.now() >= resendAt) window.clearInterval(timer) }, 1000)
    return () => window.clearInterval(timer)
  }, [resendAt])
  const signup = path === '/signup'
  const forgot = path === '/forgot-password'
  const reset = path === '/reset-password'
  const callback = path === '/auth/callback'
  useEffect(() => {
    setError(''); setSent(false); setFeedback(''); setVerificationNeeded(false); setPassword(''); setConfirmation(''); setDob('')
    const title = document.querySelector<HTMLElement>('.auth-paper h1')
    if (title) { document.title = title.textContent + ' | Path4U'; title.focus() }
  }, [path])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || session?.mode !== 'live') return
    setError('')
    setFeedback('')
    setVerificationNeeded(false)
    setBusy(true)
    try {
      if ((signup || reset) && (!passwordAcceptable(password) || password !== confirmation)) throw new Error('Use at least 12 characters and enter matching passwords.')
      if (signup && (!name.trim() || !locationComplete(location))) throw new Error('Enter your name and location.')
      if (signup && ageEligibility(dob) !== 'eligible') throw new Error('Enter an eligible date of birth.')
      if (callback) {
        const type = params.get('type')
        const result = await action<{ recovery?: boolean; user: { eligible: boolean; preferences: Preferences | null } | null }>(params.has('code')?'exchange':'verify', params.has('code')?{code:params.get('code')}:{ token: params.get('token_hash'), type })
        clearAuthDirty()
        navigate(result.recovery || type === 'recovery' ? '/reset-password' : result.user?.eligible && result.user.preferences ? '/dashboard' : '/onboarding', undefined, { replace: true })
      } else if (signup || forgot) {
        await action(signup ? 'signup' : 'forgot', signup ? { email, name, dob, location, password, confirmation, terms } : { email })
        setSent(true); setPassword(''); setConfirmation(''); setDob(''); setResendAt(Date.now() + 60_000)
      } else if (reset) {
        await action('reset', { password, confirmation })
        clearAuthDirty()
        navigate('/login', undefined, { replace: true })
      } else {
        const result = await action<{ user: { eligible: boolean; preferences: Preferences | null } | null }>('login', { email, password })
        clearAuthDirty()
        navigate(result.user?.eligible && result.user.preferences ? '/dashboard' : '/onboarding', undefined, { replace: true })
      }
    } catch (failure) {
      setError(failureMessage(failure))
      if (failure && typeof failure === 'object' && 'code' in failure && failure.code === 'email_not_confirmed') setVerificationNeeded(true)
      if (failure && typeof failure === 'object' && 'retryAfter' in failure && typeof failure.retryAfter === 'number') setResendAt(Date.now() + Math.min(300, Math.max(1, failure.retryAfter)) * 1000)
    }
    finally { setBusy(false) }
  }

  async function resend() {
    if (Date.now() < resendAt) { setFeedback('Wait one minute before requesting another email.'); return }
    if (busy) return
    setBusy(true); setError(''); setFeedback(''); setResendAt(Date.now() + 60_000)
    try {
      await action('resend', { email })
      setResendAt(Date.now() + 60_000)
      setFeedback('If confirmation is pending, another email is on its way.')
    } catch (failure) {
      setError(failureMessage(failure))
      if (failure && typeof failure === 'object' && 'retryAfter' in failure && typeof failure.retryAfter === 'number') setResendAt(Date.now() + Math.min(300, Math.max(1, failure.retryAfter)) * 1000)
    }
    finally { setBusy(false) }
  }

  const clearAuthDirty=useUnsavedChanges(!sent && Boolean(email || name || password || confirmation || dob || Object.values(location).some(Boolean)))
  const heading = signup ? 'Create your account' : forgot ? 'Reset your password' : reset ? 'Set a new password' : callback ? 'Finish verification' : 'Welcome back'
  return <main className="auth-layout">
    <aside className="auth-brand"><Logo /><h2>Your future.<br />Your path.</h2><p>Discover opportunities. Build skills. Shape your future.</p><div className="auth-orbit-ring" aria-hidden="true" /></aside>
    <section className="auth-paper panel"><PageContent>
      {path === '/onboarding' ? <Onboarding edit={params.get('edit') === '1'} /> : sent ?
        <div className="auth-form"><MailCheck size={32} /><h1>Check your inbox</h1>
          <p>{signup ? 'Check your email to verify your account. Follow the link in the browser where you signed up. If an account already exists, try signing in or resetting your password.' : 'If the address is registered, we’ll send a link to reset your password.'}</p>
          {signup && <button className="button button-secondary" type="button" disabled={busy || remaining > 0} onClick={() => void resend()}>{remaining ? `Resend available in ${remaining}s` : 'Resend verification'}</button>}
          <button className="button button-ghost" type="button" onClick={() => setSent(false)}>Change email</button>
          <p role="status">{feedback}</p>{error && <p role="alert" className="field-error">{error}</p>}
          <AuthLink to="/login">Sign in</AuthLink>
        </div> :
        <motion.form key={path} className="auth-form" noValidate onSubmit={submit} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}>
          <h1 tabIndex={-1}>{heading}</h1>
          <p>{signup ? 'Start your journey with Path4U.' : callback ? 'Continue to exchange your one-time link for a secure session.' : forgot ? 'Enter the email associated with your account.' : reset ? 'Choose a password with at least 12 characters.' : 'Your next opportunity is waiting.'}</p>
          {session?.mode !== 'live' && <p role="status" className="auth-notice">Accounts are unavailable here. <a className="text-link" href={href('/dashboard', new URLSearchParams({ demo: '1' }))}>Try the free demo</a></p>}
          {signup && <label className="field">Full name<input value={name} maxLength={100} onChange={event => setName(event.target.value)} autoComplete="name" /></label>}
          {!reset && !callback && <label className="field">Email address<input type="email" value={email} onChange={event => { setEmail(event.target.value); setVerificationNeeded(false); setError(''); setFeedback('') }} autoComplete="email" /></label>}
          {signup && <><BirthDate value={dob} onChange={setDob} /><LocationFields value={location} onChange={setLocation} required /></>}
          {!forgot && !callback && <Password label="Password" value={password} onChange={setPassword} autocomplete={signup || reset ? 'new-password' : 'current-password'} strength={signup || reset} />}
          {(signup || reset) && <Password label="Confirm password" value={confirmation} onChange={setConfirmation} autocomplete="new-password" />}
          {confirmation && password !== confirmation && <small className="field-error">The passwords don’t match.</small>}
          {signup && <div className="auth-terms"><label><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} /> I accept the Terms and Privacy Policy.</label><span><AuthLink to="/terms">Terms</AuthLink> · <AuthLink to="/privacy">Privacy Policy</AuthLink></span></div>}
          {error && <p role="alert" className="field-error">{error}</p>}
          {path === '/login' && verificationNeeded && <button className="button button-secondary" type="button" disabled={busy || remaining > 0} onClick={() => void resend()}>{remaining ? `Resend available in ${remaining}s` : 'Resend verification'}</button>}
          {path === '/login' && feedback && <p role="status">{feedback}</p>}
          {callback && error && <p><AuthLink to="/forgot-password">Request a new reset link</AuthLink> · <AuthLink to="/login">Sign in after verification</AuthLink></p>}
          {reset && session?.mode === 'live' && !session.recovery && <p className="field-error">Open a recovery email link to set a new password.</p>}
          <button className="button button-primary" type="submit" disabled={busy || session?.mode !== 'live' || (signup && (ageEligibility(dob) !== 'eligible' || dob > birthdayCutoff(new Date(), 18) || !terms || !locationComplete(location))) || (reset && !session?.recovery)}>
            {busy ? 'Please wait…' : signup ? 'Create account' : forgot ? 'Send reset link' : reset ? 'Set password' : callback ? 'Continue' : 'Sign in'} <ArrowRight size={16} />
          </button>
          <div className="auth-links">{path === '/login' ? <><AuthLink to="/forgot-password">Forgot password?</AuthLink><AuthLink to="/signup">Create account</AuthLink></> : <AuthLink to="/login">Sign in</AuthLink>}</div>
        </motion.form>}
    </PageContent></section>
  </main>
}
