import { useState, type FormEvent } from 'react';
import { Activity, Check, Clipboard, HeartHandshake, LockKeyhole, Mail, MessageSquareText, PencilLine, Plus, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useSaarthiCare } from '../context/SaarthiCareContext';
import { canWriteCareNotes, roleLabel } from '../services/permissions';
import { formatDate, formatTime } from '../lib/date';
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, SectionHeading } from '../components/ui';
import type { CareMember, MemberPermissions } from '../types';

export function SaarthiCarePage() {
  const { state, inviteMember, addCareNote, updateMemberPermissions } = useSaarthiCare();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CareMember | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<MemberPermissions>({ manageMedications: false, manageAppointments: false, writeCareNotes: false, inviteMembers: false });
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'caregiver' as 'caregiver' | 'family' });
  const [noteForm, setNoteForm] = useState({ title: '', body: '' });
  const [inviteCode, setInviteCode] = useState('');
  const canInvite = state.members.find((member) => member.id === state.currentUserId)?.permissions.inviteMembers ?? state.activeRole === 'owner';
  const canNote = canWriteCareNotes(state.members.find((member) => member.id === state.currentUserId));

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return;
    try {
      const code = await inviteMember(inviteForm.name.trim(), inviteForm.email.trim(), inviteForm.role);
      setInviteCode(code);
      setInviteForm({ name: '', email: '', role: 'caregiver' });
      setInviteOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not create the invitation.');
    }
  };
  const openPermissionEditor = (member: CareMember) => { setEditingMember(member); setPermissionDraft({ ...member.permissions }); };
  const submitPermissions = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMember) return;
    try { await updateMemberPermissions(editingMember.id, permissionDraft); setEditingMember(null); }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Could not update member permissions.'); }
  };
  const submitNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteForm.title.trim() || !noteForm.body.trim()) return;
    addCareNote(noteForm.title.trim(), noteForm.body.trim());
    setNoteForm({ title: '', body: '' });
    setNoteOpen(false);
  };

  return <div className="page-stack">
    <SectionHeading eyebrow="BETTER CARE IS SHARED CARE" title="Your care circle" description="The people who show up, stay informed and help make the everyday easier." action={<Button disabled={!canInvite} onClick={() => setInviteOpen(true)}><UserPlus size={17} /> Invite someone</Button>} />
    <Card className="patient-center-card"><div className="patient-center-icon"><HeartHandshake size={24} /></div><div><p className="eyebrow">AT THE HEART OF THIS CIRCLE</p><h2>{state.patientName}</h2><p>{state.patientAge} years · Patient & decision-maker</p></div><Badge tone="success"><span className="status-pulse" /> Profile shared</Badge><div className="patient-center-copy">The patient stays in control of their healthcare decisions. Access should be shared with consent and reviewed whenever care needs change.</div></Card>
    {inviteCode && <Card className="invite-code-card"><div><p className="eyebrow">INVITATION CODE</p><strong>{inviteCode}</strong><span>Share this code with the invited person. Secure codes are one-time and expire after seven days; demo codes are local only.</span></div><Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(inviteCode)}><Clipboard size={15} /> Copy</Button></Card>}
    <div className="care-columns"><Card className="members-card"><div className="card-heading"><div><p className="eyebrow">YOUR PEOPLE</p><h2>Circle members</h2><p className="card-subtitle">{state.members.length} invited people · {state.members.filter((member) => member.status === 'active').length} active</p></div><Users size={20} className="muted-icon" /></div><div className="member-list">{state.members.map((member) => <div className="member-row" key={member.id}><Avatar initials={member.initials} tone={member.color.includes('peach') ? 'peach' : member.color.includes('lilac') ? 'lilac' : 'teal'} /><div className="member-info"><strong>{member.name}</strong><span>{member.relationship}</span><small><Mail size={12} /> {member.email}</small></div><div className="member-role"><Badge tone={member.role === 'owner' || member.role === 'caregiver' ? 'info' : 'neutral'}>{roleLabel(member.role)}</Badge><small className={member.status === 'active' ? 'member-active' : 'member-pending'}>{member.status === 'active' ? '● Active' : '◷ Invitation pending'}</small>{state.activeRole === 'owner' && member.role !== 'owner' && <button className="member-edit" onClick={() => openPermissionEditor(member)}><PencilLine size={13} /> Edit access</button>}</div></div>)}</div><div className="member-footer"><ShieldCheck size={16} /><span>Role permissions are enforced by Firestore security rules and trusted functions in production.</span></div></Card>
      <Card className="permission-card"><div className="card-heading"><div><p className="eyebrow">ACCESS WITH CARE</p><h2>Who can do what</h2></div><LockKeyhole size={20} className="muted-icon" /></div><div className="permission-table"><div className="permission-head"><span>Permission</span><span>Patient</span><span>Caregiver</span><span>Family</span></div>{[['View shared profile','✓','✓','✓'],['Confirm medication doses','✓','✓','—'],['Manage medication plan','✓','✓','By invite'],['Manage appointments','✓','✓','By invite'],['Add care notes','✓','✓','By invite'],['Invite new members','✓','By owner','—']].map((row) => <div className="permission-row" key={row[0]}><span>{row[0]}</span>{row.slice(1).map((value, index) => <span className={value === '—' ? 'permission-no' : 'permission-yes'} key={`${row[0]}-${index}`}>{value === '✓' ? <Check size={15} /> : value}</span>)}</div>)}</div><p className="permission-footnote">The profile owner can configure access for each active caregiver or family member. Firestore rules and a trusted function enforce these permissions in Firebase mode.</p></Card></div>
    <Card className="timeline-card"><div className="card-heading"><div><p className="eyebrow">THE STORY OF EVERYDAY CARE</p><h2>Shared care timeline</h2><p className="card-subtitle">Small updates that help everyone stay in sync.</p></div><Button variant="outline" size="sm" onClick={() => setNoteOpen(true)} disabled={!canNote}><MessageSquareText size={15} /> Add a note</Button></div>
      {state.notes.length ? <div className="note-list">{state.notes.map((note) => <article className="care-note" key={note.id}><div className="note-avatar"><MessageSquareText size={16} /></div><div className="note-content"><div className="note-meta"><strong>{note.author}</strong><Badge>{roleLabel(note.authorRole)}</Badge><time>{formatDate(note.createdAt, { day: 'numeric', month: 'short' })} · {formatTime(note.createdAt)}</time></div><h3>{note.title}</h3><p>{note.body}</p></div></article>)}</div> : <EmptyState icon={<MessageSquareText />} title="No care notes yet" description="Share a small update or handoff note with everyone in the circle." action={<Button onClick={() => setNoteOpen(true)}>Add the first note</Button>} />}
    </Card>
    <Card className="audit-card"><div className="card-heading"><div><p className="eyebrow">TRANSPARENCY MATTERS</p><h2>Recent activity</h2></div><Activity size={19} className="muted-icon" /></div>{state.activity.slice(0, 6).map((item) => <div className="audit-row" key={item.id}><span className="audit-dot" /><div><p><strong>{item.actor}</strong> {item.action}</p><span>{item.detail}</span></div><time>{formatDate(item.createdAt)} · {formatTime(item.createdAt)}</time></div>)}</Card>

    {editingMember && <Modal title={`Edit access for ${editingMember.name}`} description="Give this person only the access needed to support the patient." onClose={() => setEditingMember(null)}><form className="form-stack" onSubmit={submitPermissions}>{([['manageMedications', 'Manage medication plan', 'Add or pause medicines and schedules.'], ['manageAppointments', 'Manage appointments', 'Add or cancel doctor visits.'], ['writeCareNotes', 'Write care notes', 'Add handoff notes to the shared timeline.'], ['inviteMembers', 'Invite other members', 'Invite additional people into this care circle.']] as const).map(([key, label, description]) => <label className="permission-editor-row" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={permissionDraft[key]} onChange={(event) => setPermissionDraft((previous) => ({ ...previous, [key]: event.target.checked }))} /></label>)}<div className="patient-consent"><ShieldCheck size={17} /><span>Access changes are recorded in the care activity log. The profile owner always retains control of membership.</span></div><div className="modal-actions"><Button type="button" variant="outline" onClick={() => setEditingMember(null)}>Cancel</Button><Button type="submit">Save permissions</Button></div></form></Modal>}
    {inviteOpen && <Modal title="Invite to your care circle" description="Choose someone you trust and decide what role they should have." onClose={() => setInviteOpen(false)}><form className="form-stack" onSubmit={submitInvite}><Field label="Full name"><input className="form-input" required value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} placeholder="Their name" /></Field><Field label="Email address"><input className="form-input" type="email" required value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="name@example.com" /></Field><Field label="Role"><select className="form-input" value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value as 'caregiver' | 'family' })}><option value="caregiver">Caregiver — can help manage care</option><option value="family">Family member — view and stay informed</option></select></Field><div className="patient-consent"><ShieldCheck size={17} /><span>Only invite someone with the patient’s knowledge and consent. Access can be reviewed later.</span></div><div className="modal-actions"><Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button><Button type="submit"><Plus size={16} /> Create invitation</Button></div></form></Modal>}
    {noteOpen && <Modal title="Share a care note" description="Leave a helpful update for the next person supporting care." onClose={() => setNoteOpen(false)}><form className="form-stack" onSubmit={submitNote}><Field label="Note title"><input className="form-input" required value={noteForm.title} onChange={(event) => setNoteForm({ ...noteForm, title: event.target.value })} placeholder="e.g. Evening handoff" /></Field><Field label="What should the circle know?"><textarea className="form-input textarea-input" rows={4} required value={noteForm.body} onChange={(event) => setNoteForm({ ...noteForm, body: event.target.value })} placeholder="Share a helpful update..." /></Field><div className="modal-actions"><Button variant="outline" type="button" onClick={() => setNoteOpen(false)}>Cancel</Button><Button type="submit"><MessageSquareText size={16} /> Share note</Button></div></form></Modal>}
  </div>;
}
