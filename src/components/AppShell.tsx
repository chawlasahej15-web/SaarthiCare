import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, ChevronDown, HeartHandshake, LayoutDashboard, Menu, Pill, Settings, ShieldCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useSaarthiCare } from '../context/SaarthiCareContext';
import { isFirebaseConfigured } from '../lib/firebase';
import { Avatar } from './ui';
import { roleLabel } from '../services/permissions';

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/medications', label: 'Medicine plan', icon: Pill },
  { to: '/appointments', label: 'Doctor visits', icon: CalendarDays },
  { to: '/care-circle', label: 'My family', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];
const titles: Record<string, string> = { '/dashboard': 'Family care space', '/medications': 'Medicine plan', '/appointments': 'Doctor visits', '/care-circle': 'People in the care team', '/settings': 'Your preferences' };

export function AppShell() {
  const { state, setRole } = useSaarthiCare();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const sidebar = <aside className="sc-sidebar">
    <div className="sc-brand"><span className="sc-brand-icon"><HeartHandshake size={24}/></span><span><b>SaarthiCare</b><small>care, connected</small></span>{mobileOpen && <button className="sc-close" onClick={()=>setMobileOpen(false)}><X/></button>}</div>
    <div className="sc-side-label">YOUR SPACE</div>
    <nav className="sc-nav">{navItems.map(({to,label,icon:Icon})=><NavLink key={to} to={to} onClick={()=>setMobileOpen(false)} className={({isActive})=>`sc-nav-link ${isActive?'active':''}`}><Icon size={19}/><span>{label}</span>{to==='/care-circle'&&<i>{state.members.length}</i>}</NavLink>)}</nav>
    <div className="sc-side-bottom"><div className="sc-privacy"><ShieldCheck size={19}/><span><b>Your circle, your choice</b><small>Only invited people can view care updates.</small></span></div>
      {!isFirebaseConfigured && roleMenuOpen && <div className="sc-role-menu"><b>Preview dashboard as</b>{(['owner','caregiver','family'] as const).map(role=><button key={role} onClick={()=>{setRole(role);setRoleMenuOpen(false)}}>{roleLabel(role)}{state.activeRole===role?' ✓':''}</button>)}</div>}
      <button className="sc-account" onClick={()=>!isFirebaseConfigured&&setRoleMenuOpen(v=>!v)}><Avatar initials={state.patientInitials} size="sm"/><span><b>{state.currentUserName}</b><small>{roleLabel(state.activeRole)}</small></span><ChevronDown size={17}/></button>
    </div>
  </aside>;
  return <div className="sc-app">{mobileOpen&&<button className="sc-scrim" onClick={()=>setMobileOpen(false)} aria-label="Close menu"/>}{sidebar}<div className="sc-main"><header className="sc-topbar"><div className="sc-top-left"><button className="sc-menu" onClick={()=>setMobileOpen(true)} aria-label="Open menu"><Menu/></button><div><small>SAARTHICARE <span> / </span> FAMILY PORTAL</small><h2>{titles[location.pathname]||'Care workspace'}</h2></div></div><div className="sc-top-right"><span className="sc-secure"><i/> {isFirebaseConfigured?'Secure space':'Demo preview'}</span><button className="sc-bell" onClick={()=>navigate('/settings')} aria-label="Notifications"><Bell size={19}/></button><div className="sc-top-user"><Avatar initials={state.currentUserName.split(' ').map(x=>x[0]).slice(0,2).join('')} size="sm"/><span><b>{state.currentUserName}</b><small>Family dashboard</small></span></div></div></header><main className="sc-content"><Outlet/></main><footer className="sc-footer"><span><ShieldCheck size={14}/> SaarthiCare helps families coordinate care. It is not an emergency service.</span><span>Made with care <HeartHandshake size={14}/></span></footer></div></div>;
}
