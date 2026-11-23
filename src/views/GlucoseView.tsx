import { RecordEmpty } from "../components/RecordEmpty";
import { ArrowRight, CalendarDays as CalendarIcon, ChevronDown as ChevronDownIcon, Expand, Plus } from "lucide-react";
import "../styles/log.css";
import "../styles/analysis.css";
import "../styles/health-record-colors.css";
import "../styles/health-schedule.css";
import { buildHealthScheduleRange, calendarRangeDays, DAY_PARTS, shiftCalendarDate, type DayPart } from "../data/healthSchedule";
import { dateRangeError } from "../data/dateRange";
import { HealthLogPrint } from "../components/HealthLogPrint";
import { DeviceModal } from "../components/DeviceModal";
import { localDate } from "../data/hba1c";
import { GLUCOSE_STATS_RANGES, glucoseRecordsInCalendarRange, glucoseRecordsInStatsRange, glucoseTrendAxis, type GlucoseStatsRange } from "../data/glucoseTrend";
import { buildHbA1cTrendModel } from '../data/hba1cTrend';
import { RecordRangePicker } from '../components/RecordRangePicker';
import { groupHealthLog, type HealthLogGroup } from '../data/healthLog';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GlucoseRecord, HbA1cRecord } from "../data/types";
import { glucoseStatus, slotLabelFor } from "../data/constants";
import { RangeTrendChart, type ChartPoint } from "../components/RangeTrendChart";
import { FullscreenChart } from "../components/FullscreenChart";
import { SymptomRecordTab } from "../components/SymptomRecordTab";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { NewGlucoseInput } from "../hooks/useGlucose";


const DAY = 24 * 60 * 60 * 1000;

type Tab = "analysis" | "symptom" | "log";

interface RangeOpt {
  id: string;
  label: string;
  days: number;
}

