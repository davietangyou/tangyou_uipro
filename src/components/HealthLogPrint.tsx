import { createPortal } from 'react-dom';
import type { HealthLogGroup } from '../data/healthLog';
import { slotLabelFor } from '../data/constants';
import '../styles/health-log-print.css';

/** Outside the phone shell so pagination and horizontal scrolling cannot clip exports. */
export function HealthLogPrint({ groups, start, end, symptomFilter }: {
  groups: HealthLogGroup[];
  start: string;
  end: string;
  symptomFilter: string | null;
}) {
  const entries = groups.flatMap(group => group.items);
  return createPortal(<article className="health-log-print">
    <h1>糖友導航 · 健康紀錄</h1>
    <p>日期範圍：{start.replaceAll('-', '/')} – {end.replaceAll('-', '/')}（包括起止日期）</p>
    {symptomFilter && <p>症狀篩選：{symptomFilter}</p>}
    <p>共 {entries.length} 筆紀錄 · 血糖單位 mmol/L · 糖化 HbA1c 單位 %</p>
    <table>
      <caption>所選日期範圍內的全部紀錄（日期由近至遠）</caption>
      <thead><tr><th scope="col">日期</th><th scope="col">時間</th><th scope="col">紀錄</th><th scope="col">數值</th><th scope="col">症狀及備註</th></tr></thead>
      <tbody>{entries.map(record => {
        const hba1c = record.kind === 'hba1c';
        const notes = hba1c ? [] : [
          ...record.symptoms,
          record.dietNote ? `飲食：${record.dietNote}` : '',
          record.exerciseNote ? `運動：${record.exerciseNote}` : '',
        ].filter(Boolean);
        return <tr key={`${record.kind}:${record.id}`}>
          <td>{record.date.replaceAll('-', '/')}</td>
          <td>{record.time || '時間未記錄'}</td>
          <td>{hba1c ? '糖化 HbA1c' : record.value > 0 ? <>血糖<br/>{slotLabelFor(record.timeType, record.mealTag)}</> : '症狀紀錄'}</td>
          <td>{hba1c ? `${record.value} %` : record.value > 0 ? <>{record.value.toFixed(1)}<br/>mmol/L</> : '未有血糖讀數'}</td>
          <td>{notes.join('；') || '—'}</td>
        </tr>;
      })}</tbody>
    </table>
    {entries.length === 0 && <p>所選日期範圍內未有{symptomFilter ? '符合篩選的' : ''}紀錄。</p>}
  </article>, document.body);
}
