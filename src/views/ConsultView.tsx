import { DeviceModal } from '../components/DeviceModal';
import ReactMarkdown from "react-markdown";
import { chat } from "../services/ai";
import { confirmMemory, deleteMemory, listMemories, type MemoryEntry } from "../services/memories";
import type { HealthContext } from "../../shared/ai";
import { chatHistory, migrateConversations, type ChatMsg, type Conversation, type SaveSuggestionState } from "../data/chat";
import { questionComparisonKey, toHongKongChinese } from "../../shared/locale";
import { ChatComposer } from "../components/ChatComposer";
import { DoctorQuestionNote } from "../components/DoctorQuestionNote";
import { SavedFeedback } from "../components/SavedFeedback";
import { storageKey } from "../services/storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { appointmentDateLabel } from "../components/AppointmentCard";
import { Toast } from "../components/Toast";
import { ChartLine, ChevronDown, ChevronRight, Eye, Menu, Pill, SquarePen, TriangleAlert, Utensils } from "lucide-react";
import chatRobot from "../assets/chat/robot.webp";
import glucoseBackdrop from "../assets/chat/topic-glucose.webp";
import emergencyBackdrop from "../assets/chat/topic-emergency.webp";
import dietBackdrop from "../assets/chat/topic-diet.webp";
import medicationBackdrop from "../assets/chat/topic-medication.webp";
import {
  BookmarkIcon,
  CheckIcon,
  ComposeIcon,
  CopyIcon,
  SparkleIcon,
  ThumbDownIcon,
  ThumbUpIcon,
  XIcon,
} from "../components/icons";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SuggestionEntry {
  state: SaveSuggestionState;
  saving: boolean;
  error: string | null;
}

// ── Value category labels ──────────────────────────────────────────────────────
const VALUE_CATEGORY_LABELS: Record<string, string> = {
  Effectiveness: '治療效果',
  Safety: '安全性',
  Cost: '醫療費用',
  Convenience: '使用便利',
  'Quality of Life': '生活品質',
  Autonomy: '自主控糖',
  'Psychological Burden': '心理負擔',
  'Administration/Pain': '注射疼痛',
};

// ── Storage keys ───────────────────────────────────────────────────────────────
const conversationsKey = () => storageKey("conversations");
const DAY = 86_400_000;

// ── Quick questions ────────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  "幫我解讀最近的血糖數據",
  "血糖突然很高或很低怎麼辦？",
  "糖尿病患者日常飲食有什麼建議？",
  "糖尿病藥物常見的副作用有哪些？",
  "糖尿病常見的長期併發症有哪些？",
];

// ── Utilities ──────────────────────────────────────────────────────────────────
function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("zh-HK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createEmptyConv(): Conversation {
  return { id: genId(), title: "", messages: [], createdAt: Date.now() };
}

function loadConversations(): Conversation[] {
  const key = conversationsKey();
  const raw = localStorage.getItem(key);
  if (raw) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error("對話紀錄未能讀取，原有資料已保留。"); }
    const migrated = migrateConversations(parsed);
    if (migrated.length) {
      if (JSON.stringify(migrated) !== raw) {
        if (!localStorage.getItem(`${key}_pre_live_ai`)) localStorage.setItem(`${key}_pre_live_ai`, raw);
        saveConvs(migrated);
      }
      return migrated;
    }
  }
  const initial = [createEmptyConv()];
  saveConvs(initial);
  return initial;
}
function saveConvs(convs: Conversation[]) { localStorage.setItem(conversationsKey(), JSON.stringify(convs)); }

