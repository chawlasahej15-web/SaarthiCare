import { useState } from 'react';
import { BellRing, Check, Eye, Mail, ShieldCheck, Type, Vibrate } from 'lucide-react';
import { useSaarthiCare } from '../context/SaarthiCareContext';
import { Badge, Card, SectionHeading } from '../components/ui';
import { isFirebaseConfigured } from '../lib/firebase';
import { registerBrowserPush, unregisterBrowserPush } from '../services/firebasePush';

const preferenceRows = [
  { key: 'emailMedicationReminders', label: 'Upcoming medication reminders', description: 'A gentle email before a scheduled dose.', icon: Mail },
  { key: 'emailMissedDoseAlerts', label: 'Missed-dose alerts', description: 'Let the care circle know when a dose is overdue.', icon: BellRing },
  { key: 'emailAppointmentReminders', label: 'Appointment reminders', description: 'A heads-up before a doctor visit.', icon: BellRing },
  { key: 'pushNotifications', label: 'Push notifications', description: 'In-app and device alerts where supported.', icon: Vibrate },
] as const;

export function SettingsPage() {
  const { state, setPreference, setTextScale } = useSaarthiCare();
  const [pushBusy, setPushBusy] = useState(false);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (state.preferences.pushNotifications) {
        await unregisterBrowserPush();
        setPreference('pushNotifications', false);
      } else {
        await registerBrowserPush(state.patientId, state.currentUserId);
        setPreference('pushNotifications', true);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not update browser notifications.');
    } finally {
      setPushBusy(false);
    }
  };
  return <div className="page-stack">
    <SectionHeading eyebrow="MAKE CARE FEEL COMFORTABLE" title="Preferences" description="Choose how SaarthiCare keeps you informed and make the experience easier to use." />
    <Card className="settings-card"><div className="settings-section-heading"><div className="settings-icon"><BellRing size={19} /></div><div><h2>Notifications</h2><p>Choose which updates you and your care circle receive.</p></div><Badge tone="info">Your preferences</Badge></div><div className="settings-options">{preferenceRows.map(({ key, label, description, icon: Icon }) => <div className="settings-option" key={key}><span className="settings-option-icon"><Icon size={17} /></span><div className="settings-option-copy"><strong>{label}</strong><span>{description}</span></div><button className={`toggle ${state.preferences[key] ? 'toggle-on' : ''}`} role="switch" aria-checked={state.preferences[key]} aria-label={label} disabled={key === 'pushNotifications' ? (!isFirebaseConfigured || pushBusy) : false} onClick={() => key === 'pushNotifications' ? void togglePush() : setPreference(key, !state.preferences[key])}><span /></button></div>)}</div><p className="settings-footnote"><ShieldCheck size={15} /> {isFirebaseConfigured ? 'Preferences are saved to your care-circle membership. Email reminders are delivered by the scheduled Firebase function through Resend; push alerts require a VAPID key and browser permission.' : 'Connect Firebase and enable Resend/VAPID to deliver email and device notifications.'}</p></Card>
    <Card className="settings-card"><div className="settings-section-heading"><div className="settings-icon lavender"><Type size={19} /></div><div><h2>Reading comfort</h2><p>Adjust text size for a more comfortable experience.</p></div></div><div className="text-size-choices"><button className={state.textScale === 'normal' ? 'selected' : ''} onClick={() => setTextScale('normal')}><span className="size-sample normal">Aa</span><span>Standard</span>{state.textScale === 'normal' && <Check size={15} />}</button><button className={state.textScale === 'large' ? 'selected' : ''} onClick={() => setTextScale('large')}><span className="size-sample large">Aa</span><span>Large</span>{state.textScale === 'large' && <Check size={15} />}</button><button className={state.textScale === 'largest' ? 'selected' : ''} onClick={() => setTextScale('largest')}><span className="size-sample largest">Aa</span><span>Largest</span>{state.textScale === 'largest' && <Check size={15} />}</button></div><div className="accessibility-callout"><Eye size={16} /><span>SaarthiCare uses readable contrast, clear labels and keyboard-friendly controls. Medication states are labelled with text as well as colour.</span></div></Card>
  </div>;
}
