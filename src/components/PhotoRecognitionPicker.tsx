import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, LoaderCircle, Plus, X } from "lucide-react";
import "../styles/photo-recognition.css";
import {useAppViewport} from '../hooks/useAppViewport';
import {inputViewportAttributes,inputViewportStyle} from './inputViewportSurface';
import { lockAppInteraction } from './appInteractionLock';

type Mode = "menu" | "camera" | "review" | null;
export function PhotoRecognitionPicker<T>({
  label,
  title,
  recognize,
  renderResult,
  className = "",
  onPhotoConfirm,
  disabled = false,
  autoRecognize = false,
}: {
  label: string;
  title: string;
  className?: string;
  recognize?: (photo: Blob, signal: AbortSignal) => Promise<T>;
  renderResult?: (result: T, close: () => void) => ReactNode;
  onPhotoConfirm?: (photo: Blob) => void;
  disabled?: boolean;
  autoRecognize?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const viewport=useAppViewport(!!mode && mode !== 'menu');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const photosInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef<AbortController | null>(null);
  const cameraVersion = useRef(0);
  useLayoutEffect(() => {
    if (mode && autoRecognize) return lockAppInteraction();
  }, [mode, autoRecognize]);
  useEffect(() => {
    const inputs = [cameraInput.current, photosInput.current];
    const restoreFocus = () => trigger.current?.focus({ preventScroll: true });
    inputs.forEach((input) => input?.addEventListener("cancel", restoreFocus));
    return () =>
      inputs.forEach((input) =>
        input?.removeEventListener("cancel", restoreFocus),
      );
  }, []);
  const stopCamera = () => {
    cameraVersion.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  const clear = () => {
    request.current?.abort();
    request.current = null;
    stopCamera();
    setBusy(false);
    setError("");
    setPhoto(null);
    setResult(null);
    setCameraReady(false);
  };
  const close = () => {
    clear();
    setMode(null);
    requestAnimationFrame(() =>
      trigger.current?.focus({ preventScroll: true }),
    );
  };
  useEffect(() => {
    if (disabled) {
      clear();
      setMode(null);
    }
  }, [disabled]);
  useEffect(
    () => () => {
      request.current?.abort();
      stopCamera();
    },
    [],
  );
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useLayoutEffect(() => {
    if (!mode) return;
    const element = dialog.current;
    element?.focus({ preventScroll: true });
    const positionMenu = () => {
      if (mode !== "menu" || !trigger.current || !element) return;
      const host = document.getElementById("device-overlay-layer");
      const rect = host?.getBoundingClientRect();
      const scale =
        rect && host?.clientWidth ? rect.width / host.clientWidth : 1;
      const bounds = trigger.current.getBoundingClientRect();
      const width = host?.clientWidth || innerWidth;
      const viewport = window.visualViewport;
      const topLimit = Math.max(
        8,
        ((viewport?.offsetTop || 0) - (rect?.top || 0)) / scale + 8,
      );
      const bottom =
        Math.min(
          host?.clientHeight || innerHeight,
          ((viewport?.height || innerHeight) +
            (viewport?.offsetTop || 0) -
            (rect?.top || 0)) /
            scale,
        ) - 8;
      const height = element.offsetHeight;
      const below = (bounds.bottom - (rect?.top || 0)) / scale + 8;
      setPosition({
        left: Math.max(
          8,
          Math.min(
            width - element.offsetWidth - 8,
            (bounds.right - (rect?.left || 0)) / scale - element.offsetWidth,
          ),
        ),
        top: Math.max(
          topLimit,
          Math.min(
            bottom - height,
            below + height <= bottom
              ? below
              : (bounds.top - (rect?.top || 0)) / scale - height - 8,
          ),
        ),
      });
    };
    positionMenu();
    const observer = new ResizeObserver(positionMenu);
    if (element) observer.observe(element);
    window.addEventListener("resize", positionMenu);
    window.visualViewport?.addEventListener("resize", positionMenu);
    window.visualViewport?.addEventListener("scroll", positionMenu);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      event.stopImmediatePropagation();
      const controls = Array.from(
        element?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not([hidden]),select,[tabindex="0"]',
        ) || [],
      );
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault();
        last?.focus({preventScroll:true});
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        event.preventDefault();
        first?.focus({preventScroll:true});
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionMenu);
      window.visualViewport?.removeEventListener("resize", positionMenu);
      window.visualViewport?.removeEventListener("scroll", positionMenu);
      document.removeEventListener("keydown", keydown, true);
    };
  }, [mode]);
  const selected = (file?: Blob) => {
    if (!file) return;
    clear();
    setMode("review");
    if (
      !file.type.startsWith("image/") ||
      !file.size ||
      file.size > 15 * 1024 * 1024
    ) {
      setError("請選擇 15 MB 以下的圖片。");
      return;
    }
    setPhoto(file);
    if (autoRecognize) void start(file);
  };
  const choosePhotos = () => {
    clear();
    setMode(null);
    photosInput.current?.click();
  };
  const chooseCamera = async () => {
    clear();
    const mobile =
      /Android|iPhone|iPad/i.test(navigator.userAgent) ||
      (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (mobile) {
      setMode(null);
      cameraInput.current?.click();
      return;
    }
    setMode("camera");
    const version = cameraVersion.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (version !== cameraVersion.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      if (version === cameraVersion.current) setCameraReady(true);
    } catch {
      if (version === cameraVersion.current) {
        stopCamera();
        setError(
          autoRecognize ? "請允許相機權限，或選擇 Photos 上傳照片。" : "未能開啟相機。請允許相機權限並使用 HTTPS，或選擇 Photos 上傳照片。",
        );
      }
    }
  };
  const capture = () => {
    const element = video.current;
    if (!element?.videoWidth || !element.videoHeight) return;
    const version = cameraVersion.current;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (version !== cameraVersion.current) return;
        if (blob) selected(blob);
        else setError("未能拍攝照片，請再試一次。");
      },
      "image/jpeg",
      0.9,
    );
  };
  const start = async (selectedPhoto = photo) => {
    if (!selectedPhoto || (busy && selectedPhoto === photo) || !recognize) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await recognize(selectedPhoto, controller.signal);
      if (!controller.signal.aborted && request.current === controller)
        setResult(response);
    } catch (e) {
      if (!controller.signal.aborted && request.current === controller)
        setError(e instanceof Error ? e.message : "識別未成功，請再試一次。");
    } finally {
      if (!controller.signal.aborted && request.current === controller)
        setBusy(false);
    }
  };
  const dialogTitle = mode === "menu" ? "選擇照片來源" : autoRecognize && error
    ? mode === "camera" ? "未能開啟相機" : "識別未成功"
    : title;
  return (
    <>
      <button
        type="button"
        ref={trigger}
        disabled={disabled}
        className={`photo-trigger ${className}`}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={!!mode}
        data-voice-avoid
        onClick={() => {
          clear();
          setMode("menu");
        }}
      >
        {className.split(' ').includes('chat-upload') ? <Plus size={28} strokeWidth={1.8} aria-hidden="true" /> : <Camera size={autoRecognize ? 24 : 23} aria-hidden="true" />}
      </button>
      <input
        hidden
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="拍攝照片"
        onChange={(e) => {
          selected(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={photosInput}
        type="file"
        accept="image/*"
        aria-label="選擇照片"
        onChange={(e) => {
          selected(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {mode &&
        createPortal(
          <div
            {...inputViewportAttributes(viewport)}
            style={mode === 'menu' ? undefined : inputViewportStyle(viewport,true)}
            className={`photo-overlay ${autoRecognize ? "photo-record" : ""} ${mode === "menu" ? "photo-overlay-menu" : "input-viewport-surface"}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              ref={dialog}
              className={mode === "menu" ? "photo-source-menu" : "photo-dialog"}
              style={mode === "menu" ? position : undefined}
              role="dialog"
              aria-modal="true"
              aria-label={dialogTitle}
              tabIndex={-1}
              data-voice-avoid
              onMouseDown={(e) => e.stopPropagation()}
            >
              {mode === "menu" ? (
                <>
                  <button type="button" onClick={() => void chooseCamera()}>
                    <span>
                      <Camera aria-hidden="true" />
                    </span>
                    Camera
                  </button>
                  <button type="button" onClick={choosePhotos}>
                    <span>
                      <ImagePlus aria-hidden="true" />
                    </span>
                    Photos
                  </button>
                </>
              ) : (
                <>
                  {autoRecognize && <div className="photo-handle" aria-hidden="true" />}
                  <header>
                    <h2>{dialogTitle}</h2>
                    <button
                      type="button"
                      aria-label="關閉照片識別"
                      onClick={close}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </header>
                  {mode === "camera" ? (
                    <>
                      {(!autoRecognize || !error) && <>
                      <video
                        ref={video}
                        autoPlay
                        muted
                        playsInline
                        aria-label="相機取景"
                      />
                      <button
                        type="button"
                        className="photo-primary"
                        disabled={!cameraReady}
                        onClick={capture}
                      >
                        拍攝照片
                      </button>
                      </>}
                    </>
                  ) : (
                    <>
                      {preview && (!autoRecognize || result === null) && (
                        <img
                          className="photo-preview"
                          src={preview}
                          alt="待核對的照片"
                          onError={() => {
                            request.current?.abort();
                            request.current = null;
                            setBusy(false);
                            setPhoto(null);
                            setError(
                              "未能讀取圖片，請改用 JPG、PNG 或 WebP，或重新拍攝。",
                            );
                          }}
                        />
                      )}
                      {!result && !autoRecognize && (
                        <p>
                          {onPhotoConfirm
                            ? "確認附上後，按發送才會把照片及問題交給 AI。請先裁去姓名等無關資料；原圖不保存在對話紀錄。"
                            : "照片會送交 AI 識別。請先裁去姓名等無關資料，識別後請對照原圖核對。"}
                        </p>
                      )}
                      {busy && <p role="status">正在識別，請稍候…</p>}
                      {busy && autoRecognize && <div className="photo-progress"><LoaderCircle size={22} aria-hidden="true"/><span>識別完成後，請核對數值及小數點。</span></div>}
                      {result !== null && renderResult?.(result, close)}
                      {!busy && !result && photo && (!autoRecognize || error) && (
                        <button
                          type="button"
                          className="photo-primary"
                          onClick={() => {
                            if (onPhotoConfirm && photo) {
                              onPhotoConfirm(photo);
                              close();
                            } else void start();
                          }}
                        >
                          {onPhotoConfirm
                            ? "確認附上照片"
                            : error
                              ? "重新識別"
                              : "開始識別"}
                        </button>
                      )}
                    </>
                  )}
                  {error && (
                    <p role="alert" className="photo-error">
                      {error}
                    </p>
                  )}
                  {!busy && !autoRecognize && (
                    <div className="photo-secondary-actions">
                      <button type="button" onClick={() => void chooseCamera()}>
                        Camera
                      </button>
                      <button type="button" onClick={choosePhotos}>
                        Photos
                      </button>
                    </div>
                  )}
                  {!busy && autoRecognize && error && (
                    <button type="button" className="photo-cancel" onClick={() => { clear(); setMode("menu"); }}>
                      {mode === "camera" ? "返回選擇來源" : "重新選擇照片"}
                    </button>
                  )}
                  {(!autoRecognize || !busy) && <button
                    type="button"
                    className="photo-cancel"
                    onClick={close}
                  >
                    {busy ? "取消識別" : "取消"}
                  </button>}
                </>
              )}
            </div>
          </div>,
          document.getElementById("device-overlay-layer") || document.body,
        )}
    </>
  );
}
