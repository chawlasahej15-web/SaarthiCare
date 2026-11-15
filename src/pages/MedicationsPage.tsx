import { useMemo, useState, type FormEvent } from 'react';
import { Activity, Archive, CheckCircle2, Clock3, Eye, Filter, Plus, Search, ShieldCheck, Stethoscope, Pill } from 'lucide-react';
import { useSaarthiCare } from '../context/SaarthiCareContext';
import { canManageMedications } from '../services/permissions';
import { Badge, Button, Card, EmptyState, Field, Modal, SectionHeading } from '../components/ui';
import type { AddMedicationInput } from '../types';

const emptyForm: AddMedicationInput = { name: '', dosage: '', instructions: '', frequency: 'Once daily', times: ['08:00'], prescribingDoctor: '', category: 'tablet' };

export function MedicationsPage() {
  const { state, addMedication, toggleMedication } = useSaarthiCare();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'active' | 'all' | 'paused'>('active');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddMedicationInput>(emptyForm);
  const [timeText, setTimeText] = useState('08:00');
  const currentMember = state.members.find((member) => member.id === state.currentUserId);
  const mayManage = canManageMedications(currentMember);
  const visible = useMemo(() => state.medications.filter((medicine) => {
    const matchesQuery = `${medicine.name} ${medicine.prescribingDoctor}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'active' ? medicine.active : !medicine.active);
    return matchesQuery && matchesFilter;
  }), [state.medications, query, filter]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.dosage.trim()) return;
    const times = timeText.split(',').map((time) => time.trim()).filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
    if (!times.length) return;
    addMedication({ ...form, name: form.name.trim(), dosage: form.dosage.trim(), times });
    setForm(emptyForm);
    setTimeText('08:00');
    setOpen(false);
  };

  return <div className="page-stack">
    <SectionHeading eyebrow="A CLEAR PLAN, EVERY DAY" title="Medication plan" description="Keep prescriptions, schedules and dose history in one shared place." action={<Button onClick={() => setOpen(true)} disabled={!mayManage}><Plus size={17} /> Add medication</Button>} />
    {!mayManage && <div className="permission-banner"><Eye size={17} /><span>You’re viewing this plan as a family member. A patient or authorised caregiver can make changes.</span></div>}
    <div className="med-summary-grid"><Card className="med-summary"><span className="med-summary-icon"><Pill size={18} /></span><div><strong>{state.medications.filter((item) => item.active).length}</strong><span>Active medicines</span></div></Card><Card className="med-summary"><span className="med-summary-icon blue"><Clock3 size={18} /></span><div><strong>{state.medications.filter((item) => item.active).reduce((sum, item) => sum + item.times.length, 0)}</strong><span>Daily dose reminders</span></div></Card><Card className="med-summary"><span className="med-summary-icon green"><CheckCircle2 size={18} /></span><div><strong>{state.doseLogs.filter((item) => item.status === 'taken').length}</strong><span>Doses confirmed today</span></div></Card></div>
    <Card className="med-list-card"><div className="list-toolbar"><div className="search-field"><Search size={17} /><input aria-label="Search medicines" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search medicines or doctor..." /></div><div className="filter-group" aria-label="Filter medicines"><Filter size={15} />{(['active', 'all', 'paused'] as const).map((value) => <button key={value} className={filter === value ? 'filter-active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Paused'}</button>)}</div></div>
      {visible.length ? <div className="medication-list">{visible.map((medicine) => {
        const logs = state.doseLogs.filter((log) => log.medicationId === medicine.id);
        const completed = logs.filter((log) => log.status === 'taken').length;
        return <article className={`medication-item ${!medicine.active ? 'medication-paused' : ''}`} key={medicine.id}><div className={`medicine-art medicine-${medicine.category}`}><Pill size={21} /></div><div className="medicine-main"><div className="medicine-title"><h3>{medicine.name}</h3><Badge tone={medicine.active ? 'success' : 'neutral'}>{medicine.active ? 'Active' : 'Paused'}</Badge></div><p className="medicine-dose">{medicine.dosage} <span>·</span> {medicine.frequency}</p><p className="medicine-instructions">{medicine.instructions}</p><div className="medicine-meta"><span><Clock3 size={13} /> {medicine.times.join(' · ')}</span><span><Stethoscope size={13} /> {medicine.prescribingDoctor}</span></div></div><div className="medicine-side"><span className="dose-completion">{completed} <small>confirmed today</small></span><div className="medicine-actions">{mayManage && <Button variant="outline" size="sm" onClick={() => toggleMedication(medicine.id)}>{medicine.active ? <><Archive size={14} /> Pause</> : <><CheckCircle2 size={14} /> Reactivate</>}</Button>}<button className="icon-button" aria-label={`View ${medicine.name} history`} onClick={() => window.alert(`${medicine.name}: ${logs.length} dose records in this demo workspace.`)}><Activity size={17} /></button></div></div></article>;
      })}</div> : <EmptyState icon={<Pill size={25} />} title="No medicines found" description={query ? 'Try another medicine name or clear your search.' : 'Add a medicine to start building the shared plan.'} action={mayManage && <Button onClick={() => setOpen(true)}><Plus size={16} /> Add medication</Button>} />}
    </Card>
    <div className="med-footer-note"><ShieldCheck size={17} /><p>SaarthiCare stores the instructions entered by your care team. It does not recommend medicines or calculate prescribed dosages. Always follow the clinician’s prescription.</p></div>

    {open && <Modal title="Add a medication" description="Enter the details exactly as prescribed by the treating clinician." onClose={() => setOpen(false)} wide><form className="form-grid" onSubmit={submit}>
      <Field label="Medicine name"><input className="form-input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Amlodipine" /></Field>
      <Field label="Prescribed dosage"><input className="form-input" required value={form.dosage} onChange={(event) => setForm({ ...form, dosage: event.target.value })} placeholder="e.g. 5 mg (as prescribed)" /></Field>
      <Field label="Frequency"><select className="form-input" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}><option>Once daily</option><option>Twice daily</option><option>Three times daily</option><option>As instructed</option><option>Custom schedule</option></select></Field>
      <Field label="Medicine type"><select className="form-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as AddMedicationInput['category'] })}><option value="tablet">Tablet</option><option value="capsule">Capsule</option><option value="liquid">Liquid</option><option value="other">Other</option></select></Field>
      <Field label="Reminder times" hint="Use 24-hour time, separated by commas (for example, 08:00, 20:00)."><input className="form-input" required value={timeText} onChange={(event) => setTimeText(event.target.value)} placeholder="08:00, 20:00" /></Field>
      <Field label="Prescribing doctor"><input className="form-input" value={form.prescribingDoctor} onChange={(event) => setForm({ ...form, prescribingDoctor: event.target.value })} placeholder="Doctor’s name" /></Field>
      <div className="form-span-2"><Field label="Instructions"><textarea className="form-input textarea-input" rows={2} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Add the instructions provided by the clinician" /></Field></div>
      <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit"><Plus size={16} /> Save medication</Button></div>
    </form></Modal>}
  </div>;
}
