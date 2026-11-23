export function RecordMissing({ onBack, kind = "血糖" }: { onBack: () => void; kind?: "血糖" | "糖化" }) {
  return <section className="record-missing" role="alert">
    <h2>未能找到這筆{kind}紀錄。</h2>
    <button type="button" onClick={onBack}>返回數據日誌</button>
  </section>;
}
