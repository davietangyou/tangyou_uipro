import { medicationRecognition } from "../services/medicationRecognition";
import { PhotoRecognitionPicker } from "./PhotoRecognitionPicker";
export function MedicationPhotoPicker({
  onSelect,
}: {
  onSelect: (name: string) => void;
}) {
  return (
    <PhotoRecognitionPicker
      label="拍照或上傳藥物照片"
      title="識別英文藥名"
      recognize={medicationRecognition.recognize}
      renderResult={(results, close) => (
        <div className="photo-results">
          <p>
            {results.length
              ? "請對照原圖，選擇要填入的英文藥名："
              : "未讀到清楚完整的英文藥名。請重拍藥袋或包裝，或自行輸入；不會按藥丸外觀或中文名稱猜測。"}
          </p>
          {results.map(({ name }) => (
            <button
              type="button"
              key={name}
              onClick={() => {
                onSelect(name);
                close();
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    />
  );
}
