import type {Sex,UserProfile,WeightUnit} from './types';
export type ProfileSubmitIntent = 'save'|'next'|'back'|'exit';
export type BasicInfoDraft = {name:string;age:string;sex:Sex|null;heightCm:string;weight:string;weightUnit:WeightUnit};
export type BasicInfoErrors = Partial<Record<'age'|'heightCm'|'weight',string>>;
// Omitted invalid fields preserve saved values when leaving a setup step.
export function basicInfoSubmission(draft:BasicInfoDraft,intent:ProfileSubmitIntent) {
  const number=(raw:string)=>raw.trim()===''?null:Number(raw);
  const age=number(draft.age),heightCm=number(draft.heightCm),weight=number(draft.weight);
  const errors:BasicInfoErrors={};
  if(age!==null&&(!Number.isInteger(age)||age<1||age>120))errors.age='年齡須為 1–120 歲的整數。';
  if(heightCm!==null&&(!Number.isFinite(heightCm)||heightCm<=0))errors.heightCm='身高須為大於零的有效數字。';
  if(weight!==null&&(!Number.isFinite(weight)||weight<=0))errors.weight='體重須為大於零的有效數字。';
  const patch:Partial<UserProfile>={name:draft.name.trim()||'朋友',sex:draft.sex};
  if(!errors.age)patch.age=age;
  if(!errors.heightCm)patch.heightCm=heightCm;
  if(!errors.weight){patch.weight=weight;patch.weightUnit=draft.weightUnit;}
  return {patch,errors,blocked:(intent==='save'||intent==='next')&&Object.keys(errors).length>0};
}
