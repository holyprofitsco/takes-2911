import { useState } from 'react'
import { Logo } from '../ui/icons'

interface Props {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
}

export function SignIn({ signIn, signUp }: Props) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  return (
    <main className="signin">
      <form
        className="signin-card"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setMessage('')
          try {
            if (mode === 'in') await signIn(email, password)
            else if (await signUp(email, password)) {
              setMessage('Check your email for a link to confirm your account, then sign in here.')
              setMode('in')
            }
          } catch (err) {
            setMessage(friendly(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Logo size={48} />
        <h1>{mode === 'in' ? 'Sign in to Takes' : 'Create your account'}</h1>
        <p className="row-sub">Your videos, scripts and stats are saved to your account, so every browser and your phone see the same thing.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {message && (
          <p className="signin-message" role="status">
            {message}
          </p>
        )}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="btn-quiet" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </main>
  )
}

function friendly(err: unknown) {
  const text = err instanceof Error ? err.message : String(err)
  if (/invalid login/i.test(text)) return "That email and password don't match."
  if (/not confirmed/i.test(text)) return 'Confirm your email first. The link is in your inbox.'
  if (/already registered/i.test(text)) return 'That email already has an account. Sign in instead.'
  if (/fetch|network/i.test(text)) return "Can't reach the internet right now. Try again in a moment."
  return text
}
