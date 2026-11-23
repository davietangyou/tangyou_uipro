import { Check } from 'lucide-react';
import { useId } from 'react';
import { DeviceModal } from './DeviceModal';

export function RecordRangePicker({open,title,options,value,onChange,onClose,description}: {
  open:boolean; title:string; options:readonly {id:string;label:string}[];
  value:string; onChange:(id:string)=>void; onClose:()=>void;
  description?:string;
}) {
  const titleId=useId();
  return <DeviceModal open={open} onClose={onClose} label={titleId} placement="center" className="record-range-picker">
    <h2 id={titleId}>{title}</h2>
    <div className="record-range-choices">{options.map(option=><button key={option.id} type="button" aria-pressed={value===option.id}
      onClick={()=>{onChange(option.id);onClose();}}><span>{option.label}</span>{value===option.id&&<Check width={20} height={20} aria-hidden="true"/>}</button>)}</div>
    {description&&<p className="record-range-description">{description}</p>}
  </DeviceModal>;
}
