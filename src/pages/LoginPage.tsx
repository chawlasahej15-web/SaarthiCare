import { useState, type FormEvent } from 'react';
import { ArrowLeft, HeartHandshake, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, isFirebaseConfigured } from '../lib/firebase';
import { Button, Field } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      if (!isFirebaseConfigured || !auth || !db || !functions) throw new Error('Firebase is not configured. Add your Firebase project settings to .env.local, restart the app, and try again.');
      if (mode === 'register') {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await setDoc(doc(db, 'users', credential.user.uid), { uid: credential.user.uid, displayName: name.trim(), email: email.trim(), createdAt: serverTimestamp() });
        if (inviteCode.trim()) {
          const redeem = httpsCallable(functions, 'redeemInvitation');
          await redeem({ code: inviteCode.trim() });
        } else {
          const bootstrap = httpsCallable(functions, 'bootstrapPatientProfile');
          await bootstrap({ displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        if (inviteCode.trim()) {
          const redeem = httpsCallable(functions, 'redeemInvitation');
          await redeem({ code: inviteCode.trim() });
        }
      }
      navigate('/continue');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  const resetPassword = async () => {
    setError(''); setNotice('');
    if (!auth || !isFirebaseConfigured) { setError('Connect Firebase to use password reset.'); return; }
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); setNotice('Password reset email sent. Check your inbox.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not send the reset email.'); }
  };


  return <div className="login-page"><div className="login-panel"><Link to="/welcome" className="back-link"><ArrowLeft size={15} /> Back to SaarthiCare</Link><div className="login-brand"><span className="brand-mark"><HeartHandshake size={22} /></span><span>SaarthiCare<small>care, together</small></span></div><div className="login-heading"><p className="eyebrow">WELCOME TO YOUR CIRCLE</p><h1>{mode === 'login' ? 'Good to see you.' : 'Start your care circle.'}</h1><p>{mode === 'login' ? 'Sign in to continue caring, together.' : 'Create an account to begin coordinating care.'}</p></div>
      <form className="login-form" onSubmit={submit}>{mode === 'register' && <Field label="Your name"><div className="input-with-icon"><UserRound size={17} /><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></div></Field>}<Field label="Email address"><div className="input-with-icon"><Mail size={17} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></Field><Field label="Password"><div className="input-with-icon"><LockKeyhole size={17} /><input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div></Field><Field label="Invitation code (optional)" hint="Enter a code from someone in an existing care circle to join it instead of creating a new patient profile."><input className="form-input" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Paste your one-time invite code" autoCapitalize="characters" /></Field>{mode === 'login' && <button type="button" className="forgot-password" onClick={resetPassword}>Forgot password?</button>}{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}<Button type="submit" block size="lg" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? (inviteCode.trim() ? 'Sign in & join circle' : 'Sign in') : (inviteCode.trim() ? 'Create account & join circle' : 'Create account')}</Button></form>
      <p className="auth-switch">{mode === 'login' ? 'New to SaarthiCare?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
      <div className="login-security"><ShieldCheck size={16} /><span>{isFirebaseConfigured ? "Secure Firebase sign-in is enabled. Family members can join with a one-time invitation code." : "Account access is unavailable until Firebase is configured. Add your Firebase web app keys to .env.local."}</span></div>
    </div><aside className="login-aside"><div className="aside-decoration"><div className="aside-orbit" /><div className="aside-center"><HeartHandshake size={48} /></div><span className="aside-dot dot-a" /><span className="aside-dot dot-b" /></div><p className="eyebrow">ONE CIRCLE. A LITTLE MORE CARE.</p><h2>Because looking after someone is a team effort.</h2><p>Medication schedules, doctor visits and everyday updates — thoughtfully brought together for the people who matter.</p><div className="aside-quote"><span>“</span><p>Good care is built from small moments, shared with the right people.</p></div></aside></div>;
}
