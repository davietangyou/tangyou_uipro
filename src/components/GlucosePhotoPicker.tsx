import {
  confirmedRecordGlucoseValue,
  type GlucosePhotoResult,
} from "../../shared/glucosePhoto";
import { recognizeGlucosePhoto } from "../services/glucoseRecognition";
import { PhotoRecognitionPicker } from "./PhotoRecognitionPicker";
function GlucoseResult({
  result,
  onConfirm,
}: {
  result: GlucosePhotoResult;
  onConfirm: (value: number) => void;
}) {
  const value = confirmedRecordGlucoseValue(result);
  if (value === null)
    return <p role="alert" className="photo-error">
      未能確定清晰的血糖讀數及 mmol/L 單位。請重新選擇照片，或自行輸入；不會自動換算或填入。
    </p>;
  return (
    <div className="photo-results">
      <p className="photo-reading"><strong>{result.reading} mmol/L</strong></p>
      <p>請對照照片核對讀數及小數點。確認後只填入血糖值，測量日期及時段保持原樣。</p>
      <button type="button" className="photo-primary" onClick={() => onConfirm(value)}>確認並填入</button>
    </div>
  );
}
export function GlucosePhotoPicker({
  onSelect,
}: {
  onSelect: (value: number) => void;
}) {
  return (
    <PhotoRecognitionPicker
      autoRecognize
      label="拍照或上傳血糖儀照片"
      title="識別血糖讀數"
      className="glucose-photo-trigger"
      recognize={async (photo, signal) => {
        const result = await recognizeGlucosePhoto(photo, signal);
        if (confirmedRecordGlucoseValue(result) === null)
          throw new Error(result.status === "nonNumeric"
            ? `照片顯示 ${result.reading}，不能填作數字。請核對血糖儀提示。`
            : "未能確定清晰的血糖讀數及 mmol/L 單位。請重新選擇照片，或自行輸入。");
        return result;
      }}
      renderResult={(result, close) => (
        <GlucoseResult
          result={result}
          onConfirm={(value) => {
            onSelect(value);
            close();
          }}
        />
      )}
    />
  );
}
