import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Command, X, Map, MessageCircle, Users, BriefcaseBusiness, LayoutDashboard } from "lucide-react";
import "../styles/gruzli-os.css";

type Props={onClose:()=>void};

const baseApps=[
 {key:"feed",label:"Лента",icon:BriefcaseBusiness,target:"feed"},
 {key:"chats",label:"Чаты",icon:MessageCircle,target:"chats"},
 {key:"kartoteka",label:"Картотека",icon:Users,target:"kartoteka"},
 {key:"profile",label:"Профиль",icon:LayoutDashboard,target:"profile"},
];

export default function GruzliOS({onClose}:Props){
 const { role } = useAuth();
 const apps = role === "client"
   ? [
       {key:"feed",label:"Новый заказ",icon:BriefcaseBusiness,target:"feed"},
       {key:"orders",label:"Заявки",icon:LayoutDashboard,target:"orders"},
       {key:"chats",label:"Чаты",icon:MessageCircle,target:"chats"},
       {key:"profile",label:"Профиль",icon:Users,target:"profile"},
     ]
   : baseApps;
 const [active,setActive]=useState(apps[0]?.key ?? "feed");
 const [signal,setSignal]=useState(0);
 const signals=["Заказ — это не карточка. Это рабочий процесс.","Хороший диспетчер видит систему целиком.","Меньше переходов. Больше действия.","Каждый объект начинается с людей."];
 useEffect(()=>{document.body.classList.add("gruzli-os-open");return()=>document.body.classList.remove("gruzli-os-open")},[]);
 return <div className="gruzli-os" role="dialog" aria-label="Gruzli OS">
   <div className="gruzli-os-top">
    <div><b>GRUZLI</b><span>OS / WORKSPACE</span></div>
    <div className="gruzli-os-status"><i/> SYSTEM ONLINE</div>
    <button onClick={onClose} aria-label="Закрыть"><X size={17}/></button>
   </div>
   <div className="gruzli-os-body">
    <div className="gruzli-os-heading">
      <small>DISPATCH ENVIRONMENT / 01</small>
      <h1>Рабочее<br/><em>пространство.</em></h1>
      <p>Единый слой для заказов, людей, карты и коммуникации.</p>
    </div>
    <div className="gruzli-os-orbit"><div className="gruzli-os-ring r1"/><div className="gruzli-os-ring r2"/><div className="gruzli-os-core">G</div><span className="os-node n1">ORDERS</span><span className="os-node n2">PEOPLE</span><span className="os-node n3">MAP</span></div>
    <div className="gruzli-os-apps">{apps.map(a=>{const Icon=a.icon;return <button key={a.key} className={active===a.key?"active":""} onClick={()=>{setActive(a.key);window.dispatchEvent(new CustomEvent("gruzli-os-navigate",{detail:{tab:a.target}}));}}><Icon size={18}/><b>{a.label}</b><small>OPEN SPACE</small></button>})}</div>
    <div className="gruzli-os-signal" onClick={()=>setSignal(v=>(v+1)%signals.length)}><div><Command size={15}/><span>GRUZLI SIGNAL / 0{signal+1}</span></div><b>{signals[signal]}</b><small>Нажмите, чтобы открыть следующий сигнал ↗</small></div>
   </div>
   <div className="gruzli-os-dock">{apps.map(a=>{const Icon=a.icon;return <button key={a.key} onClick={()=>setActive(a.key)} className={active===a.key?"active":""}><Icon size={17}/><span>{a.label}</span></button>})}<button onClick={onClose}><X size={17}/><span>Закрыть</span></button></div>
 </div>
}
