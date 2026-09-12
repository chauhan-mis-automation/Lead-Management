import { useState } from 'react'
import { supabase } from '../supabaseClient'
import logo from '../assets/logo.jpeg'
import './Login.css'

const EyeIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {open ? (
      <>
        <path d="M2 12C2 12 5.5 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 18.5 18.5 12 18.5C5.5 18.5 2 12 2 12Z"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      </>
    ) : (
      <>
        <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M10.6 5.63C11.06 5.55 11.53 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 21.06 13.71 19.2 15.4M6.6 6.6C3.5 8.5 2 12 2 12C2 12 5.5 18.5 12 18.5C13.8 18.5 15.3 18 16.5 17.3"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.9 9.9C9.34 10.46 9 11.19 9 12C9 13.66 10.34 15 12 15C12.81 15 13.54 14.66 14.1 14.1"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </svg>
)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })

    if (signInError) {
      setError(signInError.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : signInError.message)
      setLoading(false)
      return
    }

    // block deactivated accounts even if the password was correct
    if (signInData?.user?.id) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', signInData.user.id)
        .single()

      if (profileRow && profileRow.is_active === false) {
        await supabase.auth.signOut()
        setError('This account has been deactivated. Please contact your Admin.')
        setLoading(false)
        return
      }
    }
    // on success, AuthContext + App routing handles redirect to /dashboard
  }

  return (
    <div className="login-screen">
      <div className="pipeline-panel" aria-hidden="true">
        <div className="pipeline-brand">
          <img className="brand-logo" src={logo} alt="Chauhan MIS Automation Services" />
          <span className="pipeline-brand-name">Chauhan MIS Automation Services</span>
        </div>

        <div className="pipeline-copy">
          <h1>Every lead, on track.</h1>
          <p>From capture to closure — manage your entire sales pipeline in one place.</p>
        </div>

        <div className="pipeline-viz">
          <div className="stage-track">
            <div className="stage-label stage-label-1">New</div>
            <div className="stage-label stage-label-2">Follow-up</div>
            <div className="stage-label stage-label-3">Won</div>
            <div className="rail" />
            <span className="lead-dot dot-a" />
            <span className="lead-dot dot-b" />
            <span className="lead-dot dot-c" />
            <span className="lead-dot dot-d" />
            <div className="win-ring">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 13L10 18L19 7" stroke="#0E1220" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="form-panel">
        <div className="form-card">
          <div className="mobile-brand">
            <img className="brand-logo" src={logo} alt="Chauhan MIS Automation Services" />
            <span className="pipeline-brand-name">Chauhan MIS Automation Services</span>
          </div>

          <h2>Sign in</h2>
          <p className="form-subtitle">Sign in to access your assigned leads and follow-ups.</p>

          <form onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="text-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />

            <label className="field-label" htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="text-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="eye-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="form-footnote">
            Having trouble signing in? Ask your Admin to reset your password.
          </p>
        </div>
      </div>
    </div>
  )
}
