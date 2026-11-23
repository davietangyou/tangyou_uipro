import { useCallback, useRef, useState } from "react";
import type { GlucoseRecord } from "../data/types";

import { loadGlucose, writeStored } from "../services/storage";
function persist(records: GlucoseRecord[]) {
  writeStored("glucose", records);
}

function sortDesc(records: GlucoseRecord[]): GlucoseRecord[] {
  return [...records].sort((a, b) => b.timestamp - a.timestamp);
}

export interface NewGlucoseInput {
  value: number;
  timestamp: number;
  timeType: GlucoseRecord["timeType"];
  mealTag?: GlucoseRecord["mealTag"];
  dietNote?: string;
  exerciseNote?: string;
  symptoms: string[];
}

export function useGlucose() {
  const [records, setRecords] = useState<GlucoseRecord[]>(loadGlucose);
  const current = useRef(records);
  const commit = useCallback((next: GlucoseRecord[]) => {
    // A storage failure must leave both the list and the input untouched.
    persist(next);
    current.current = next;
    setRecords(next);
  }, []);

  // 新增：建立 id、固定一位小數、依 timestamp 倒序插入（spec §7.1）
  const addRecord = useCallback(
    (input: NewGlucoseInput): GlucoseRecord => {
      const rec: GlucoseRecord = {
        id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        value: Math.round(input.value * 10) / 10,
        timestamp: input.timestamp,
        timeType: input.timeType,
        mealTag: input.mealTag,
        dietNote: input.dietNote?.trim() || undefined,
        exerciseNote: input.exerciseNote?.trim() || undefined,
        symptoms: input.symptoms,
      };
      commit(sortDesc([rec, ...current.current]));
      return rec;
    },
    [commit],
  );

  // 編輯（Approved Change 8.6）：以 id 覆蓋，保留 id，timestamp 依表單重算，維持倒序。
  const updateRecord = useCallback(
    (id: string, input: NewGlucoseInput) => {
      if (!current.current.some((record) => record.id === id))
        throw new Error("未能找到這筆紀錄，請重新開啟列表。");
      const next = sortDesc(
        current.current.map((r) =>
          r.id === id
            ? {
                ...r,
                value: Math.round(input.value * 10) / 10,
                timestamp: input.timestamp,
                timeType: input.timeType,
                mealTag: input.mealTag,
                dietNote: input.dietNote?.trim() || undefined,
                exerciseNote: input.exerciseNote?.trim() || undefined,
                symptoms: input.symptoms,
              }
            : r,
        ),
      );
      commit(next);
    },
    [commit],
  );

  // 刪除（Approved Change：破壞性操作加確認由 UI 負責）
  const deleteRecord = useCallback(
    (id: string) => {
      commit(current.current.filter((record) => record.id !== id));
    },
    [commit],
  );

  const getById = useCallback(
    (id: string) => records.find((r) => r.id === id),
    [records],
  );

  return { records, addRecord, updateRecord, deleteRecord, getById };
}
