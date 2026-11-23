import { Droplet } from "lucide-react";
export function RecordEmpty({kind}:{kind:"血糖"|"糖化"}) {
  return <div className="record-empty" role="status"><span className="record-empty-icon"><Droplet width={28} height={28} aria-hidden="true"/></span><h3>還沒有{kind}紀錄</h3></div>;
}
