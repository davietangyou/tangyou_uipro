import {
  confirmedRecordHbA1cValue,
  type HbA1cPhotoResult,
} from "../../shared/hba1cPhoto";
import { recognizeHbA1cPhoto } from "../services/hba1cRecognition";
import { PhotoRecognitionPicker } from "./PhotoRecognitionPicker";
function Result({
  result,
  onConfirm,
}: {
  result: HbA1cPhotoResult;
  onConfirm: (value: string) => void;
}) {
  const value = confirmedRecordHbA1cValue(result);
  if (value === null)
    return <p role="alert" className="photo-error">
      未能確定清晰的糖化讀數及 % 單位。請重新選擇照片，或自行輸入；不會自動換算或填入。
    </p>;
  return (
    <div className="photo-results">
      <p className="photo-reading"><strong>{result.reading} %</strong></p>
      <p>請對照照片核對讀數及小數點。確認後只填入糖化值，測量日期及時間保持原樣。</p>
      <button type="button" className="photo-primary" onClick={() => onConfirm(value)}>確認並填入</button>
    </div>
  );
}
export function HbA1cPhotoPicker({
  onSelect,
}: {
  onSelect: (value: string) => void;
}) {
  return (
    <PhotoRecognitionPicker
      autoRecognize
      label="拍照或上傳糖化報告"
      title="識別糖化結果"
      className="glucose-photo-trigger"
      recognize={async (photo, signal) => {
        const result = await recognizeHbA1cPhoto(photo, signal);
        if (confirmedRecordHbA1cValue(result) === null)
          throw new Error("未能確定清晰的糖化讀數及 % 單位。請重新選擇照片，或自行輸入。");
        return result;
      }}
      renderResult={(result, close) => (
        <Result
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
