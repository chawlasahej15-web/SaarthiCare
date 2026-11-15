import { useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, HeartPulse, Mic, MicOff, Pill, Sparkles, ShieldCheck, Users, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSaarthiCare } from '../context/SaarthiCareContext';
import { formatTime } from '../lib/date';

export function ElderDashboard() {
  const { state, markDose } = useSaarthiCare();
  const [listening, setListening] = useState(false);
  const [reply, setReply] = useState('Namaste! Main aapka Saarthi hoon. Aap mujhse apni medicines ya appointments ke baare mein pooch sakte hain.');
  const today = new Date();
  const logs = useMemo(() => state.doseLogs.filter(x => new Date(x.scheduledAt).toDateString() === today.toDateString()).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)), [state.doseLogs]);
  const nextAppointment = state.appointments.filter(x=>x.status==='scheduled' && new Date(x.dateTime)>=new Date()).sort((a,b)=>a.dateTime.localeCompare(b.dateTime))[0];
  const speak = (text:string) => { setReply(text); if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'hi-IN'; window.speechSynthesis.speak(u); } };
  const startVoice = () => {
    const w = window as Window & {webkitSpeechRecognition?: new () => {lang:string; interimResults:boolean; onresult:(e:{results:{[i:number]:{[j:number]:{transcript:string}}}})=>void; onend:()=>void; start:()=>void}; SpeechRecognition?: new () => {lang:string; interimResults:boolean; onresult:(e:{results:{[i:number]:{[j:number]:{transcript:string}}}})=>void; onend:()=>void; start:()=>void} };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) { speak('Voice input is not supported in this browser. Aap neeche diye gaye buttons use kar sakte hain.'); return; }
    const rec = new Recognition(); rec.lang='hi-IN'; rec.interimResults=false; setListening(true);
    rec.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript;
if (!transcript) { setListening(false); return; }
const text = transcript.toLowerCase(); setListening(false); if (text.includes('appointment') || text.includes('doctor')) { speak(nextAppointment ? `Aapka agla appointment ${nextAppointment.doctorName} ke saath ${new Date(nextAppointment.dateTime).toLocaleString('en-IN',{weekday:'long',hour:'numeric',minute:'2-digit'})} ko hai.` : 'Abhi koi upcoming appointment nahi hai.'); }
      else if (text.includes('medicine') || text.includes('dawai') || text.includes('tablet')) { const pending=logs.find(x=>x.status==='pending'); const med=pending && state.medications.find(m=>m.id===pending.medicationId); speak(med ? `Aapki agli dawa ${med.name}, ${med.dosage}, ${formatTime(pending.scheduledAt)} par hai.` : 'Aaj ki koi pending dawa nahi hai.'); }
      else if (text.includes('le li') || text.includes('taken')) { const pending=logs.find(x=>x.status==='pending'); if(pending){markDose(pending.id); speak('Theek hai. Maine aapki pending medicine ko taken mark kar diya hai.');} else speak('Aapki koi pending medicine nahi hai.'); }
      else speak('Main aapki madad kar sakta hoon. Aap medicine ka time ya doctor appointment pooch sakte hain.'); };
    rec.onend=()=>setListening(false); rec.start();
  };
  const pending = logs.filter(x=>x.status==='pending');
  return <main className="elder-app">
    <header className="elder-top"><div className="elder-brand"><span className="elder-brand-icon"><HeartPulse size={24}/></span><div><strong>SaarthiCare</strong><small>Your health companion</small></div></div><div className="elder-profile"><span>{state.patientInitials}</span></div></header>
    <div className="elder-content">
      <section className="elder-greeting"><p>{today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p><h1>Namaste, {state.patientName.split(' ')[0]} ji! <span>🙏</span></h1><p>Chaliye, aaj apni sehat ka khayal rakhte hain.</p></section>
      <section className="elder-next-dose"><div className="elder-section-title"><span className="elder-icon-pill"><Pill size={22}/></span><div><small>YOUR NEXT MEDICINE</small><h2>{pending.length ? 'Medicine time' : 'All caught up!'}</h2></div></div>
        {pending.length ? pending.slice(0,2).map(log=>{const med=state.medications.find(m=>m.id===log.medicationId); return <article className="elder-med-row" key={log.id}><div className="elder-med-time"><Clock3 size={17}/><strong>{formatTime(log.scheduledAt)}</strong></div><div className="elder-med-name"><strong>{med?.name}</strong><span>{med?.dosage} · {med?.instructions}</span></div><button className="elder-taken" onClick={()=>markDose(log.id)}><Check size={19}/> I've taken it</button></article>}) : <p className="elder-done-copy">Aapki saari scheduled medicines confirm ho chuki hain. Bahut badhiya!</p>}
      </section>
      <section className="elder-assistant"><div className="elder-ai-heading"><span><Sparkles size={20}/></span><div><small>YOUR PERSONAL SAARTHI</small><h2>Ask me anything</h2></div></div><p className="elder-ai-reply">{reply}</p><button className={`elder-mic ${listening?'is-listening':''}`} onClick={startVoice}>{listening?<MicOff size={30}/>:<Mic size={30}/>}<span>{listening?'Listening...':'Tap to speak'}</span></button><div className="elder-quick-asks"><button onClick={() => {
  const firstPending = pending[0];
  if (!firstPending) {
    speak('Aaj ki saari medicines complete hain.');
    return;
  }
  const med = state.medications.find(m => m.id === firstPending.medicationId);
  speak(med
    ? `Aapki agli medicine ${med.name} ${formatTime(firstPending.scheduledAt)} par hai.`
    : `Aapki agli medicine ${formatTime(firstPending.scheduledAt)} par hai.`);
}}> <Pill size={16}/> Medicine kab leni hai?</button><button onClick={()=>speak(nextAppointment ? `Aapka appointment ${nextAppointment.doctorName} ke saath ${new Date(nextAppointment.dateTime).toLocaleString('en-IN')} ko hai.` : 'Aapka koi appointment schedule nahi hai.')}> <CalendarDays size={16}/> Mera appointment kab hai?</button></div></section>
      <section className="elder-appointment"><div className="elder-appointment-head"><span className="elder-calendar-icon"><CalendarDays size={21}/></span><div><small>NEXT DOCTOR VISIT</small><h2>Appointments</h2></div><Link to="/appointments" aria-label="View appointments"><ChevronRight/></Link></div>{nextAppointment ? <div className="elder-visit-card"><strong>{nextAppointment.doctorName}</strong><span>{nextAppointment.specialty}</span><p>{new Date(nextAppointment.dateTime).toLocaleString('en-IN',{weekday:'long',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</p><small>{nextAppointment.location}</small></div> : <p className="elder-done-copy">Abhi koi upcoming appointment nahi hai.</p>}</section>
      <section className="elder-help-row"><div><Users size={20}/><span><strong>Your family is connected</strong><small>Your loved ones can help manage your care.</small></span></div><Link to="/login">Family portal <ChevronRight size={17}/></Link></section>
      <p className="elder-footnote"><ShieldCheckIcon/> Your health information is shared only with your care circle.</p>
    </div>
    <nav className="elder-bottom-nav"><Link to="/elder" className="active"><HeartPulse/><span>Home</span></Link><Link to="/medications"><Pill/><span>Medicines</span></Link><Link to="/appointments"><CalendarDays/><span>Visits</span></Link><Link to="/care-circle"><Users/><span>Family</span></Link></nav>
  </main>;
}
function ShieldCheckIcon(){return <ShieldCheck size={14}/>}
