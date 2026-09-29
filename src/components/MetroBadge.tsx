import {Train} from "lucide-react";
import {findMoscowMetroStation} from "@/data/moscowMetro";
export default function MetroBadge({value,className=""}:{value?:string|null;className?:string}){
 const s=findMoscowMetroStation(value); if(!value)return null;
 const color=s?.line.color??"#8a8a8a";
 return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${className}`} style={{borderColor:color+"45",backgroundColor:color+"12",color}}><span className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-extrabold text-white" style={{backgroundColor:color}}>{s?.line.id??"M"}</span><Train size={11}/>{value}</span>;
}