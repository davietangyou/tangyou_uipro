import { useState, type CSSProperties } from 'react';
import { ArrowRight, Droplet, Pill, Plus, UserRound } from 'lucide-react';
import type { GlucoseRecord, UserProfile } from '../data/types';
import { homeMedicationSummary, recentGlucoseSummary } from '../data/homeSummary';
import { slotLabelFor } from '../data/constants';
import { localDate } from '../data/hba1c';
import { AppointmentCard, AppointmentEditor } from '../components/AppointmentCard';
import { LowStockNotices } from '../components/MedicationCards';
import { ProfileVoiceSlot } from '../components/profile/ProfileVoice';
import aiCardArtwork from '../assets/home/ai-card-refined.webp';

export function HomeView({ profile, records, now, largeFont, onToggleFont, onOpenConsult,
  onOpenQuestions, onOpenMedication, onOpenProfile, onRecordGlucose, onSaveProfile, onToast,
}: {
  profile: UserProfile; records: GlucoseRecord[]; now: Date; largeFont: boolean;
  onToggleFont: () => void; onOpenConsult: () => void; onOpenQuestions: () => void;
  onOpenMedication: () => void; onOpenProfile: () => void; onRecordGlucose: () => void;
  onSaveProfile: (patch: Partial<UserProfile>) => void; onToast: (text: string) => void;
}) {
  const [appointment, setAppointment] = useState(false);
  const glucose = recentGlucoseSummary(records);
  const medication = homeMedicationSummary(profile, now);
  const latest = glucose.latest;
  const measured = latest ? new Date(latest.timestamp) : null;
  const date = measured && (localDate(measured) === localDate(now) ? '今天' : `${measured.getMonth() + 1}/${measured.getDate()}`);
  const time = measured && `${String(measured.getHours()).padStart(2, '0')}:${String(measured.getMinutes()).padStart(2, '0')}`;
  const hour = now.getHours();
  const hello = hour >= 5 && hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安';

  return <div className="home-page"><div className="home-content">
    <header className="home-header" data-voice-avoid>
      <button type="button" className="home-avatar" aria-label="查看個人資料" onClick={onOpenProfile}><UserRound size={26} strokeWidth={1.8}/></button>
      <div className="home-identity"><p className="home-brand">DiaGuide HK</p><h1 className="home-greeting">{hello}，{profile.name || '老友記'}</h1></div>
      <button type="button" className="home-font-button" aria-pressed={largeFont} aria-label={largeFont ? '切換至標準字' : '切換至放大字'} onClick={onToggleFont}>Aa {largeFont ? '放大' : '標準'}</button>
      <span className="home-voice-space" aria-hidden="true"/>
      <ProfileVoiceSlot id="home:header"/>
    </header>
    <button type="button" className="home-ai-hero" onClick={onOpenConsult} style={{'--home-ai-art':`url(${aiCardArtwork})`} as CSSProperties}>
      <span className="home-ai-copy"><strong>問問 AI</strong><span className="home-ai-description">整理疑問，準備覆診</span><span className="home-ai-cta">開始提問<ArrowRight size={20} strokeWidth={1.8} aria-hidden="true"/></span></span>
      <span className="home-ai-art" aria-hidden="true"/>
    </button>
    <AppointmentCard profile={profile} variant="summary" onEdit={()=>setAppointment(true)} onQuestions={onOpenQuestions}
      onStatusChange={status=>{onSaveProfile({nextClinicStatus:status});onToast(status==='completed'?'已標記覆診為完成。':'已取消這次覆診。');}}/>
    <div className="home-health-grid">
      <section className="home-summary-card home-glucose-card" aria-label="最新血糖">
        <h2><span className="home-summary-icon"><Droplet size={20} strokeWidth={1.8} aria-hidden="true"/></span>最新血糖</h2>
        <p className="home-summary-value"><span>{latest ? latest.value.toFixed(1) : '—'}</span>{latest && <small>mmol/L</small>}</p>
        <p className="home-summary-hint">{latest ? `${date} ${time} · ${slotLabelFor(latest.timeType,latest.mealTag)}` : '尚未有血糖紀錄'}</p>
        {latest && <div className="home-glucose-bars" role="img" aria-label={`最近${glucose.bars.length}筆血糖：${glucose.bars.map(record=>record.value).join('、')} mmol/L`}>
          {glucose.bars.map((record,i)=><span key={record.id} data-latest={i===glucose.bars.length-1} style={{height:record.height}} title={`${record.value} mmol/L`}/>)}
        </div>}
        <button type="button" className="home-summary-action" onClick={onRecordGlucose}><Plus size={16} aria-hidden="true"/>記錄血糖</button>
      </section>
      <section className="home-summary-card home-medication-card" aria-label="今日服藥">
        <h2><span className="home-summary-icon"><Pill size={20} strokeWidth={1.8} aria-hidden="true"/></span>今日服藥</h2>
        <p className="home-summary-value" data-empty={!medication.entries.length}><span>{medication.headline}</span>{medication.entries.length>0 && <small>/ {medication.entries.length} 項已確認</small>}</p>
        <p className="home-summary-hint">{medication.hint}</p>
        {medication.entries.length>0 && <div className="home-intake-progress" role="progressbar" aria-label="今天服藥安排已確認" aria-valuemin={0} aria-valuemax={medication.entries.length} aria-valuenow={medication.taken}>
          {medication.entries.map(entry=><span key={entry.id} data-confirmed={entry.status==='taken'}/>)}
        </div>}
        <button type="button" className="home-summary-action" onClick={onOpenMedication}>{profile.medications.length ? '查看全部' : '管理藥物'}</button>
      </section>
    </div>
    <LowStockNotices profile={profile}/>
    {appointment && <AppointmentEditor profile={profile} onClose={()=>setAppointment(false)} onSave={patch=>{onSaveProfile(patch);onToast('已更新覆診資料。');}}/>}
  </div></div>;
}