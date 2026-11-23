import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {Check as CheckIcon,ChevronDown,Plus,X as XIcon} from 'lucide-react';
import {DeviceModal} from './DeviceModal';
import {RecordRangePicker} from './RecordRangePicker';
import {RecordDateTimePicker} from './RecordDateTimePicker';
import {slotById,slotLabelFor,suggestSlotId,SYMPTOM_TAGS,TIME_SLOTS} from '../data/constants';
import {GLUCOSE_STATS_RANGES,type GlucoseStatsRange} from '../data/glucoseTrend';
import {symptomOverview} from '../data/symptomOverview';
import type {GlucoseRecord} from '../data/types';
import type {NewGlucoseInput} from '../hooks/useGlucose';

const SYMPTOM_DATE_RANGE={pastDays:90,futureDays:7};
function toDateStr(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toTimeStr(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
function combine(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr || "00:00"}`).getTime();
}

function splitCustom(text: string): string[] {
  return text
    .split(/[、,，;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type VoiceState='idle'|'recording'|'processing'|'success'|'failure';
export function SymptomEntryForm({onSave,onToast}:{onSave:(input:NewGlucoseInput)=>void;onToast:(message:string)=>void}) {
  const now = Date.now();
  const [dateStr, setDateStr] = useState(toDateStr(now));
  const [timeStr, setTimeStr] = useState(toTimeStr(now));
  const [slotId, setSlotId] = useState(suggestSlotId(new Date(now).getHours()));

  const [selected, setSelected] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [voice, setVoice] = useState<VoiceState>("idle");
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceSupported =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleSymptom = (s: string) => {
    setError(null);
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const addCustom = (raw: string) => {
    const parts = splitCustom(raw);
    if (!parts.length) return;
    setError(null);
    setSelected((prev) => {
      const next = [...prev];
      for (const p of parts) if (!next.includes(p)) next.push(p);
      return next;
    });
    setCustomText("");
  };

  const cancelVoice = () => {
    const current = recognitionRef.current;
    recognitionRef.current = null;
    try { current?.abort?.(); } catch { /* Recognition may already have ended. */ }
  };

  const startVoice = () => {
    cancelVoice();
    if (!voiceSupported) {
      setVoice("failure");
      setVoiceMsg("此裝置不支援語音輸入，請直接打字。");
      return;
    }
    try {
      const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new Rec();
      rec.lang = "zh-HK";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      recognitionRef.current = rec;
      setVoice("recording");
      setVoiceMsg("正在聆聽，請說出不適⋯⋯");
      rec.onstart = () => {
        if (recognitionRef.current !== rec) return;
        setVoice("recording"); setVoiceMsg("正在聆聽，請說出不適⋯⋯");
      };
      rec.onresult = (e: any) => {
        if (recognitionRef.current !== rec) return;
        const text = e.results?.[0]?.[0]?.transcript ?? "";
        setCustomText((prev) => (prev ? `${prev} ${text}` : text));
        setVoice("success");
        setVoiceMsg("已辨識，請確認後按「加入」。");
      };
      rec.onerror = () => {
        if (recognitionRef.current !== rec) return;
        setVoice("failure"); setVoiceMsg("語音辨識失敗，請直接打字。");
      };
      rec.onend = () => {
        if (recognitionRef.current !== rec) return;
        recognitionRef.current = null;
        setVoice((v) => (v === "recording" || v === "processing" ? "idle" : v));
      };
      rec.start();
    } catch {
      cancelVoice();
      setVoice("failure");
      setVoiceMsg("語音辨識失敗，請直接打字。");
    }
  };

  const stopVoice = () => {
    if (!recognitionRef.current) return;
    setVoice("processing");
    setVoiceMsg("正在處理⋯⋯");
    try { recognitionRef.current.stop(); } catch {
      cancelVoice();
      setVoice("failure"); setVoiceMsg("語音辨識失敗，請直接打字。");
    }
  };
  useEffect(() => () => cancelVoice(), []);

  const setNow = () => {
    const t = Date.now();
    setDateStr(toDateStr(t));
    setTimeStr(toTimeStr(t));
    setSlotId(suggestSlotId(new Date(t).getHours()));
  };

  const handleSave = () => {
    if (!selected.length) { setError("請至少選擇一項症狀"); return; }
    const slot = slotById(slotId) ?? TIME_SLOTS[0];
    try {
      onSave({
      value: 0,
      timestamp: combine(dateStr, timeStr),
      timeType: slot.timeType,
      mealTag: slot.mealTag,
      dietNote: "",
      exerciseNote: "",
      symptoms: selected,
      });
    } catch {
      setError("未能儲存，已選症狀及輸入內容已保留。請再試一次。");
      return;
    }
    cancelVoice();
    onToast("症狀紀錄已儲存");
    setSelected([]);
    setCustomText("");
    setError(null);
    setVoice("idle");
    setVoiceMsg(null);
    setNow();
  };

  return (
      <div className="symptom-page">
          <RecordDateTimePicker
            startAtNow
            date={dateStr}
            time={timeStr}
            slotId={slotId}
            slots={TIME_SLOTS}
            dateRange={SYMPTOM_DATE_RANGE}
            ariaLabel="修改症狀日期、時間及時段"
            onConfirm={next => { setDateStr(next.date); setTimeStr(next.time); if (next.slotId) setSlotId(next.slotId); }}
          />

        <section className="symptom-form symptom-card" aria-labelledby="symptom-choice-title">
          <header className="symptom-choice-heading">
            <div className="symptom-choice-copy"><div className="symptom-heading-line"><h2 id="symptom-choice-title">有甚麼不舒服？</h2><span>可選多項</span></div></div>
          </header>
          <div className="symptom-choice-grid" role="group" aria-labelledby="symptom-choice-title">
            {SYMPTOM_TAGS.map(s => <button key={s} type="button" aria-pressed={selected.includes(s)} onClick={() => toggleSymptom(s)} className="symptom-choice">
              <span className="symptom-check" aria-hidden="true">{selected.includes(s) && <CheckIcon width={18} height={18} />}</span><span>{s}</span>
            </button>)}
          </div>

          <div className="symptom-custom">
            <label htmlFor="custom-symptom">其他不適</label>
            <input id="custom-symptom" type="text" value={customText} onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addCustom(customText); } }}
              placeholder="請輸入其他不適" aria-describedby="custom-symptom-hint" />
            <p id="custom-symptom-hint">可用「、」分隔多項，輸入後按「加入」。</p>
            <div className="symptom-secondary-actions">
              <button type="button" onClick={voice === "recording" ? stopVoice : startVoice}
                aria-label={voice === "recording" ? "停止語音輸入" : "開始語音輸入"} aria-pressed={voice === "recording"}
                className={`symptom-secondary ${voice === "recording" ? "symptom-recording" : ""}`}>
                {voice === "recording" ? "停止" : "語音"}
              </button>
              <button type="button" onClick={() => addCustom(customText)} disabled={customText.trim() === ""} className="symptom-secondary">加入</button>
            </div>
            {voiceMsg && <p role="status" aria-live="polite" className={voice === "failure" ? "symptom-error" : ""}>{voiceMsg}</p>}
          </div>

          <div className="symptom-selected">
            <div className="symptom-selected-heading"><p role="status" aria-live="polite">已選 {selected.length} 項{selected.length ? `：${selected.join("、")}` : ""}</p><button type="button" disabled={!selected.length} aria-label="清除全部已選症狀" title="清除全部" onClick={() => setSelected([])}><XIcon width={22} height={22} aria-hidden="true"/></button></div>
            <ul className="symptom-selected-list">{selected.filter(s => !SYMPTOM_TAGS.includes(s)).map(s => <li key={s}><span>{s}</span><button type="button" onClick={() => setSelected(prev => prev.filter(x => x !== s))} aria-label={`移除 ${s}`}><XIcon width={20} height={20} aria-hidden="true" /></button></li>)}</ul>
          </div>
          {error && <p role="alert" aria-live="assertive" className="symptom-error">{error}</p>}
          <button type="button" onClick={handleSave} className="symptom-save">儲存症狀紀錄</button>
        </section>

      </div>
  );
}

export function SymptomRecordTab({records,onSave,onToast,onSwitchToLog}:{
 records:GlucoseRecord[];onSave:(input:NewGlucoseInput)=>void;onToast:(message:string)=>void;onSwitchToLog:(symptom:string)=>void;
}) {
 const [range,setRange]=useState<GlucoseStatsRange>('1w');
 const [rangeOpen,setRangeOpen]=useState(false);
 const [entryOpen,setEntryOpen]=useState(false);
 const titleId=useId();
 const today=new Date();today.setHours(0,0,0,0);
 const today0=today.getTime();
 const {recordCount,counts,recent}=useMemo(()=>symptomOverview(records,range,today0),[records,range,today0]);
 return <div className="symptom-overview">
  <section className="symptom-overview-card" aria-label="近期不適">
   <header><h2>近期不適</h2><button type="button" aria-label="選擇不適統計範圍" aria-haspopup="dialog" aria-expanded={rangeOpen} onClick={()=>setRangeOpen(true)}>{GLUCOSE_STATS_RANGES.find(option=>option.id===range)!.label}<ChevronDown width={18} height={18}/></button></header>
   <p className="symptom-overview-count"><strong>{recordCount}</strong><span>次不適紀錄</span></p>
   <div className="symptom-overview-counts">{counts.map(([name,count])=><button key={name} type="button" aria-label={`${name}，${count} 次，查看日誌`} onClick={()=>onSwitchToLog(name)}>{name} {count} 次</button>)}{!counts.length&&<p>此範圍內未有不適紀錄</p>}</div>
  </section>
  <header className="symptom-recent-heading"><h2>最近紀錄</h2><span>最新 2 筆</span></header>
  <div className="symptom-recent-list">{recent.length?recent.map(record=><article key={record.id}><p>{toDateStr(record.timestamp).slice(5).replace('-','/')} {toTimeStr(record.timestamp)} · {slotLabelFor(record.timeType,record.mealTag)}</p><p>{record.symptoms.join('、')}</p></article>):<p className="symptom-recent-empty">暫時未有不適紀錄</p>}</div>
  <button type="button" className="record-sage-action" onClick={()=>setEntryOpen(true)}><Plus width={20} height={20}/>記錄這次不適</button>
  <RecordRangePicker open={rangeOpen} title="不適統計範圍" description="最近紀錄固定顯示最新兩筆，不受此範圍影響。" options={GLUCOSE_STATS_RANGES} value={range} onChange={id=>setRange(id as GlucoseStatsRange)} onClose={()=>setRangeOpen(false)}/>
  <DeviceModal open={entryOpen} onClose={()=>setEntryOpen(false)} label={titleId} className="glucose-scope record-symptom-entry">
   <header className="symptom-entry-header"><button type="button" aria-label="取消記錄不適" onClick={()=>setEntryOpen(false)}><XIcon width={22} height={22}/></button><h2 id={titleId}>記錄這次不適</h2></header>
   <div className="symptom-entry-content glucose-scope" data-record-tab="symptom"><SymptomEntryForm onSave={input=>{onSave(input);setEntryOpen(false);}} onToast={onToast}/></div>
  </DeviceModal>
 </div>;
}