const CURVE_RANGES: RangeOpt[] = [
  { id: "1w", label: "近 1 週", days: 7 },
  { id: "2w", label: "近 2 週", days: 14 },
  { id: "1m", label: "近 1 月", days: 30 },
  { id: "3m", label: "近 3 月", days: 90 },
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtMd(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function makeXTicks(start: number, end: number, count: number) {
  const ticks: number[] = [];
  const span = end - start;
  for (let i = 0; i < count; i++) {
    ticks.push(start + (span * i) / (count - 1));
  }
  return ticks;
}

function computeStats(records: GlucoseRecord[]) {
  const valued = records.filter((r) => r.value > 0);
  if (valued.length === 0) return null;
  const values = valued.map((r) => r.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const inRange = valued.filter(
    (r) => glucoseStatus(r.value, r.timeType) === "ideal",
  ).length;
  const rate = Math.round((inRange / valued.length) * 100);

  // Extended statistics
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Population standard deviation (÷N)
  const sd = values.length > 0
    ? Math.round(Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length) * 10) / 10
    : 0;

  const fastingPreMeal = valued.filter(r => r.timeType === 'fasting' || r.timeType === 'preMeal');
  const postMeal = valued.filter(r => r.timeType === 'postMeal');
  const fastingAvg = fastingPreMeal.length > 0
    ? Math.round(fastingPreMeal.reduce((s, r) => s + r.value, 0) / fastingPreMeal.length * 10) / 10
    : null;
  const postMealAvg = postMeal.length > 0
    ? Math.round(postMeal.reduce((s, r) => s + r.value, 0) / postMeal.length * 10) / 10
    : null;

  const hypoCount = valued.filter(r => r.value < 4.0).length;
  const highCount = valued.filter(r => {
    const fastingLike = r.timeType === 'fasting' || r.timeType === 'preMeal';
    return fastingLike ? r.value > 7.0 : r.value > 10.0;
  }).length;

  const symptomCount = records.filter(r => r.timestamp >= (valued[valued.length - 1]?.timestamp ?? 0) && r.symptoms.length > 0).length;

  return { count: valued.length, avg, rate, max, min, sd, fastingAvg, postMealAvg, hypoCount, highCount, symptomCount };
}

function PrimarySegmentedTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  const opts: { id: Tab; label: string }[] = [
    { id: "analysis", label: "血糖與糖化" },
    { id: "symptom", label: "症狀紀錄" },
    { id: "log", label: "數據日誌" },
  ];
  return (
    <div
      role="tablist"
      aria-label="紀錄分類"
      className="record-tabs"
      data-active-index={opts.findIndex(option => option.id === value)}
    >
      {opts.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            id={`record-tab-${o.id}`}
            aria-controls={`record-panel-${o.id}`}
            tabIndex={active ? 0 : -1}
            aria-selected={active}
            onKeyDown={event => {
              const index = opts.findIndex(option => option.id === o.id);
              const offset = {ArrowRight:1, ArrowLeft:-1, ArrowDown:1, ArrowUp:-1}[event.key];
              const target = event.key === 'Home' ? 0 : event.key === 'End' ? opts.length - 1 : offset != null ? (index + offset + opts.length) % opts.length : null;
              if (target == null) return;
              event.preventDefault(); onChange(opts[target].id);
              document.getElementById(`record-tab-${opts[target].id}`)?.focus();
            }}
            data-voice-avoid
            onClick={() => onChange(o.id)}
            className={[
              "min-h-[60px] flex-1 rounded-[18px] px-1 hm-body font-semibold transition-colors duration-150",
              active ? "text-ink" : "text-ink-soft hover:text-ink",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function recordDateLabel(timestamp:number) {
 const date=new Date(timestamp);const today=new Date();today.setHours(0,0,0,0);const yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
 return date.toDateString()===today.toDateString()?'今天':date.toDateString()===yesterday.toDateString()?'昨天':localDate(date).replaceAll('-','/');
}

const WEEKDAY_ZH = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

function fmtDateHeader(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const wd = WEEKDAY_ZH[d.getDay()];
  return `${y}/${mo}/${day} ${wd}`;
}

const STATUS_META: Record<
  string,
  { value: string; labelColor: string; label: string }
> = {
  low: { value: "#B37400", labelColor: "#8A5A00", label: "偏低" },
  ideal: { value: "#446B51", labelColor: "#446B51", label: "正常" },
  high: { value: "#C0392B", labelColor: "#A32A20", label: "偏高" },
};

// ── GlucoseView ───────────────────────────────────────────────────────────
export function GlucoseView({
  onFullscreenChange,
  records,
  hba1cRecords,
  onRecordHbA1c,
  onOpenHbA1c,
  onRecord,
  onOpenRecord,
  onSaveSymptom,
  onDeleteRecord,
  onToast,
}: {
  onFullscreenChange?: (open: boolean) => void;
  records: GlucoseRecord[];
  hba1cRecords: HbA1cRecord[];
  onRecordHbA1c: () => void;
  onOpenHbA1c: (id: string) => void;
  onRecord: () => void;
  onOpenRecord: (id: string) => void;
  onSaveSymptom: (input: NewGlucoseInput) => void;
  onDeleteRecord: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("analysis");
  const [measure,setMeasure]=useState<"glucose"|"hba1c">("glucose");
  const panelRef=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation=panelRef.current?.animate([
      {opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'none'},
    ],{duration:200,easing:'ease-out'});
    return ()=>animation?.cancel();
  },[tab,measure]);
  const [curveMenuOpen,setCurveMenuOpen]=useState(false);
  const [curveRange, setCurveRange] = useState<string>("1w");
  const [fullscreen, setFullscreen] = useState<"curve" | "hba1c" | null>(null);
  useEffect(() => { onFullscreenChange?.(fullscreen !== null); return () => onFullscreenChange?.(false); }, [fullscreen, onFullscreenChange]);

  const [symptomFilter, setSymptomFilter] = useState<string | null>(null);

  const handleSwitchToLog = (filter: string) => {
    setSymptomFilter(filter);
    setTab("log");
  };

  const today0 = startOfToday();
  const domainEnd = today0 + DAY - 1;

  const curve = useMemo(() => {
    const days = CURVE_RANGES.find((r) => r.id === curveRange)?.days ?? 7;
    const start = today0 - (days - 1) * DAY;
    const points: ChartPoint[] = glucoseRecordsInCalendarRange(records,days,today0)
      .map((r) => ({ ts: r.timestamp, value: r.value }));
    const tickCount = 7;
    return { points, start, ...glucoseTrendAxis(points.filter(point => point.ts <= domainEnd)), xTicks: makeXTicks(start, domainEnd, tickCount) };
  }, [records, curveRange, today0, domainEnd]);
  const hba1cTrend = useMemo(() => buildHbA1cTrendModel(hba1cRecords), [hba1cRecords]);

  const latestInRange = records.filter(r => r.value > 0 && r.timestamp >= curve.start && r.timestamp <= domainEnd).reduce<GlucoseRecord | null>((latest, r) => !latest || r.timestamp > latest.timestamp ? r : latest, null);

  const [statsRange, setStatsRange] = useState<GlucoseStatsRange>("1w");
  const [statsMenuOpen, setStatsMenuOpen] = useState(false);
  const statsRangeLabel = GLUCOSE_STATS_RANGES.find(option => option.id === statsRange)!.label;
  const rangeStats = useMemo(() => {
    return computeStats(glucoseRecordsInStatsRange(records,statsRange,today0));
  }, [records, statsRange, today0]);

  const logGroups = useMemo(() => groupHealthLog(records, hba1cRecords, symptomFilter), [records, hba1cRecords, symptomFilter]);

  return (
    <>
      <div data-record-tab={tab} className="glucose-scope record-overview">
        <h1 className="sr-only">健康紀錄</h1>

        <PrimarySegmentedTabs value={tab} onChange={setTab} />

        <div ref={panelRef} role="tabpanel" id={`record-panel-${tab}`} aria-labelledby={`record-tab-${tab}`} className="record-panel" key={tab}>
        {tab === "analysis" ? (
          <div className="record-analysis">
            <section className="record-measurement-card" aria-label={measure==='glucose'?'血糖趨勢':'實測糖化趨勢'}>
              <div className="record-measure-tabs" role="tablist" aria-label="測量類型" data-active-index={measure==='glucose'?0:1}>
                {([{id:'glucose',label:'血糖'},{id:'hba1c',label:'糖化'}] as const).map(option=><button type="button" role="tab" key={option.id}
                  aria-selected={measure===option.id} aria-controls={`measurement-${option.id}`} id={`measurement-tab-${option.id}`} tabIndex={measure===option.id?0:-1}
                  onClick={()=>setMeasure(option.id)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'glucose':event.key==='End'?'hba1c':measure==='glucose'?'hba1c':'glucose';setMeasure(next);document.getElementById(`measurement-tab-${next}`)?.focus();}}}>{option.label}</button>)}
              </div>
              <div key={measure} role="tabpanel" id={`measurement-${measure}`} aria-labelledby={`measurement-tab-${measure}`} className="record-measurement-content">
              {measure==='glucose'?(latestInRange?<>
                <div className="record-latest-row"><div className="record-latest-value"><strong>{latestInRange.value.toFixed(1)}</strong><span>mmol/L</span></div>
                  <p>{recordDateLabel(latestInRange.timestamp)} {fmtTime(latestInRange.timestamp)}<br/>{slotLabelFor(latestInRange.timeType,latestInRange.mealTag)}</p>
                  <button type="button" className="record-expand" aria-label="全屏查看血糖趨勢" onClick={()=>setFullscreen('curve')}><Expand width={22} height={22}/></button></div>
                <div className="record-chart-tools"><button type="button" aria-haspopup="dialog" aria-expanded={curveMenuOpen} onClick={()=>setCurveMenuOpen(true)}>{CURVE_RANGES.find(range=>range.id===curveRange)!.label}<ChevronDownIcon width={18} height={18}/></button></div>
                <RangeTrendChart presentation="glucose" className="analysis-glucose-chart" compact overview points={curve.points} domainStart={curve.start} domainEnd={domainEnd}
                  yMin={0} yMax={curve.yMax} yTicks={curve.yTicks} xTicks={curve.xTicks} formatY={value=>`${value}`} formatX={fmtMd} formatValue={value=>`${value.toFixed(1)} mmol/L`} ariaLabel={`血糖趨勢，共 ${curve.points.length} 筆，單位 mmol/L`}/>
                <div className="record-summary-stats"><button type="button" className="record-stats-trigger" aria-haspopup="dialog" aria-expanded={statsMenuOpen} onClick={()=>setStatsMenuOpen(true)}>{statsRangeLabel}統計<ChevronDownIcon width={18} height={18}/></button>
                  {rangeStats?<>
                    <div className="record-stat-columns">
                      <div><span>平均血糖</span><strong>{rangeStats.avg.toFixed(1)}</strong></div>
                      <div><span>紀錄數量</span><strong>{rangeStats.count} 筆</strong></div>
                      <div><span>達標率</span><strong>{rangeStats.rate}%</strong></div>
                    </div>
                    <div className="record-stat-columns" style={{marginTop:8}}>
                      <div><span>最高值</span><strong>{rangeStats.max.toFixed(1)}</strong></div>
                      <div><span>最低值</span><strong>{rangeStats.min.toFixed(1)}</strong></div>
                      <div><span>標準差</span><strong>{rangeStats.sd.toFixed(1)}</strong></div>
                    </div>
                    <div className="record-stat-columns" style={{marginTop:8}}>
                      <div><span>空腹/餐前均值</span><strong>{rangeStats.fastingAvg != null ? rangeStats.fastingAvg.toFixed(1) : '—'}</strong></div>
                      <div><span>餐後均值</span><strong>{rangeStats.postMealAvg != null ? rangeStats.postMealAvg.toFixed(1) : '—'}</strong></div>
                      <div><span>低血糖次數</span><strong>{rangeStats.hypoCount}</strong></div>
                    </div>
                    {rangeStats.highCount > 0 && <div className="record-stat-columns" style={{marginTop:8}}>
                      <div><span>偏高次數</span><strong>{rangeStats.highCount}</strong></div>
                    </div>}
                  </>:<p>{statsRangeLabel}未有血糖紀錄</p>}</div>
              </>:<><RecordEmpty kind="血糖"/>{records.some(record=>record.value>0)&&<div className="record-chart-tools"><button type="button" onClick={()=>setCurveMenuOpen(true)} aria-haspopup="dialog">{CURVE_RANGES.find(range=>range.id===curveRange)!.label}<ChevronDownIcon width={18} height={18}/></button></div>}</>):(hba1cRecords.length?<>
                <div className="record-latest-row"><div className="record-latest-value"><strong>{hba1cRecords[0].value}</strong><span>%</span></div>
                  <p>{hba1cRecords[0].date.replaceAll('-','/')}<br/>{hba1cRecords[0].time||'時間未記錄'}</p>
                  <button type="button" className="record-expand" aria-label="全屏查看糖化趨勢" onClick={()=>setFullscreen('hba1c')}><Expand width={22} height={22}/></button></div>
                <div className="record-chart-tools"><strong>全部實測</strong></div>
                <RangeTrendChart presentation="glucose" className="hba1c-chart" compact overview points={hba1cTrend.points}
                  domainStart={hba1cTrend.xTicks.length>1?hba1cTrend.xTicks[0]:hba1cTrend.domainStart} domainEnd={hba1cTrend.xTicks.length>1?hba1cTrend.xTicks.at(-1)!:hba1cTrend.domainEnd}
                  yMin={hba1cTrend.yMin} yMax={hba1cTrend.yMax} yTicks={hba1cTrend.yTicks} xTicks={hba1cTrend.xTicks} formatY={value=>`${value}`} formatX={fmtMd} formatValue={value=>`${value}%`} ariaLabel={`實測 HbA1c 趨勢，共 ${hba1cRecords.length} 筆紀錄`}/>
                <div className="record-summary-stats"><h2>兩次實測比較</h2><div className="record-stat-columns"><div><span>上次結果</span><strong>{hba1cRecords[1]?`${hba1cRecords[1].value} %`:'—'}</strong></div><div><span>最近結果</span><strong>{hba1cRecords[0].value} %</strong></div><div><span>實測紀錄</span><strong>{hba1cRecords.length} 筆</strong></div></div></div>
              </>:<RecordEmpty kind="糖化"/>)}
              </div>
            </section>
            <div className="record-add-actions"><button type="button" onClick={onRecord} aria-label="記錄血糖"><Plus width={20} height={20}/>記錄血糖</button><button type="button" onClick={onRecordHbA1c} aria-label="記錄糖化"><Plus width={20} height={20}/>記錄糖化</button></div>
          </div>
        ) : tab === "symptom" ? (
          <SymptomRecordTab
            records={records}
            onSwitchToLog={handleSwitchToLog}
            onSave={onSaveSymptom}
            onToast={onToast}
          />
        ) : (
          <LogList
            groups={logGroups}
            onOpenHbA1c={onOpenHbA1c}
            onOpenRecord={onOpenRecord}
            onDeleteRecord={onDeleteRecord}
            onToast={onToast}
            symptomFilter={symptomFilter}
            onClearSymptomFilter={() => setSymptomFilter(null)}
          />
        )}
        </div>
      </div>

      <RecordRangePicker open={curveMenuOpen} title="趨勢範圍" options={CURVE_RANGES} value={curveRange} onChange={setCurveRange} onClose={()=>setCurveMenuOpen(false)}/>
      <RecordRangePicker open={statsMenuOpen} title="統計範圍" description="統計與上方趨勢範圍分開，沿用現有計算。" options={GLUCOSE_STATS_RANGES} value={statsRange} onChange={id=>setStatsRange(id as GlucoseStatsRange)} onClose={()=>setStatsMenuOpen(false)}/>

      {fullscreen === "curve" && (
        <FullscreenChart
          title="血糖趨勢"
          subtitle={`${CURVE_RANGES.find((r) => r.id === curveRange)?.label ?? ""} · 單位 mmol/L`}
          onClose={() => setFullscreen(null)}
        >
          {curve.points.length === 0 ? <div className="fullscreen-empty" role="status">
            <p>此範圍內未有血糖數據</p>
            <button type="button" onClick={() => { setFullscreen(null); onRecord(); }}>記錄血糖</button>
          </div> : <RangeTrendChart
            presentation="glucose"
            className="analysis-glucose-chart"
            latestValueLabel
            points={curve.points}
            domainStart={curve.start}
            domainEnd={domainEnd}
            yMin={0}
            yMax={curve.yMax}
            yTicks={curve.yTicks}
            xTicks={curve.xTicks}
            formatY={(v) => `${v}`}
            formatX={fmtMd}
            formatValue={(v) => `${v.toFixed(1)} mmol/L`}
            ariaLabel="全屏血糖趨勢"
            stretch
          />}
        </FullscreenChart>
      )}

      {fullscreen === "hba1c" && hba1cTrend.points.length > 0 && (
        <FullscreenChart
          title="糖化趨勢"
          subtitle={`${hba1cTrend.dateRangeLabel} · 單位 %`}
          onClose={() => setFullscreen(null)}
        >
          <RangeTrendChart
            presentation="glucose"
            className="hba1c-chart"
            points={hba1cTrend.points}
            domainStart={hba1cTrend.domainStart}
            domainEnd={hba1cTrend.domainEnd}
            yMin={hba1cTrend.yMin}
            yMax={hba1cTrend.yMax}
            yTicks={hba1cTrend.yTicks}
            xTicks={hba1cTrend.xTicks}
            formatY={(value) => `${value}%`}
            formatX={fmtMd}
            formatValue={(value) => `${value}%`}
            ariaLabel={`全屏糖化趨勢，共 ${hba1cTrend.points.length} 筆實測紀錄`}
            stretch
          />
        </FullscreenChart>
      )}

    </>
  );
}

// ── Unified Log List (unchanged from original — only computeStats above was modified) ──
function LogList({
  groups, onOpenHbA1c, onOpenRecord, onDeleteRecord, onToast, symptomFilter, onClearSymptomFilter,
}: {
  groups: HealthLogGroup[]; onOpenHbA1c: (id: string) => void; onOpenRecord: (id: string) => void;
  onDeleteRecord: (id: string) => void; onToast: (msg: string) => void;
  symptomFilter: string | null; onClearSymptomFilter: () => void;
}) {
  const today = localDate(new Date());
  const initialRange = () => {
    const end = symptomFilter && groups[0] ? groups[0].date : today;
    return {start: shiftCalendarDate(end, -6), end};
  };
  const [range, setRange] = useState(initialRange);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const rangeId = useId();
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState<{date:string; part:DayPart | 'more'} | null>(null);
  const [tableScrolled, setTableScrolled] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GlucoseRecord | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const previousFilter = useRef(symptomFilter);
  useEffect(() => {
    if (previousFilter.current === symptomFilter) return;
    previousFilter.current = symptomFilter;
    const next = initialRange();
    setRange(next); setDraftRange(next); setRangeError(null); setPage(0); setDatePickerOpen(false);
    setSelection(null);
  }, [symptomFilter, groups, today]);
  const rangeGroups = useMemo(() => groups.filter(group => group.date >= range.start && group.date <= range.end), [groups, range]);
  const totalDays = calendarRangeDays(range.start, range.end);
  const pageEnd = shiftCalendarDate(range.end, -31 * page);
  const pageStart = [range.start, shiftCalendarDate(pageEnd, -30)].sort().at(-1)!;
  const days = useMemo(() => buildHealthScheduleRange(rangeGroups, pageStart, pageEnd), [rangeGroups, pageStart, pageEnd]);
  const selectedDay = days.find(day => day.date === selection?.date);
  const detailItems = selectedDay && selection ? (selection.part === 'more' ? selectedDay.more : selectedDay.readings[selection.part]) : [];
  const movePage = (next:number) => { setPage(Math.max(0,next)); setSelection(null); };
  const applyRange = () => {
    const error = dateRangeError(draftRange.start, draftRange.end);
    setRangeError(error);
    if (error) { document.getElementById(`${rangeId}-${draftRange.start ? 'end' : 'start'}`)?.focus({preventScroll:true}); return; }
    setRange({...draftRange}); setPage(0); setSelection(null); setDatePickerOpen(false);
  };
  const openDatePicker = () => { dateTriggerRef.current?.focus({preventScroll:true}); setDraftRange({...range}); setRangeError(null); setDatePickerOpen(true); };
  const closeDatePicker = () => { setDatePickerOpen(false); setDraftRange({...range}); setRangeError(null); };
  const rangeLabel = `${range.start.replaceAll('-', '/')} – ${range.end.replaceAll('-', '/')}`;
  const select = (date:string, part:DayPart | 'more') => { setSelection(previous => previous?.date === date && previous.part === part ? null : {date,part}); };
  useEffect(() => {
    const target=detailRef.current,scroller=target?.closest('main');
    if(selection && target && scroller)scroller.scrollTo({top:scroller.scrollTop+target.getBoundingClientRect().top-scroller.getBoundingClientRect().top,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 'auto' : 'smooth'});
  }, [selection]);
  const confirmDelete = () => {
    if (pendingDelete) { try { onDeleteRecord(pendingDelete.id); onToast("已刪除紀錄"); } catch { onToast("未能刪除，原有紀錄已保留。請再試一次。"); } }
    setPendingDelete(null);
  };
  const tags = (symptoms: string[]) => symptoms.length > 0 && <span className="log-symptom-tags">
    {symptoms.map((symptom, index) => <span key={symptom} data-active={symptomFilter === symptom}>{index > 0 ? "、" : ""}{symptom}</span>)}
  </span>;

  return <div className="health-log health-schedule">
    {symptomFilter && <div className="log-filter" data-voice-avoid>
      <h2>目前篩選：{symptomFilter}</h2><p>表格只顯示包含此症狀的紀錄。</p>
      <button type="button" onClick={onClearSymptomFilter}>清除篩選</button>
    </div>}
    <div className="schedule-range-summary" aria-live="polite">
      <button ref={dateTriggerRef} className="schedule-range-trigger" type="button" aria-label={`選擇日期範圍，目前 ${rangeLabel}`} aria-haspopup="dialog" aria-expanded={datePickerOpen} onClick={openDatePicker} data-voice-avoid>
        <CalendarIcon width={24} height={24} aria-hidden="true"/>
        <span className="schedule-range-dates"><span className="schedule-range-label">日期範圍</span><span className="schedule-range-value">
          <time dateTime={range.start}>{range.start.slice(0,4)!==range.end.slice(0,4)&&`${range.start.slice(0,4)}年`}{Number(range.start.slice(5,7))}月{Number(range.start.slice(8))}日</time> — <time dateTime={range.end}>{range.start.slice(0,4)!==range.end.slice(0,4)&&`${range.end.slice(0,4)}年`}{Number(range.end.slice(5,7))}月{Number(range.end.slice(8))}日</time>
        </span></span>
        <ChevronDownIcon width={20} height={20} aria-hidden="true"/>
      </button>
    </div>
    {rangeGroups.length === 0 && <p role="status" className="schedule-notice">{symptomFilter ? `所選日期內沒有包含「${symptomFilter}」的紀錄，試試調整日期或清除篩選。` : '所選日期範圍內未有紀錄。'}</p>}
    {totalDays > 31 && <nav className="schedule-pagination" aria-label="表格分頁">
      <p aria-live="polite">目前顯示 {pageStart.replaceAll('-', '/')} – {pageEnd.replaceAll('-', '/')}</p>
      <button type="button" onClick={() => movePage(page + 1)} disabled={(page + 1) * 31 >= totalDays}>較早日期</button>
      <span>第 {page + 1} / {Math.ceil(totalDays / 31)} 頁</span>
      <button type="button" onClick={() => movePage(page - 1)} disabled={page === 0}>較近日期</button>
    </nav>}
    <p id="schedule-scroll-hint" className="schedule-summary-meta"><span>共 {rangeGroups.reduce((count,group) => count + group.items.length, 0)} 筆紀錄 · mmol/L</span><span>左右查看時段 →</span></p>
    <div className="schedule-scroll" data-scrolled={tableScrolled || undefined} onScroll={event => setTableScrolled(event.currentTarget.scrollLeft > 0)} role="region" aria-label="所選日期健康紀錄表格" aria-describedby="schedule-scroll-hint" tabIndex={0}>
      <table className="schedule-table">
        <caption className="sr-only">所選日期健康紀錄，日期由近至遠；血糖單位 mmol/L</caption>
        <thead><tr><th scope="col">日期</th>{DAY_PARTS.map(part => <th key={part.id} scope="col" aria-label={`${part.label}血糖`}>{part.label}</th>)}<th scope="col">更多紀錄</th></tr></thead>
        <tbody key={pageEnd}>{days.map(day => <tr key={day.date}>
          <th scope="row"><time dateTime={day.date}><span>{day.date.slice(0,4)}</span><strong>{day.date.slice(5).replace('-', '/')}</strong></time><span>{fmtDateHeader(new Date(day.date+'T12:00:00').getTime()).split(' ')[1]}</span></th>
          {DAY_PARTS.map(part => {
            const entries = day.readings[part.id];
            const latest = entries[0];
            const meta = latest ? STATUS_META[glucoseStatus(latest.value,latest.timeType)] : null;
            return <td key={part.id}>{latest && meta ? <button type="button" className="schedule-reading" aria-label={`${day.date} ${part.label}血糖 ${latest.value.toFixed(1)}，${meta.label}，共 ${entries.length} 筆，查看紀錄`} aria-expanded={selection?.date === day.date && selection.part === part.id} aria-controls="schedule-detail" onClick={() => select(day.date,part.id)}>
              <strong style={{color:meta.value}}>{latest.value.toFixed(1)}</strong><span>{latest.time}</span><span className="schedule-status" style={{color:meta.labelColor}}>{meta.label}</span>{entries.length > 1 && <span>共 {entries.length} 筆</span>}
            </button> : <span className="schedule-missing" aria-label={symptomFilter ? '無符合紀錄' : '未有紀錄'}>—</span>}</td>;
          })}
          <td>{day.more.length ? <button type="button" className="schedule-more" aria-expanded={selection?.date === day.date && selection.part === 'more'} aria-controls="schedule-detail" onClick={() => select(day.date,'more')}>
            {day.hba1cCount > 0 && <span className="schedule-hba1c">糖化 {day.hba1cCount} 筆</span>}{day.symptomCount > 0 && <span className="schedule-symptom">症狀 {day.symptomCount} 筆</span>}<span>{selection?.date === day.date && selection.part === 'more' ? '收起' : '展開'}紀錄</span>
          </button> : <span className="schedule-missing" aria-label={symptomFilter ? '無符合紀錄' : '未有紀錄'}>—</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {selection && <section id="schedule-detail" className="schedule-detail" ref={detailRef} aria-label="紀錄詳情">
      <header data-voice-avoid><h2>{selection.date.replaceAll('-', '/')} · {selection.part === 'more' ? '更多紀錄' : `${DAY_PARTS.find(part => part.id === selection.part)?.label}血糖`}</h2></header>
      {detailItems.length === 0 && <p className="schedule-notice">此項目已沒有紀錄。</p>}
      <div className="log-entries">
          {detailItems.map(record => {
            if (record.kind === "hba1c") {
              return <article key={`hba1c:${record.id}`} className="log-entry log-hba1c-entry">
                <h3 className="log-entry-title">糖化 HbA1c {record.value} %</h3>
                <p className="log-entry-time">{record.time || "時間未記錄"}</p>
                <button type="button" className="log-edit" onClick={() => onOpenHbA1c(record.id)}>查看／編輯糖化</button>
              </article>;
            }
            const slot = slotLabelFor(record.timeType, record.mealTag);
            if (record.value > 0) {
              const status = glucoseStatus(record.value, record.timeType);
              const meta = STATUS_META[status];
              return <article key={`glucose:${record.id}`} className="log-entry" data-status={status}>
                <h3 className="log-reading">{record.value.toFixed(1)} mmol/L</h3>
                <span className="log-status" style={{color:meta.labelColor}}>{meta.label}</span>
                <p className="log-entry-time">{fmtTime(record.timestamp)} · {slot}</p>
                {tags(record.symptoms)}
                <button type="button" className="log-edit" onClick={() => onOpenRecord(record.id)}>查看／編輯血糖</button>
              </article>;
            }
            return <article key={`glucose:${record.id}`} className="log-entry log-symptom-entry">
              <h3 className="log-entry-title">症狀紀錄</h3>
              <p className="log-entry-time">{fmtTime(record.timestamp)} · {slot}</p>
              {tags(record.symptoms)}
              <p className="log-no-reading">未有血糖讀數</p>
              <button type="button" className="log-delete" data-voice-avoid onClick={() => setPendingDelete(record)} aria-label={`刪除 ${slot} ${fmtTime(record.timestamp)} 的症狀紀錄`}>刪除症狀紀錄</button>
            </article>;
          })}
        </div>
        <button type="button" className="log-edit" onClick={() => setSelection(null)}>收起紀錄</button>
      </section>}
    <footer className="schedule-export" data-voice-avoid>
      <button className="schedule-print" type="button" onClick={() => {try {window.print();} catch {onToast('未能開啟列印，請使用瀏覽器的列印功能。');}}}>列印／儲存為 PDF</button>
    </footer>
    <DeviceModal open={datePickerOpen} onClose={closeDatePicker} label={`${rangeId}-title`} className="schedule-date-modal">
      <form className="schedule-date-range" aria-label="日誌日期範圍" data-voice-avoid onSubmit={event => { event.preventDefault(); applyRange(); }} noValidate>
        <div className="schedule-date-handle" aria-hidden="true"><span/></div>
        <header className="schedule-date-header"><h2 id={`${rangeId}-title`}>選擇日期範圍</h2></header>
        <div className="schedule-date-fields">
          <label htmlFor={`${rangeId}-start`}>開始日期（由）
            <input id={`${rangeId}-start`} type="date" value={draftRange.start} aria-invalid={!!rangeError || undefined} aria-describedby={rangeError ? `${rangeId}-error` : undefined} onChange={event => { setDraftRange(previous => ({...previous,start:event.target.value})); setRangeError(null); }}/>
          </label>
          <label htmlFor={`${rangeId}-end`}>結束日期（至）
            <input id={`${rangeId}-end`} type="date" value={draftRange.end} aria-invalid={!!rangeError || undefined} aria-describedby={rangeError ? `${rangeId}-error` : undefined} onChange={event => { setDraftRange(previous => ({...previous,end:event.target.value})); setRangeError(null); }}/>
          </label>
        </div>
        {rangeError && <p id={`${rangeId}-error`} role="alert" className="schedule-range-error">{rangeError}</p>}
        <button className="schedule-recent" type="button" onClick={() => {setDraftRange({start:shiftCalendarDate(today,-6),end:today}); setRangeError(null);}}>最近一週</button>
        <button type="submit" className="schedule-apply">確認日期</button>
        <button type="button" className="schedule-cancel" onClick={closeDatePicker}>取消</button>
      </form>
    </DeviceModal>
    <ConfirmDialog appearance="record" open={pendingDelete !== null} title="刪除這筆症狀紀錄？" message="刪除後無法復原，這筆紀錄將從數據日誌及統計中移除。" onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
    <HealthLogPrint groups={rangeGroups} start={range.start} end={range.end} symptomFilter={symptomFilter}/>
  </div>;
}