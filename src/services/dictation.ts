export type DictationCallbacks={onText:(text:string)=>void;onListening:()=>void;onProcessing:()=>void;onEnd:()=>void;onError:(message:string)=>void};
export type DictationSession={stop:()=>void;cancel:()=>void};
/** A cancellable session, including while microphone permission is pending. */
export function startDictation(cb:DictationCallbacks):DictationSession {
  let stopped=false,cancelled=false,failed=false,ended=false,stream:MediaStream|null=null,recorder:MediaRecorder|null=null;
  let recognition:any=null;
  const finish=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;if(!ended){ended=true;cb.onEnd();}};
  const fail=(error:any)=>{failed=true;if(!cancelled) cb.onError(error?.name==='NotAllowedError'||error?.error==='not-allowed' ? '未能使用麥克風，請在瀏覽器允許麥克風權限。' : '語音辨識未完成，請再試一次或直接輸入。');finish();};
  const Recognition=(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if(Recognition){
    try {
      recognition=new Recognition();recognition.lang='zh-HK';recognition.continuous=true;recognition.interimResults=false;
      let transcript='';
      recognition.onstart=()=>{if(cancelled) recognition.abort();else if(stopped) recognition.stop();else cb.onListening();};
      recognition.onresult=(event:any)=>{for(let i=event.resultIndex;i<event.results.length;i++) if(event.results[i].isFinal) transcript+=event.results[i][0].transcript;};
      recognition.onerror=fail;
      recognition.onend=()=>{if(!cancelled && !failed && transcript.trim()) cb.onText(transcript.trim());else if(!cancelled && !failed) cb.onError('未聽清楚，請點麥克風再說一次。');finish();};
      recognition.start();
    } catch(error){fail(error);}
  }else{
    void (async()=>{
      try {
        if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('unsupported');
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        if(stopped||cancelled){finish();return;}
        recorder=new MediaRecorder(stream);const chunks:Blob[]=[];
        recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data);};
        recorder.onerror=fail;
        recorder.onstop=async()=>{
          stream?.getTracks().forEach(t=>t.stop());stream=null;
          if(cancelled){finish();return;}
          try{
            cb.onProcessing();const blob=new Blob(chunks,{type:recorder!.mimeType});
            if(!blob.size) throw new Error('empty');
            const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
            const {transcribeAudio}=await import('./audioTranscription');
            const text=await transcribeAudio(data,blob.type);
            if(!cancelled && text.trim()) cb.onText(text.trim());
          }catch(error){fail(error);}finally{finish();}
        };
        recorder.start();cb.onListening();
      }catch(error){fail(error);}
    })();
  }
  return {
    stop:()=>{if(ended)return;stopped=true;if(recognition){cb.onProcessing();try{recognition.stop();}catch{finish();}}else if(recorder?.state==='recording') recorder.stop();},
    cancel:()=>{cancelled=true;stopped=true;if(recognition){try{recognition.abort();}catch{}} if(recorder?.state==='recording') recorder.stop();finish();},
  };
}