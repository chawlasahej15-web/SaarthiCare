import { ArrowUpRight, CalendarDays, Check, Clock3, HeartHandshake, Pill, Sparkles, Users, Activity, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSaarthiCare } from '../context/SaarthiCareContext';
import { calculateAdherence, calculateWeeklyAdherence } from '../services/adherence';
import { formatDate, formatTime, todayLabel } from '../lib/date';
import { canManageMedications } from '../services/permissions';

export function DashboardPage() {
 const {state,markDose}=useSaarthiCare();
 const today=new Date();
 const summary=calculateAdherence(state.doseLogs,today);
 const weekly=calculateWeeklyAdherence(state.doseLogs,today);
 const logs=state.doseLogs.filter(x=>new Date(x.scheduledAt).toDateString()===today.toDateString()).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
 const nextAppointment=state.appointments.filter(x=>x.status==='scheduled'&&new Date(x.dateTime)>=new Date()).sort((a,b)=>a.dateTime.localeCompare(b.dateTime))[0];
 const nextDose=state.doseLogs.filter(x=>x.status==='pending'&&new Date(x.scheduledAt)>=new Date()).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt))[0];
 const nextMed=nextDose&&state.medications.find(x=>x.id===nextDose.medicationId);
 const activeMembers=state.members.filter(x=>x.status==='active');
 const currentMember=state.members.find(x=>x.id===state.currentUserId);
 const mayConfirm=canManageMedications(currentMember);
 const hour=new Date().getHours(); const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
 return <div className="sc-dashboard">
  <section className="sc-welcome"><div><p className="sc-eyebrow">{todayLabel()} <span>·</span> YOUR FAMILY CARE PLAN</p><h1>{greeting}, {state.currentUserName.split(' ')[0]} <span>✦</span></h1><p>Small steps, shared together. Here’s how {state.patientName.split(' ')[0]} is doing today.</p></div><div className="sc-welcome-actions"><span className="sc-active-pill"><i/> Care circle active</span><button className="sc-summary-btn" onClick={()=>window.print()}>Today’s report <ArrowUpRight size={16}/></button></div></section>
  <section className="sc-metrics">
   <article className="sc-metric sc-metric-green"><div className="sc-metric-head"><span><Activity size={19}/></span><small>DAILY PROGRESS</small></div><strong>{summary.percentage}<em>%</em></strong><p>{summary.taken} of {summary.total} doses confirmed</p><div className="sc-progress"><i style={{width:`${summary.percentage}%`}}/></div></article>
   <article className="sc-metric"><div className="sc-metric-head"><span><Pill size={19}/></span><small>NEXT MEDICINE</small></div><strong className="sc-metric-word">{nextDose?formatTime(nextDose.scheduledAt):'All clear'}</strong><p>{nextMed?`${nextMed.name} · ${nextMed.dosage}`:'No pending dose scheduled'}</p><Link to="/medications">View medicine plan <ChevronRight size={15}/></Link></article>
   <article className="sc-metric"><div className="sc-metric-head"><span><CalendarDays size={19}/></span><small>NEXT DOCTOR VISIT</small></div><strong className="sc-metric-word">{nextAppointment?formatDate(nextAppointment.dateTime,{day:'numeric',month:'short'}):'Not booked'}</strong><p>{nextAppointment?`${nextAppointment.doctorName} · ${formatTime(nextAppointment.dateTime)}`:'Keep upcoming visits in one place'}</p><Link to="/appointments">View appointments <ChevronRight size={15}/></Link></article>
   <article className="sc-metric sc-metric-lilac"><div className="sc-metric-head"><span><Users size={19}/></span><small>YOUR SUPPORT TEAM</small></div><strong className="sc-metric-word">{activeMembers.length} people</strong><p>Working together for better care</p><div className="sc-avatar-stack">{activeMembers.slice(0,4).map(m=><span key={m.id}>{m.initials}</span>)}<Link to="/care-circle">+</Link></div></article>
  </section>
  <section className="sc-content-grid">
   <article className="sc-panel sc-routine"><div className="sc-panel-heading"><div><p className="sc-eyebrow">THE DAILY ROUTINE</p><h2>Today’s medicine checklist</h2><p>Confirm each dose when it has been taken.</p></div><Link to="/medications" className="sc-text-link">Full plan <ArrowUpRight size={16}/></Link></div>
    {logs.length?logs.map(log=>{const med=state.medications.find(m=>m.id===log.medicationId);const done=log.status==='taken';return <div className={`sc-dose-row ${done?'is-done':''}`} key={log.id}><div className="sc-dose-time"><b>{formatTime(log.scheduledAt)}</b><small>{new Date(log.scheduledAt).getHours()<12?'Morning':new Date(log.scheduledAt).getHours()<17?'Afternoon':'Evening'}</small></div><span className="sc-dose-icon"><Pill size={19}/></span><div className="sc-dose-copy"><b>{med?.name||'Medicine'}</b><small>{med?.dosage||''}{med?.instructions?` · ${med.instructions}`:''}</small><em>{done?'Dose confirmed':log.status==='missed'?'Marked as missed':'Awaiting confirmation'}</em></div>{done?<span className="sc-taken"><Check size={15}/> Taken</span>:mayConfirm?<button className="sc-confirm" onClick={()=>markDose(log.id)}><Check size={15}/> Confirm dose</button>:<span className="sc-awaiting">Awaiting</span>}</div>}) : <div className="sc-empty">No doses scheduled for today. Add medicines to build a daily routine.</div>}
    <div className="sc-routine-foot"><span><Clock3 size={15}/> Reminders are checked automatically</span><Link to="/medications">Manage medicines <ChevronRight size={15}/></Link></div>
   </article>
   <article className="sc-panel sc-week"><div className="sc-panel-heading"><div><p className="sc-eyebrow">AT A GLANCE</p><h2>Consistency this week</h2><p>A little progress, day by day.</p></div><span className="sc-week-icon"><Activity size={19}/></span></div><div className="sc-week-bars">{weekly.map((day,i)=><div key={`${day.label}-${i}`}><small>{day.percentage?`${day.percentage}%`:'—'}</small><span className="sc-bar"><i style={{height:`${Math.max(day.percentage,5)}%`}}/></span><em>{day.label}</em></div>)}</div><div className="sc-week-note"><Sparkles size={16}/><span><b>Every dose matters.</b> Your family’s support makes routines easier to follow.</span></div></article>
  </section>
  <section className="sc-bottom-grid"><article className="sc-panel sc-next-visit"><div className="sc-panel-heading"><div><p className="sc-eyebrow">STAY PREPARED</p><h2>Next doctor visit</h2></div><CalendarDays size={20}/></div>{nextAppointment?<><b className="sc-doctor-name">{nextAppointment.doctorName}</b><p>{nextAppointment.specialty}</p><div className="sc-visit-meta"><span><CalendarDays size={15}/>{formatDate(nextAppointment.dateTime,{weekday:'short',day:'numeric',month:'short'})}</span><span><Clock3 size={15}/>{formatTime(nextAppointment.dateTime)}</span></div><small>{nextAppointment.location}</small></>:<p className="sc-empty-inline">No upcoming appointment. Add a doctor visit when one is scheduled.</p>}<Link to="/appointments" className="sc-panel-link">Open visit records <ArrowUpRight size={15}/></Link></article>
   <article className="sc-panel sc-family-card"><div className="sc-family-illustration"><HeartHandshake size={27}/></div><div><p className="sc-eyebrow">BETTER TOGETHER</p><h2>Care works best as a team.</h2><p>Invite trusted family members or caregivers to share updates and stay connected.</p><Link to="/care-circle" className="sc-family-link">Manage your care team <ArrowUpRight size={16}/></Link></div></article>
  </section>
  <div className="sc-disclaimer"><ShieldCheckIcon/> SaarthiCare supports care coordination and does not replace professional medical advice.</div>
 </div>;
}
function ShieldCheckIcon(){return <HeartHandshake size={14}/>}