/** Parse pros/cons bullet-point text into array of clean strings */
function parseBulletPoints(text: string): string[] {
  return text.split('\n')
    .map(line => line.replace(/^[\s]*[-•*▪●]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '').replace(/^[\s]*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').trim())
    .filter(Boolean);
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({
  open, conversations, activeId, onSelect, onNewChat, onClose,
}: {
  open: boolean; conversations: Conversation[]; activeId: string;
  onSelect: (id: string) => void; onNewChat: () => void; onClose: () => void;
}) {
  const today0 = startOfToday();
  const history = conversations.filter((c) => c.messages.length > 0);
  const groups = [
    { label: "今日", items: history.filter((c) => c.createdAt >= today0) },
    { label: "昨日", items: history.filter((c) => c.createdAt >= today0 - DAY && c.createdAt < today0) },
    { label: "過去 7 天", items: history.filter((c) => c.createdAt >= today0 - 7 * DAY && c.createdAt < today0 - DAY) },
    { label: "更早", items: history.filter((c) => c.createdAt < today0 - 7 * DAY) },
  ].filter((g) => g.items.length > 0);

  return (
    <DeviceModal open={open} label="chat-history-title" onClose={onClose} placement="drawer" className="chat-scope">
      <div className="chat-drawer-panel">
        <header className="chat-drawer-header">
          <h2 id="chat-history-title">對話紀錄</h2>
          <button type="button" onClick={onClose} aria-label="關閉側欄"><XIcon width={24} height={24} /></button>
        </header>
        <div className="chat-drawer-new">
          <button type="button" onClick={() => { onNewChat(); onClose(); }}>
            <ComposeIcon width={22} height={22} /><span>新對話</span>
          </button>
        </div>
        <div className="chat-history-list">
          {groups.length === 0 ? (
            <div className="chat-history-empty">
              <span className="chat-empty-icon"><BookmarkIcon width={28} height={28} /></span>
              <h3>尚未有對話紀錄</h3><p>開始對話後，可在這裡查看。</p>
            </div>
          ) : groups.map((g) => (
            <section key={g.label} className="chat-history-group">
              <h3>{g.label}</h3>
              {g.items.map((c) => (
                <button type="button" key={c.id} aria-current={c.id === activeId ? "page" : undefined}
                  onClick={() => { onSelect(c.id); onClose(); }}>
                  <span className="chat-history-mark" aria-hidden="true">
                    {c.id === activeId && <CheckIcon width={16} height={16} />}
                  </span>
                  <span>{c.title || "新對話"}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      </div>
    </DeviceModal>
  );
}

// ── WelcomeScreen ──────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { q: QUICK_QUESTIONS[0], icon: ChartLine, title: "解讀血糖數據", desc: "了解近期血糖變化", backdrop: glucoseBackdrop },
  { q: QUICK_QUESTIONS[1], icon: TriangleAlert, title: "突發情況處理", desc: "血糖過高或過低", backdrop: emergencyBackdrop },
  { q: QUICK_QUESTIONS[2], icon: Utensils, title: "飲食建議", desc: "日常飲食怎樣選", backdrop: dietBackdrop },
  { q: QUICK_QUESTIONS[3], icon: Pill, title: "藥物副作用", desc: "了解常見副作用", backdrop: medicationBackdrop },
  { q: QUICK_QUESTIONS[4], icon: Eye, title: "常見併發症", desc: "眼底、腎病變等", backdrop: glucoseBackdrop },
];

function WelcomeScreen({ onSend }: { onSend: (q: string) => void }) {
  return (
    <div className="chat-welcome">
      <div className="chat-guide">
        <img className="chat-guide-robot" src={chatRobot} alt="" aria-hidden="true" />
        <h2>今天想問甚麼？</h2>
        <p>選個主題，或直接輸入問題。</p>
      </div>
      <div data-keyboard-chrome="chat"><div className="chat-topics">
        {SUGGESTIONS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button key={s.q} type="button" aria-label={`${s.title}：${s.desc}`}
              onClick={() => onSend(s.q)} className={`chat-topic chat-topic-${i}`}>
              <img className="chat-topic-backdrop" src={s.backdrop} alt="" aria-hidden="true" />
              <span className="chat-topic-icon"><Icon width={29} height={29} strokeWidth={1.8} aria-hidden="true" /></span>
              <span className="chat-topic-arrow" aria-hidden="true"><ChevronRight width={21} height={21} strokeWidth={1.8} /></span>
              <span className="chat-topic-title">{s.title}</span>
              <span className="chat-topic-description">{s.desc}</span>
            </button>
          );
        })}
      </div></div>
    </div>
  );
}

// ── UserBubble ─────────────────────────────────────────────────────────────────
function UserBubble({ msg }: { msg: ChatMsg }) {
  return (
    <div className="chat-user-message">
      <div className="chat-user-message-inner">
        <div className="chat-user-bubble"><p>{msg.text}</p></div>
        <p className="sr-only">{fmtTime(msg.timestamp)}</p>
      </div>
    </div>
  );
}

// ── AiBubble ───────────────────────────────────────────────────────────────────
function AiBubble({ msg, liked, disliked, onLike, onDislike, onSaveItem }: {
  msg: ChatMsg; liked: boolean; disliked: boolean;
  onLike: () => void; onDislike: () => void;
  onSaveItem: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(toHongKongChinese(msg.text)).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const hasBrief = msg.briefVersion?.takeHomeMessages?.length;
  const hasDetailed = msg.detailedVersion && (
    msg.detailedVersion.generalExplanation ||
    msg.detailedVersion.optionComparison?.length ||
    msg.detailedVersion.suggestedDiscussionPoints?.length
  );

  return (
    <div className="chat-ai-message">
      <div className="chat-answer-bubble">
        <div className="chat-answer hm-body text-ink leading-relaxed">
          <ReactMarkdown skipHtml allowedElements={['p','strong','em','ul','ol','li','br','blockquote','code']} unwrapDisallowed>
            {toHongKongChinese(msg.text)}
          </ReactMarkdown>
        </div>
      </div>

      {/* briefVersion — takeHomeMessages */}
      {!!hasBrief && (
        <section className="mt-3 rounded-[20px] bg-sage p-4" aria-label="重點速覽">
          <p className="mb-2 t-support font-semibold text-ink">📋 重點速覽</p>
          <ul className="flex flex-col gap-2">
            {msg.briefVersion!.takeHomeMessages.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 flex-1 hm-body text-ink leading-relaxed">
                  <ReactMarkdown skipHtml allowedElements={['strong','em']} unwrapDisallowed>{item}</ReactMarkdown>
                </span>
                <button type="button" onClick={() => onSaveItem(item)} aria-label="保存到備忘"
                  className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-field">
                  <BookmarkIcon width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* detailedVersion — collapsible */}
      {hasDetailed && (
        <div className="mt-2">
          <button type="button" onClick={() => setDetailOpen(!detailOpen)}
            className="flex min-h-[44px] items-center gap-2 rounded-[14px] px-3 py-2 t-support font-semibold text-ink-soft hover:bg-field"
            aria-expanded={detailOpen}>
            {detailOpen ? '收起詳細說明' : '查看詳細說明'}
            <ChevronDown width={18} height={18} className={`transition-transform ${detailOpen ? 'rotate-180' : ''}`} />
          </button>
          {detailOpen && (
            <div className="mt-2 flex flex-col gap-4 rounded-[20px] bg-field p-4 animate-fade-in">
              {/* generalExplanation */}
              {msg.detailedVersion!.generalExplanation && (
                <div className="hm-body text-ink leading-relaxed">
                  <ReactMarkdown skipHtml allowedElements={['p','strong','em','ul','ol','li','br','blockquote','code']} unwrapDisallowed>
                    {msg.detailedVersion!.generalExplanation}
                  </ReactMarkdown>
                </div>
              )}
              {/* optionComparison */}
              {!!msg.detailedVersion!.optionComparison?.length && (
                <div className="flex flex-col gap-3">
                  <p className="t-support font-semibold text-ink">⚖️ 方案利弊對照</p>
                  {msg.detailedVersion!.optionComparison.map((opt, i) => (
                    <div key={i} className="rounded-[16px] bg-surface p-4">
                      <p className="mb-2 hm-body font-semibold text-ink">{opt.option}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="mb-1 t-support font-semibold text-positive">好處</p>
                          <ul className="flex flex-col gap-1">
                            {parseBulletPoints(opt.pros).map((p, j) => (
                              <li key={j} className="t-support text-ink">• {p}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-1 t-support font-semibold text-warning">考慮</p>
                          <ul className="flex flex-col gap-1">
                            {parseBulletPoints(opt.cons).map((c, j) => (
                              <li key={j} className="t-support text-ink">• {c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* suggestedDiscussionPoints */}
              {!!msg.detailedVersion!.suggestedDiscussionPoints?.length && (
                <div>
                  <p className="mb-2 t-support font-semibold text-ink">🩺 就診提問建議</p>
                  <ul className="flex flex-col gap-2">
                    {msg.detailedVersion!.suggestedDiscussionPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 flex-1 t-support text-ink">{point}</span>
                        <button type="button" onClick={() => onSaveItem(point)} aria-label="保存到備忘"
                          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface">
                          <BookmarkIcon width={16} height={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="chat-answer-actions">
        <p className="mr-auto t-support text-ink-muted">{fmtTime(msg.timestamp)}</p>
        {copied && <span className="mr-2 t-support font-semibold text-ok-text">已複製</span>}
        <button type="button" onClick={handleCopy} aria-label="複製"
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-field hover:text-ink-soft">
          <CopyIcon width={20} height={20} />
        </button>
        <button type="button" onClick={onLike} aria-label="有幫助" aria-pressed={liked}
          className={`flex h-[52px] w-[52px] items-center justify-center rounded-full transition-colors hover:bg-field ${liked ? "text-ok-text" : "text-ink-muted hover:text-ink-soft"}`}>
          <ThumbUpIcon width={20} height={20} />
        </button>
        <button type="button" onClick={onDislike} aria-label="沒有幫助" aria-pressed={disliked}
          className={`flex h-[52px] w-[52px] items-center justify-center rounded-full transition-colors hover:bg-field ${disliked ? "text-ink" : "text-ink-muted hover:text-ink-soft"}`}>
          <ThumbDownIcon width={20} height={20} />
        </button>
      </div>
    </div>
  );
}

// ── PreferenceCards ─────────────────────────────────────────────────────────────
function PreferenceCards({ msg, onSubmit }: {
  msg: ChatMsg;
  onSubmit: (formattedText: string) => void;
}) {
  const questions = msg.preferenceQuestions || [];
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map());
  const [otherText, setOtherText] = useState('');

  if (!questions.length) return null;

  const toggle = (qId: string, optCategory: string) => {
    setSelections(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(qId) || []);
      if (set.has(optCategory)) set.delete(optCategory); else set.add(optCategory);
      next.set(qId, set);
      return next;
    });
  };

  const totalSelections = Array.from(selections.values()).reduce((sum, set) => sum + set.size, 0) + (otherText.trim() ? 1 : 0);

  const handleSubmit = () => {
    const lines: string[] = ['我已選擇我的個人偏好（決策考量維度）：'];
    for (const q of questions) {
      const selected = selections.get(q.id);
      if (selected) {
        for (const opt of q.options) {
          if (selected.has(opt.valueCategory)) {
            lines.push(`- 針對「${q.questionText}」，我最看重：【${opt.label}】（價值維度：${opt.valueCategory}）`);
          }
        }
      }
    }
    if (otherText.trim()) {
      const firstQ = questions[0];
      lines.push(`- 針對「${firstQ?.questionText || '治療方案'}」，我有其他考量：【${otherText.trim()}】（價值維度：其他）`);
    }
    onSubmit(lines.join('\n'));
  };

  return (
    <section className="mt-3 rounded-[24px] bg-lilac p-5 animate-fade-in-up" aria-label="偏好選擇">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
          <SparkleIcon width={20} height={20} />
        </span>
        <div>
          <p className="hm-cardtitle text-ink">你最在意甚麼？</p>
          <p className="t-support text-ink-soft">選擇對你最重要的考量，AI 會據此量身建議</p>
        </div>
      </div>

      {questions.map(q => (
        <div key={q.id} className="mb-4">
          <p className="mb-2 hm-body font-semibold text-ink">{q.questionText}</p>
          <div className="flex flex-col gap-2">
            {q.options.map(opt => {
              const isSelected = selections.get(q.id)?.has(opt.valueCategory);
              return (
                <button key={opt.valueCategory} type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(q.id, opt.valueCategory)}
                  className={`flex items-center gap-3 rounded-[18px] p-4 text-left transition-colors ${isSelected ? 'bg-surface ring-2 ring-ink/25' : 'bg-surface/60 hover:bg-surface'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${isSelected ? 'border-ink bg-ink text-white' : 'border-ink-muted'}`}>
                    {isSelected && <CheckIcon width={16} height={16} />}
                  </span>
                  <span className="flex-1">
                    <span className="block hm-body font-semibold text-ink">{opt.label}</span>
                    <span className="block t-support text-ink-soft">{opt.description}</span>
                    <span className="block mt-1 t-support text-ink-muted">
                      {VALUE_CATEGORY_LABELS[opt.valueCategory] || opt.valueCategory}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Other custom concern */}
      <div className="mb-4">
        <p className="mb-2 t-support font-semibold text-ink">其他個人考量（選填）</p>
        <input type="text" value={otherText} onChange={e => setOtherText(e.target.value)}
          placeholder="輸入你的其他顧慮"
          className="w-full min-h-[48px] rounded-[14px] border border-ink/10 bg-surface px-4 py-3 hm-body text-ink placeholder:text-ink-muted" />
      </div>

      <button type="button" disabled={totalSelections === 0} onClick={handleSubmit}
        className={`flex min-h-[56px] w-full items-center justify-center rounded-[20px] hm-btn transition-transform duration-150 ease-out ${totalSelections > 0 ? 'bg-action text-white active:scale-[0.97]' : 'cursor-not-allowed bg-disabled text-ink-soft'}`}>
        確認提交（已選 {totalSelections} 項）
      </button>
    </section>
  );
}

// ── SaveSuggestionCard ─────────────────────────────────────────────────────────
function SaveSuggestionCard({ doctorQuestion, entry, onSave, onDismiss, onRestore, onExpand }: {
  doctorQuestion: string; entry: SuggestionEntry;
  onSave: () => void; onDismiss: () => void; onRestore: () => void; onExpand: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevStateRef = useRef<SaveSuggestionState>(entry.state);
  useEffect(() => {
    const prev = prevStateRef.current; prevStateRef.current = entry.state;
    if ((prev === "pending" || prev === "saved") && (entry.state === "dismissed" || entry.state === "collapsed")) {
      const t = setTimeout(() => { wrapperRef.current?.querySelector<HTMLElement>("button")?.focus(); }, 60);
      return () => clearTimeout(t);
    }
  }, [entry.state]);

  if (entry.state === "dismissed") {
    return (<div ref={wrapperRef} className="flex items-center justify-between gap-3 rounded-[20px] bg-field px-5 py-4 animate-fade-in-up" role="status" aria-label="已略過覆診問題">
      <p className="t-support text-ink-soft">已略過這個覆診問題</p>
      <button type="button" onClick={onRestore} className="shrink-0 t-support font-semibold text-ink hover:opacity-70 active:scale-[0.96] transition-all duration-150">復原</button>
    </div>);
  }
  if (entry.state === "collapsed") {
    return (<div ref={wrapperRef} className="flex items-center justify-between gap-3 rounded-[20px] bg-sun px-5 py-4 animate-fade-in-up" role="status" aria-label="有覆診問題尚未處理">
      <p className="t-support font-semibold text-ink">有一個覆診問題尚未處理</p>
      <button type="button" onClick={onExpand} className="shrink-0 t-support font-semibold text-ink hover:opacity-70 active:scale-[0.96] transition-all duration-150">查看</button>
    </div>);
  }

  return (
    <section ref={wrapperRef} className="rounded-[24px] bg-lilac p-5 shadow-[0_8px_24px_rgba(35,38,31,0.06)] animate-fade-in-up" aria-label="覆診問題建議">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink"><BookmarkIcon width={20} height={20} /></span>
        <div><p className="hm-cardtitle text-ink">下次覆診可以問醫生</p><p className="t-support text-ink-soft">AI 已把重點整理成一句問題</p></div>
      </div>
      <blockquote className="mb-4 rounded-[18px] bg-surface/70 px-4 py-3.5 hm-body text-ink leading-relaxed">{doctorQuestion}</blockquote>
      <div aria-live="polite" aria-atomic="true">
        {entry.state === "pending" && entry.error && <p className="mb-3 t-support font-semibold text-danger" role="alert">{entry.error}</p>}
        {entry.state === "saved" && <p className="mb-3 t-support font-semibold chat-saved-state">已保存，可在「問題」查看。</p>}
      </div>
      {entry.state === "pending" && (
        <div className="flex flex-col gap-2.5">
          <button type="button" disabled={entry.saving} onClick={onSave} aria-label={entry.saving ? "正在保存…" : "保存覆診問題到備忘"}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-action hm-btn text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60">
            {!entry.saving && <BookmarkIcon width={22} height={22} />}{entry.saving ? "正在保存…" : entry.error ? "重新嘗試" : "保存到備忘"}
          </button>
          <button type="button" disabled={entry.saving} onClick={onDismiss}
            className="flex min-h-[56px] w-full items-center justify-center rounded-[20px] bg-surface hm-btn text-ink transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60">
            暫不保存
          </button>
        </div>
      )}
      {entry.state === "saved" && (
        <div className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-surface hm-btn chat-saved-state" aria-label="已保存到備忘">
          <CheckIcon width={22} height={22} />已保存到備忘
        </div>
      )}
    </section>
  );
}

function AppointmentReminderCard({ reminder }: { reminder: NonNullable<ChatMsg['appointmentReminder']> }) {
  const when = reminder.daysUntil === 0 ? "今天" : reminder.daysUntil === 1 ? "明天" : `${reminder.daysUntil} 日後`;
  return <section className="rounded-[24px] bg-lilac p-5" aria-label="覆診提醒">
    <p className="hm-cardtitle text-ink">覆診提醒</p>
    <p className="mt-2 hm-body text-ink">您在{when}（{appointmentDateLabel(reminder.date)}）有覆診。</p>
    {reminder.time && <p className="mt-1 t-support text-ink-soft">時間：{reminder.time}</p>}
    {reminder.location && <p className="mt-1 t-support text-ink-soft">地點：{reminder.location}</p>}
  </section>;
}

const memoryCategoryLabel = (category:MemoryEntry['category']) => ({medication:'藥物資料',lifestyle:'生活習慣',care_context:'照顧情況'}[category]);

function MemoryPanel({memories,busy,onConfirm,onDelete}:{memories:MemoryEntry[];busy:Set<string>;onConfirm:(id:string)=>void;onDelete:(id:string)=>void;}) {
  const visible=memories.filter(memory=>memory.state==='pending'||memory.state==='confirmed');
  return <section className="chat-memory-controls mx-4 mb-3 max-h-[240px] overflow-y-auto rounded-[20px] bg-surface p-4 shadow-sm" aria-label="AI 記憶">
    <h2 className="hm-cardtitle text-ink">AI 記憶</h2>
    <p className="mt-1 t-support text-ink-soft">只有您確認的內容才會在新對話使用。</p>
    {visible.length===0?<p className="mt-3 hm-body text-ink-soft">暫時沒有記憶。</p>:<div className="mt-3 flex flex-col gap-3">{visible.map(memory=><div key={memory.id} className="rounded-[16px] bg-field p-3">
      <p className="t-support text-ink-soft">{memoryCategoryLabel(memory.category)} · {memory.state==='pending'?'待確認':'已確認'}</p>
      <p className="mt-1 hm-body text-ink">{memory.text}</p>
      <div className="mt-2 flex gap-2">
        {memory.state==='pending'&&<button type="button" disabled={busy.has(memory.id)} onClick={()=>onConfirm(memory.id)} className="min-h-[48px] rounded-[16px] bg-action px-4 text-white">確認記住</button>}
        <button type="button" disabled={busy.has(memory.id)} onClick={()=>onDelete(memory.id)} className="min-h-[48px] rounded-[16px] bg-surface px-4 text-ink">{memory.state==='pending'?'不保存':'忘記'}</button>
      </div>
    </div>)}</div>}
  </section>;
}

function LoadingBubble() {
  return (
    <div className="px-1">
      <div className="rounded-[24px] rounded-tl-[8px] bg-surface p-5 shadow-[0_8px_24px_rgba(35,38,31,0.06)]">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage text-ink"><SparkleIcon width={20} height={20} /></span>
          <span className="hm-body font-semibold text-ink">AI 助理</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hm-body text-ink-soft">正在為您查詢</span>
          <span className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (<span key={i} className="h-2.5 w-2.5 rounded-full bg-ink/40" style={{animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s`}} />))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main ConsultView ───────────────────────────────────────────────────────────
export function ConsultView({ onToast, savedQuestions, onSaveQuestion, onOpenQuestions, health }: {
  onToast?: (msg: string) => void;
  savedQuestions: string[];
  onSaveQuestion: (question: string) => Promise<void>;
  onOpenQuestions: () => void;
  health: HealthContext;
}) {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const retryPhotos = useRef(new Map<string,Blob>());
  useEffect(() => {setPhoto(null);retryPhotos.current.clear();return () => retryPhotos.current.clear();}, [activeId]);
  const [loading, setLoading] = useState(false);
  const voiceBusy = useRef(false);
  const setVoiceBusy = useCallback((busy: boolean) => { voiceBusy.current = busy; }, []);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [disliked, setDisliked] = useState<Set<string>>(new Set());
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [questionNoteOpen, setQuestionNoteOpen] = useState(false);
  const [questionNoteSaved, setQuestionNoteSaved] = useState(false);
  const questionNoteTrigger = useRef<HTMLButtonElement>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<string,string>>({});
  const cloudMode = import.meta.env?.VITE_CLOUD_MODE === 'true';
  const [memories,setMemories] = useState<MemoryEntry[]>([]);
  const [memoryOpen,setMemoryOpen] = useState(false);
  const [memoryBusy,setMemoryBusy] = useState<Set<string>>(new Set());
  const request = useRef<{ controller: AbortController; conversationId: string; messageId: string } | null>(null);
  const saving = useRef(new Set<string>());
  const conversationsRef = useRef(conversations);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageScroller = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId);
  const messages = activeConv?.messages ?? [];
  const hasMessages = messages.length > 0;

  const followLatest = useRef(true);
  useEffect(() => {
    if (hasMessages && followLatest.current && messageScroller.current?.getClientRects().length) {
      const scroller=messageScroller.current;
      scroller.scrollTo({top:scroller.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    }
  }, [messages, loading, hasMessages]);
  useEffect(() => { followLatest.current = true; }, [activeId]);
  useEffect(() => { if (!hasMessages && messageScroller.current) messageScroller.current.scrollTop = 0; }, [activeId, hasMessages]);

  const showToast = (msg: string) => { if (onToast) onToast(msg); else setLocalToast(msg); };

  const updateConvs = (updater: (prev: Conversation[]) => Conversation[]) => {
    const next = updater(conversationsRef.current);
    saveConvs(next); conversationsRef.current = next; setConversations(next);
  };
  const changeMessage = (conversationId: string, msgId: string, patch: Partial<ChatMsg>) => {
    updateConvs(prev => prev.map(c => c.id !== conversationId ? c : { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, ...patch } : m) }));
  };
  const removeMemoryCandidate = (id:string) => updateConvs(prev=>prev.map(conversation=>({...conversation,messages:conversation.messages.map(message=>
    message.pendingMemories?.some(memory=>memory.id===id)?{...message,pendingMemories:message.pendingMemories.filter(memory=>memory.id!==id)}:message)})));

  async function refreshMemories(showError=false) {
    if(!cloudMode)return;
    try{setMemories(await listMemories());}catch{if(showError)showToast('未能載入 AI 記憶，請再試一次。');}
  }
  useEffect(()=>{void refreshMemories();},[]);
  async function handleMemory(action:'confirm'|'delete',id:string) {
    if(memoryBusy.has(id))return;
    setMemoryBusy(current=>new Set(current).add(id));
    try{
      if(action==='confirm'){const result=await confirmMemory(id);showToast(result.state==='confirmed'?'已確認這項記憶。':'來源資料已變更，這項記憶沒有保存。');}
      else{await deleteMemory(id);showToast('已移除這項記憶。');}
      removeMemoryCandidate(id); await refreshMemories(true);
    }catch{showToast(action==='confirm'?'未能確認記憶，請再試一次。':'未能移除記憶，請再試一次。');}
    finally{setMemoryBusy(current=>{const next=new Set(current);next.delete(id);return next;});}
  }

  const cancelPending = () => {
    const pending = request.current; if (!pending) return;
    request.current = null; pending.controller.abort();
    try { changeMessage(pending.conversationId, pending.messageId, { delivery: "failed", error: "回應已中止，您可以重新嘗試。" }); } catch {}
    setLoading(false);
  };
  useEffect(() => () => cancelPending(), [activeId]);

  // ── Profile auto-writeback (accumulated cognition) ──────────────────────
  const applyProfileExtraction = useCallback((result: any) => {
    const extracted = result?.extractedProfileData;
    if (!extracted || typeof extracted !== 'object') return;
    // This writeback is handled at the storage level — we dispatch a custom event
    // that useProfile can listen to, or directly call transactProfile if available.
    // For now, we store extraction in localStorage and let next profile load pick it up.
    try {
      const profileKey = cloudMode ? `dia_cloud_${localStorage.getItem('dia_cloud_last_user') || ''}_profile` : 'dia_v2_profile';
      const raw = localStorage.getItem(profileKey);
      if (!raw) return;
      const profile = JSON.parse(raw);
      let changed = false;
      const appendUnique = (arr: string[] | undefined, value: string | null | undefined): string[] | undefined => {
        if (!value || typeof value !== 'string' || !value.trim()) return arr;
        const existing = arr || [];
        if (existing.includes(value.trim())) return arr;
        changed = true;
        return [...existing, value.trim()];
      };
      if (extracted.statedConcern) profile.expressedConcerns = appendUnique(profile.expressedConcerns, extracted.statedConcern);
      if (extracted.scenarioTheme) profile.recentQuestionThemes = appendUnique(profile.recentQuestionThemes, extracted.scenarioTheme);
      if (extracted.educationTopic) profile.educationTopicsViewed = appendUnique(profile.educationTopicsViewed, extracted.educationTopic);
      if (extracted.preference) profile.preferenceSignals = appendUnique(profile.preferenceSignals, extracted.preference);
      if (extracted.inferredNote) profile.inferredNotes = appendUnique(profile.inferredNotes, extracted.inferredNote);
      if (extracted.riskSignal) profile.riskSignals = appendUnique(profile.riskSignals, extracted.riskSignal);
      if (extracted.caregiverMentioned === true && !profile.hasCaregiver) { profile.hasCaregiver = true; changed = true; }
      if (changed) localStorage.setItem(profileKey, JSON.stringify(profile));
    } catch { /* Profile writeback is best-effort; never block the chat flow */ }
  }, [cloudMode]);

  const sendMessage = async (text: string, retryId?: string) => {
    const retryMessage = retryId ? messages.find(message => message.id === retryId) : undefined;
    const image = retryId ? (retryMessage?.hasPhoto ? photo || retryPhotos.current.get(retryId) : undefined) : photo;
    if (retryMessage?.hasPhoto && !image) {showToast("原圖未保留，請重新附上照片，再按「重新嘗試」。");return;}
    if (request.current || voiceBusy.current || (!text.trim() && !image)) return;
    text = text.trim() || "請幫我查看這張照片中的健康相關資料。";
    if (text.trim().length > 50_000) { showToast("問題較長，請縮短至50,000字以內。"); return; }
    const conversationId = activeId;
    const messageId = retryId || genId();
    const controller = new AbortController();
    try {
      updateConvs(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        const previous = c.messages.map(m => ({ ...m, ...(m.suggestionState === 'pending' ? { suggestionState: 'collapsed' as const } : {}) }));
        return { ...c, title: c.title || text.trim().slice(0,24), messages: retryId
          ? previous.map(m => m.id === retryId ? { ...m, delivery: 'pending' as const, error: undefined } : m)
          : [...previous, { id: messageId, role: 'user', source: 'user', text: text.trim(), timestamp: Date.now(), delivery: 'pending', ...(image ? {hasPhoto:true} : {}) }] };
      }));
    } catch { showToast("未能儲存對話，請檢查本機儲存空間後再試。"); return; }
    const pending = { controller, conversationId, messageId };
    request.current = pending;
    if (image) {retryPhotos.current.clear();retryPhotos.current.set(messageId,image);setPhoto(null);}
    setInput(""); setLoading(true);
    try {
      const currentMessages = conversationsRef.current.find(c => c.id === conversationId)?.messages || [];
      const result = await chat({ message: text.trim(), history: chatHistory(currentMessages, messageId), health }, controller.signal, image || undefined, conversationId, messageId);
      if (controller.signal.aborted || request.current !== pending) return;

      // Accumulated cognition writeback
      applyProfileExtraction(result);

      const aiMessage: ChatMsg = {
        id: genId(), role: 'ai', source: result.provider || 'gemini', text: result.reply, timestamp: Date.now(),
        shouldSave: result.shouldSave, doctorQuestion: result.doctorQuestion || undefined,
        appointmentReminder: result.appointmentReminder,
        pendingMemories: result.pendingMemories,
        // Extended fields
        activeNode: result.activeNode,
        briefVersion: result.briefVersion,
        detailedVersion: result.detailedVersion,
        suggestedFollowUps: result.suggestedFollowUps,
        preferenceQuestions: result.preferenceQuestions,
        ...(result.shouldSave ? { suggestionState: 'pending' as const } : {}),
      };
      updateConvs(prev => prev.map(c => c.id !== conversationId ? c : { ...c, messages:
        c.messages.flatMap(m => m.id === messageId ? [{ ...m, delivery: 'sent' as const, error: undefined }, aiMessage] : [m]),
      }));
      if(result.pendingMemories?.length){
        setMemories(current=>[
          ...result.pendingMemories!.map(memory=>({...memory,state:'pending' as const,sourceType:'conversation_message',sourceId:'',sourceVersion:1})),
          ...current.filter(existing=>!result.pendingMemories!.some(memory=>memory.id===existing.id)),
        ]);
        setMemoryOpen(true);
      }
      retryPhotos.current.delete(messageId);
    } catch (error) {
      if (controller.signal.aborted || request.current !== pending) return;
      try { changeMessage(conversationId, messageId, { delivery: 'failed', error: (error as Error).message || "暫時未能取得回應，請再試一次。" }); }
      catch { showToast("未能儲存 AI 回應，請檢查本機儲存空間。"); }
    } finally { if (request.current === pending) { request.current = null; setLoading(false); } }
  };

  const handleSaveItem = async (text: string) => {
    try { await onSaveQuestion(toHongKongChinese(text)); showToast("已保存到備忘"); }
    catch { showToast("未能保存，請再試一次。"); }
  };

  const handleSaveSuggestion = async (msgId: string, question: string) => {
    if (saving.current.has(msgId)) return;
    const conversationId = activeId;
    saving.current.add(msgId); setSavingIds(new Set(saving.current));
    setSaveErrors(prev => ({...prev, [msgId]: ''}));
    try {
      await onSaveQuestion(toHongKongChinese(question));
      changeMessage(conversationId, msgId, { suggestionState: 'saved' });
      showToast("已保存，可在「問題」查看。");
    } catch { setSaveErrors(prev => ({...prev, [msgId]: '未能保存，請再試一次。'})); }
    finally { saving.current.delete(msgId); setSavingIds(new Set(saving.current)); }
  };
  const setSuggestion = (msgId: string, state: SaveSuggestionState) => {
    try { changeMessage(activeId, msgId, { suggestionState: state }); }
    catch { showToast("未能儲存操作，請再試一次。"); }
  };
  const suggestionEntry = (msg: ChatMsg): SuggestionEntry => ({
    state: savedQuestions.some(q => questionComparisonKey(q) === questionComparisonKey(msg.doctorQuestion || '')) ? 'saved'
      : msg.suggestionState === 'saved' ? 'pending' : msg.suggestionState || 'pending',
    saving: savingIds.has(msg.id), error: saveErrors[msg.id] || null,
  });

  const startNewChat = () => { const newConv = createEmptyConv(); updateConvs((prev) => [newConv, ...prev]); setActiveId(newConv.id); };
  const handleSend = (text = input) => sendMessage(text);
  const handleConfirmNewTopic = () => { const newConv = createEmptyConv(); updateConvs((prev) => [newConv, ...prev]); setActiveId(newConv.id); setConfirmClear(false); };
  const savedQuestionCount = new Set(savedQuestions.map(questionComparisonKey)).size;

  // Find last AI message for suggestedFollowUps display
  const lastAiMsg = [...messages].reverse().find(m => m.role === 'ai' && m.delivery !== 'failed');

  return (
    <div className="chat-scope chat-page relative flex h-full min-h-0 flex-col" data-welcome={!hasMessages}>
      <Sidebar open={sidebarOpen} conversations={conversations} activeId={activeId}
        onSelect={setActiveId} onNewChat={startNewChat} onClose={() => setSidebarOpen(false)} />

      {/* Top bar */}
      <div className="chat-header">
        <button type="button" onClick={() => setSidebarOpen(true)} aria-label="開啟對話歷史" className="chat-header-action">
          <Menu width={26} height={26} strokeWidth={2} aria-hidden="true" />
        </button>
        <h1 className="sr-only">問 AI</h1>
        <button type="button" onClick={() => { if (hasMessages) setConfirmClear(true); else startNewChat(); }}
          aria-label="開始新對話" className="chat-header-action">
          <SquarePen width={26} height={26} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      {/* Disclaimer */}
      <div data-keyboard-chrome="chat">
        <p className="px-4 pb-2 text-center t-support text-ink-muted" style={{fontSize:12,lineHeight:'18px'}}>
          資訊來源基於香港醫學臨床指引與 ADA 標準。所有對話僅供共同決策(SDM)及覆診前備忘，不作直接個體化臨床診斷。
        </p>
      </div>

      <div data-keyboard-chrome="chat"><div className="chat-question-tools">
        <button ref={questionNoteTrigger} type="button" className="chat-question-entry" aria-haspopup="dialog" aria-expanded={questionNoteOpen}
          onClick={() => {questionNoteTrigger.current?.focus({preventScroll:true}); setQuestionNoteSaved(false); setQuestionNoteOpen(true);}}>
          <BookmarkIcon width={22} height={22} aria-hidden="true"/>
          <span>隨手記覆診問題</span><span className="chat-question-count" aria-label={`已存 ${savedQuestionCount} 題`}>{savedQuestionCount}</span>
        </button>
        {questionNoteSaved && <SavedFeedback message="已保存到備忘"/>}
      </div></div>

      {cloudMode && (memories.some(memory=>memory.state==='pending'||memory.state==='confirmed') || memoryOpen) && <>
        <div data-keyboard-chrome="chat"><div className="chat-memory-controls px-4 pb-2">
          <button type="button" onClick={()=>setMemoryOpen(open=>!open)} aria-expanded={memoryOpen}
            className="min-h-[48px] rounded-[16px] bg-field px-4 t-support font-semibold text-ink">
            AI 記憶{memories.some(memory=>memory.state==='pending')?` · ${memories.filter(memory=>memory.state==='pending').length} 項待確認`:''}
          </button>
        </div></div>
        {memoryOpen&&<MemoryPanel memories={memories} busy={memoryBusy} onConfirm={id=>void handleMemory('confirm',id)} onDelete={id=>void handleMemory('delete',id)}/>}
      </>}

      {/* Messages area */}
      <div ref={messageScroller} className="chat-messages" onScroll={event => {
        const node = event.currentTarget;
        followLatest.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
      }}>
        {!hasMessages ? (
          <WelcomeScreen onSend={sendMessage} />
        ) : (
          <div className="mx-auto flex max-w-[520px] flex-col gap-5">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex flex-col gap-3 chat-message-batch">
                  {msg.source === 'demo' && <p className="t-support text-ink-soft">示例對話紀錄</p>}
                  <UserBubble msg={msg} />
                  {msg.hasPhoto && <p className="chat-photo-history">此訊息附有照片；原圖不保存在對話紀錄。</p>}
                  {msg.delivery === 'failed' && <div role="alert" className="rounded-[20px] bg-field p-4">
                    <p className="hm-body">{msg.error}</p>
                    <button type="button" className="min-h-[48px] mt-2 px-3 underline" disabled={loading} onClick={() => sendMessage(msg.text, msg.id)}>重新嘗試</button>
                  </div>}
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col gap-3 chat-message-batch">
                  {msg.source === 'demo' && <p className="t-support text-ink-soft">示例回覆，並非您的真實健康分析</p>}
                  <AiBubble msg={msg} liked={liked.has(msg.id)} disliked={disliked.has(msg.id)}
                    onLike={() => setLiked((p) => { const n = new Set(p); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n; })}
                    onDislike={() => setDisliked((p) => { const n = new Set(p); n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id); return n; })}
                    onSaveItem={handleSaveItem}
                  />
                  {/* Preference cards (Node 3) */}
                  {msg.activeNode === 3 && msg.preferenceQuestions && msg.preferenceQuestions.length > 0 && (
                    <PreferenceCards msg={msg} onSubmit={(formatted) => sendMessage(formatted)} />
                  )}
                  {msg.appointmentReminder && <AppointmentReminderCard reminder={msg.appointmentReminder}/>}
                  {msg.pendingMemories?.length ? <section className="rounded-[24px] bg-sage p-5" aria-label="待確認 AI 記憶">
                    <p className="hm-cardtitle text-ink">要讓 AI 記住嗎？</p>
                    <p className="mt-1 t-support text-ink-soft">確認後才會在新對話使用，不會修改正式健康資料。</p>
                    <div className="mt-3 flex flex-col gap-3">{msg.pendingMemories.map(memory=><div key={memory.id} className="rounded-[16px] bg-surface p-3">
                      <p className="hm-body text-ink">{memory.text}</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={memoryBusy.has(memory.id)} onClick={()=>void handleMemory('confirm',memory.id)} className="min-h-[48px] rounded-[16px] bg-action px-4 text-white">確認記住</button>
                        <button type="button" disabled={memoryBusy.has(memory.id)} onClick={()=>void handleMemory('delete',memory.id)} className="min-h-[48px] rounded-[16px] bg-field px-4 text-ink">不保存</button>
                      </div>
                    </div>)}</div>
                  </section>:null}
                  {(msg.source === "gemini" || msg.source === "qwen") && msg.shouldSave && msg.doctorQuestion && (
                    <SaveSuggestionCard
                      doctorQuestion={toHongKongChinese(msg.doctorQuestion)}
                      entry={suggestionEntry(msg)}
                      onSave={() => handleSaveSuggestion(msg.id, msg.doctorQuestion!)}
                      onDismiss={() => setSuggestion(msg.id, 'dismissed')}
                      onRestore={() => setSuggestion(msg.id, 'pending')}
                      onExpand={() => setSuggestion(msg.id, 'pending')}
                    />
                  )}
                </div>
              ),
            )}
            {loading && <LoadingBubble />}

            {/* suggestedFollowUps — only on last AI message, not during loading */}
            {!loading && lastAiMsg?.suggestedFollowUps?.length ? (
              <div className="flex flex-wrap gap-2 pb-2">
                {lastAiMsg.suggestedFollowUps.map((fu, i) => (
                  <button key={i} type="button" onClick={() => sendMessage(fu)}
                    className="rounded-[16px] border border-ink/10 bg-surface px-4 py-2.5 t-support text-ink transition-colors hover:bg-field active:scale-[0.97]">
                    {fu}
                  </button>
                ))}
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        )}
        {!hasMessages && <div ref={messagesEndRef} />}
      </div>

      <ChatComposer value={input} photo={photo} onPhotoChange={setPhoto}
        onChange={setInput} onSend={handleSend} loading={loading} conversationId={activeId}
        blocked={sidebarOpen || confirmClear || questionNoteOpen} onBusyChange={setVoiceBusy} />

      <DoctorQuestionNote open={questionNoteOpen} savedQuestions={savedQuestions} onClose={() => setQuestionNoteOpen(false)} onSave={onSaveQuestion}
        onSaved={() => {setQuestionNoteOpen(false); setQuestionNoteSaved(true);}}
        onViewAll={() => {setQuestionNoteOpen(false); onOpenQuestions();}}/>
      <ConfirmDialog open={confirmClear} appearance="chat" title="開啟新對話？"
        message="目前的對話紀錄將保存在歷史中，您可隨時從左側選單查看。"
        confirmText="開啟新對話" onConfirm={handleConfirmNewTopic} onCancel={() => setConfirmClear(false)} />
      {localToast && <Toast message={localToast} onDone={() => setLocalToast(null)} />}
    </div>
  );
}