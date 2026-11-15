import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, CalendarPlus, CheckCircle2, Clock3, MapPin, Plus, Stethoscope, XCircle } from 'lucide-react';
import { useSaarthiCare } from '../context/SaarthiCareContext';
import { canManageAppointments } from '../services/permissions';
import { formatDate, formatTime, relativeDay } from '../lib/date';
import { Badge, Button, Card, EmptyState, Field, Modal, SectionHeading } from '../components/ui';
import type { AddAppointmentInput } from '../types';

const freshForm: AddAppointmentInput = { doctorName: '', specialty: '', dateTime: '', location: '', notes: '' };

export function AppointmentsPage() {
  const { state, addAppointment, cancelAppointment } = useSaarthiCare();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddAppointmentInput>(freshForm);
  const [showPast, setShowPast] = useState(false);
  const currentMember = state.members.find((member) => member.id === state.currentUserId);
  const mayManage = canManageAppointments(currentMember);
  const upcoming = useMemo(() => state.appointments.filter((item) => item.status === 'scheduled' && new Date(item.dateTime) >= new Date()).sort((a, b) => a.dateTime.localeCompare(b.dateTime)), [state.appointments]);
  const past = useMemo(() => state.appointments.filter((item) => item.status !== 'scheduled' || new Date(item.dateTime) < new Date()).sort((a, b) => b.dateTime.localeCompare(a.dateTime)), [state.appointments]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.doctorName.trim() || !form.dateTime) return;
    addAppointment(form);
    setForm(freshForm);
    setOpen(false);
  };

  return <div className="page-stack">
    <SectionHeading eyebrow="PLAN AHEAD, FEEL PREPARED" title="Appointments" description="Keep upcoming visits, doctor details and helpful notes together." action={<Button disabled={!mayManage} onClick={() => setOpen(true)}><CalendarPlus size={17} /> Add appointment</Button>} />
    {!mayManage && <div className="permission-banner"><span>You can view appointments. Editing is limited to the patient and authorised caregivers.</span></div>}
    <section className="appointment-overview"><Card className="appointment-overview-card"><div className="overview-icon"><CalendarDays size={19} /></div><div><strong>{upcoming.length}</strong><span>Upcoming visits</span></div></Card><Card className="appointment-overview-card"><div className="overview-icon blue"><Clock3 size={19} /></div><div><strong>{upcoming[0] ? relativeDay(upcoming[0].dateTime) : '—'}</strong><span>Next appointment</span></div></Card><Card className="appointment-overview-card"><div className="overview-icon peach"><Stethoscope size={19} /></div><div><strong>{new Set(state.appointments.map((item) => item.doctorName)).size}</strong><span>Care professionals</span></div></Card></section>
    <Card className="appointments-card"><div className="card-heading"><div><p className="eyebrow">YOUR CARE CALENDAR</p><h2>Coming up</h2><p className="card-subtitle">Appointments shared with your care circle.</p></div><Badge tone="info">{upcoming.length} scheduled</Badge></div>
      {upcoming.length ? <div className="appointment-list">{upcoming.map((item) => <article className="appointment-row" key={item.id}><div className="appointment-date-block"><strong>{new Date(item.dateTime).getDate()}</strong><span>{new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(item.dateTime))}</span></div><div className="appointment-details"><div className="appointment-title"><h3>{item.doctorName}</h3><Badge tone="success">Scheduled</Badge></div><p>{item.specialty}</p><div className="appointment-meta"><span><Clock3 size={14} /> {relativeDay(item.dateTime)} · {formatTime(item.dateTime)}</span><span><MapPin size={14} /> {item.location}</span></div>{item.notes && <div className="appointment-note">{item.notes}</div>}<small className="created-by">Added by {item.createdBy}</small></div>{mayManage && <button className="icon-button appointment-cancel" aria-label={`Cancel appointment with ${item.doctorName}`} onClick={() => cancelAppointment(item.id)}><XCircle size={18} /></button>}</article>)}</div> : <EmptyState icon={<CalendarDays size={25} />} title="Your calendar is clear" description="Add the next doctor visit so everyone in the care circle knows what’s coming up." action={mayManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Add appointment</Button>} />}
    </Card>
    <Card className="past-card"><button className="past-toggle" onClick={() => setShowPast((value) => !value)}><span>Past & cancelled appointments</span><span>{past.length}</span><span>{showPast ? '−' : '+'}</span></button>{showPast && <div className="past-list">{past.length ? past.map((item) => <div className="past-row" key={item.id}><div><strong>{item.doctorName}</strong><span>{formatDate(item.dateTime, { day: 'numeric', month: 'short', year: 'numeric' })} · {item.specialty}</span></div><Badge tone={item.status === 'cancelled' ? 'warning' : 'neutral'}>{item.status === 'scheduled' ? 'Past visit' : item.status}</Badge></div>) : <p className="muted-note">No past appointments yet.</p>}</div>}</Card>
    <div className="med-footer-note"><CheckCircle2 size={17} /><p>Appointment reminders are scheduled by the server when Firebase Functions and email delivery are configured. This local demo does not send real messages.</p></div>

    {open && <Modal title="Schedule an appointment" description="Add the details everyone in the care circle should know." onClose={() => setOpen(false)}><form className="form-stack" onSubmit={submit}>
      <Field label="Doctor’s name"><input className="form-input" required value={form.doctorName} onChange={(event) => setForm({ ...form, doctorName: event.target.value })} placeholder="Dr. Meera Kapoor" /></Field>
      <Field label="Specialty"><input className="form-input" value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} placeholder="Cardiology" /></Field>
      <Field label="Date & time"><input className="form-input" type="datetime-local" required min={new Date().toISOString().slice(0, 16)} value={form.dateTime} onChange={(event) => setForm({ ...form, dateTime: event.target.value })} /></Field>
      <Field label="Clinic / location"><input className="form-input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Clinic name and address" /></Field>
      <Field label="Notes"><textarea className="form-input textarea-input" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="What should we remember for this visit?" /></Field>
      <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit"><CalendarPlus size={16} /> Save appointment</Button></div>
    </form></Modal>}
  </div>;
}
