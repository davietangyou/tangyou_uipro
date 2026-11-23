import { useRef, useState } from "react";
import type { HbA1cRecord } from "../data/types";
import { createHbA1c, sortHbA1c, type HbA1cInput } from "../data/hba1c";
import { loadHbA1c, writeStored } from "../services/storage";

export function useHbA1c() {
  const [records, setRecords] = useState(loadHbA1c);
  const current = useRef(records);
  const commit = (next: HbA1cRecord[]) => {
    // Persist before changing the UI so a quota failure leaves the input and list intact.
    writeStored("hba1c", next);
    current.current = next;
    setRecords(next);
  };
  const save = (input: HbA1cInput, id?: string) => {
    const previous = id
      ? current.current.find((record) => record.id === id)
      : undefined;
    if (id && !previous) throw new Error("未能找到這筆紀錄，請重新開啟列表。");
    const record = createHbA1c(input.value, input.date, previous, input.time);
    commit(
      sortHbA1c([
        ...current.current.filter((item) => item.id !== record.id),
        record,
      ]),
    );
  };
  const remove = (id: string) =>
    commit(current.current.filter((record) => record.id !== id));
  return { records, save, remove };
}
