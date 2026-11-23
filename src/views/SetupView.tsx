import { useRef, useState } from 'react';
import type { UserProfile } from '../data/types';
import { SetupChrome } from '../components/profile/EditorShell';
import { BasicInfoEditor } from './profile/BasicInfoEditor';
import { DiabetesEditor } from './profile/DiabetesEditor';
import { ConditionsEditor } from './profile/ConditionsEditor';
import { CareEditor } from './profile/CareEditor';
import { DietExerciseEditor } from './profile/DietExerciseEditor';
import { writeStored, type SetupState } from '../services/storage';
const editors=[BasicInfoEditor,DiabetesEditor,ConditionsEditor,CareEditor,DietExerciseEditor];
export function SetupView({profile,initialStep,onSave,onClose,onToast}:{profile:UserProfile;initialStep:number;onSave:(patch:Partial<UserProfile>)=>void;onClose:(state:SetupState)=>void;onToast:(message:string)=>void}) {
  const [step,setStep]=useState(Math.min(4,Math.max(0,initialStep)));
  const [error,setError]=useState('');
  const action=useRef<'next'|'back'|'exit'>('next');
  const Editor=editors[step];
  const save=(patch:Partial<UserProfile>)=>{
    try {
      onSave(patch);
      const state:SetupState=action.current==='exit' ? {step,status:'later'} : step===4 && action.current==='next' ? {step:4,status:'complete'} : {step:step+(action.current==='back'?-1:1),status:'active'};
      writeStored('setup',state);setError('');
      if(state.status==='complete') onToast('首次設定已完成！其餘糖尿病專科用藥清單、飲食運動偏好及就診安排，可隨時在「我的」中進一步完善。');
      if(state.status!=='active') onClose(state); else setStep(state.step);
    } catch {setError('未能保存，請檢查瀏覽器儲存空間後再試。');}
  };
  return <SetupChrome.Provider value={{step,error,go:(intent,submit)=>{action.current=intent;submit(intent);}}}>
    <Editor key={step} profile={profile} onBack={()=>{}} onSave={save}/>
  </SetupChrome.Provider>;
}