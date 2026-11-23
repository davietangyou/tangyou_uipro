import {backend, BackendError, isSessionFailure, requestKey} from './backendClient';
import {emptyProfile, observeCloudStorage} from './storage';
import type {UserProfile} from '../data/types';

type Kind='profile'|'glucose'|'hba1c'|'medication'|'question'|'intake';
type Action='create'|'update'|'delete'|'confirm'|'undo';
type Operation={key:string;kind:Kind;action:Action;localId?:string;body?:any};
type Ref={id:string;version:number};
type Versions={profile:number;glucose:Record<string,Ref>;hba1c:Record<string,Ref>;medication:Record<string,Ref>;question:Record<string,Ref>;intake:Record<string,Ref>};
type Page<T>={items:T[];hasMore:boolean};
type ServerRecord={id:string;data:Record<string,unknown>;version:number};
const emptyVersions=():Versions=>({profile:0,glucose:{},hba1c:{},medication:{},question:{},intake:{}});
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const array=(v:any):any[]=>Array.isArray(v)?v:[];
function coreProfile(value:any) {
  const copy={...object(value)};
  for(const field of ['medications','medicationIntakes','savedDoctorQuestions','nextClinicQuestions']) delete copy[field];
  return copy;
}
export class CloudSync {
  private stopped=false;
  private abort=new AbortController();
  private key(name:string){return `dia_cloud_${this.userId}_${name}`;}
  private ensureActive(){if(this.stopped)throw new DOMException('Sync stopped','AbortError');}
  private async request<T>(path:string,options:Parameters<typeof backend>[1]={}):Promise<T>{
    this.ensureActive();
    try {
      const result=await backend<T>(path,{...options,expectedUserId:this.userId,signal:this.abort.signal});
      this.ensureActive();return result;
    } catch(error) {
      if(isSessionFailure(error)){this.stop();this.notify('unauthenticated');}
      throw error;
    }
  }
  private backgroundFlush=()=>{void this.flush().catch(()=>{});};
  private queue:Operation[];
  private versions:Versions;
  private flushing=false;
  private appending:Promise<void>=Promise.resolve();
  private timer:number|undefined;
  private notify:(status:string)=>void;
  constructor(private userId:string,notify:(status:string)=>void) {
    this.notify=notify;
    try {this.queue=JSON.parse(localStorage.getItem(this.queueKey())||'[]');}catch{this.queue=[];}
    try {this.versions={...emptyVersions(),...JSON.parse(localStorage.getItem(this.versionsKey())||'{}')};}catch{this.versions=emptyVersions();}
  }
  private queueKey(){return `dia_cloud_${this.userId}_queue`;}
  private versionsKey(){return `dia_cloud_${this.userId}_versions`;}
  private save(){localStorage.setItem(this.queueKey(),JSON.stringify(this.queue));localStorage.setItem(this.versionsKey(),JSON.stringify(this.versions));this.notify(this.queue.length?'pending':'synced');}
  private async locked<T>(task:()=>Promise<T>):Promise<T>{
    if(navigator.locks)return navigator.locks.request(`dia_cloud_${this.userId}_sync`,task);
    return task();
  }
  private enqueue(kind:Kind,action:Action,localId?:string,body?:any){
    const op={key:requestKey(),kind,action,localId,body};
    this.appending=this.appending.then(()=>this.locked(async()=>{
      try{this.queue=JSON.parse(localStorage.getItem(this.queueKey())||'[]');}catch{this.queue=[];}
      try{this.versions={...emptyVersions(),...JSON.parse(localStorage.getItem(this.versionsKey())||'{}')};}catch{}
      this.queue.push(op);this.save();
    })).then(()=>this.flush()).catch(error=>{if(!this.stopped&&!isSessionFailure(error))this.notify('invalid');});
  }
  private diffList(kind:Kind,oldValue:any[],newValue:any[]) {
    const before=new Map(oldValue.map(item=>[String(item.id),item]));
    const after=new Map(newValue.map(item=>[String(item.id),item]));
    for(const [id,item] of after) {
      const prior=before.get(id);
      if(!prior)this.enqueue(kind,'create',id,item);
      else if(!same(prior,item)){
        const refill=kind==='medication'&&prior.inventory&&item.inventory
          &&prior.inventory.revision===item.inventory.revision&&item.inventory.quantity>prior.inventory.quantity;
        this.enqueue(kind,'update',id,refill?{...item,inventoryAdjustment:'refill'}:item);
      }
    }
    for(const id of before.keys())if(!after.has(id))this.enqueue(kind,'delete',id);
  }
  private changed(name:string,oldValue:unknown,nextValue:unknown) {
    if(name==='glucose'||name==='hba1c'){this.diffList(name,array(oldValue),array(nextValue));return;}
    if(name!=='profile')return;
    const old=object(oldValue),next=object(nextValue);
    if(!same(coreProfile(old),coreProfile(next)))this.enqueue('profile','update',undefined,coreProfile(next));
    const beforeIntakes=new Map(array(old.medicationIntakes).map(item=>[String(item.id),item]));
    const affectedMedications=new Set<string>();
    const newlyTaken=new Map<string,number>();
    for(const intake of array(next.medicationIntakes)){
      const prior=beforeIntakes.get(String(intake.id));
      if((prior&&prior.status!==intake.status)||(!prior&&intake.status==='taken'))affectedMedications.add(String(intake.medicationId));
      if(!prior&&intake.status==='taken')newlyTaken.set(String(intake.medicationId),(newlyTaken.get(String(intake.medicationId))||0)+Number(intake.amount||0));
    }
    const priorMedications=new Map(array(old.medications).map(item=>[String(item.id),item]));
    const resetPendingMedications=new Set(array(next.medications).filter(item=>{
      const prior=priorMedications.get(String(item.id));
      return prior&&(!same(prior.schedule,item.schedule)||!!prior.reminderEnabled!==!!item.reminderEnabled);
    }).map(item=>String(item.id)));
    const adjusted=array(next.medications).map(item=>{
      const prior=priorMedications.get(String(item.id));
      if(!affectedMedications.has(String(item.id))||!item.inventory)return item;
      if(prior?.inventory)return {...item,inventory:{...item.inventory,quantity:prior.inventory.quantity}};
      const amount=newlyTaken.get(String(item.id))||0;
      return amount?{...item,inventory:{...item.inventory,quantity:Number(item.inventory.quantity||0)+amount}}:item;
    });
    this.diffList('medication',array(old.medications),adjusted);
    const oldSelected=new Set(array(old.nextClinicQuestions));
    const newSelected=new Set(array(next.nextClinicQuestions));
    const oldQuestions=new Set(array(old.savedDoctorQuestions));
    const newQuestions=new Set(array(next.savedDoctorQuestions));
    // Delete replacements first: the API deduplicates normalized whitespace.
    for(const text of oldQuestions)if(!newQuestions.has(text))this.enqueue('question','delete',String(text));
    for(const text of newQuestions) {
      if(!oldQuestions.has(text))this.enqueue('question','create',String(text),{text,selected:newSelected.has(text)});
      else if(oldSelected.has(text)!==newSelected.has(text))this.enqueue('question','update',String(text),{text,selected:newSelected.has(text)});
    }
    const before=new Map(array(old.medicationIntakes).map(item=>[String(item.id),item]));
    const after=new Map(array(next.medicationIntakes).map(item=>[String(item.id),item]));
    for(const [id,item] of after) {
      const prior=before.get(id);
      // A schedule edit deletes all pending server rows, including unchanged
      // slots. Recreate surviving snapshots after the medication update.
      if(!prior||(prior.status==='pending'&&item.status==='pending'&&resetPendingMedications.has(String(item.medicationId)))){
        this.enqueue('intake','create',id,item);if(item.status==='taken')this.enqueue('intake','confirm',id);
      }
      else if(prior.status!==item.status&&item.status==='taken')this.enqueue('intake','confirm',id);
      else if(prior.status!==item.status&&item.status==='pending')this.enqueue('intake','undo',id);
    }
  }
  async start(){
    this.ensureActive();
    if(this.queue.length)await this.flush();
    if(!this.queue.length)await this.hydrate();
    this.ensureActive();
    observeCloudStorage((name,oldValue,nextValue)=>{
      this.changed(name,oldValue,nextValue);
      return this.waitForSync();
    });
    this.timer=window.setInterval(this.backgroundFlush,10000);
    window.addEventListener('online',this.onOnline);
  }
  stop(){if(this.stopped)return;this.stopped=true;this.abort.abort();observeCloudStorage(null);if(this.timer)clearInterval(this.timer);if(typeof window!=='undefined')window.removeEventListener('online',this.onOnline);}
  private onOnline=this.backgroundFlush;
  async waitForSync(){
    await this.appending;
    this.ensureActive();
    await this.flush();
    this.ensureActive();
    if(this.queue.length)throw new Error('修改已保留在此裝置，尚未同步至雲端。');
  }
  private async all<T>(path:string):Promise<T[]> {
    let offset=0;const items:T[]=[];
    while(true){const page=await this.request<Page<T>>(`${path}${path.includes('?')?'&':'?'}limit=100&offset=${offset}`);items.push(...page.items);if(!page.hasMore)return items;offset+=100;}
  }
  async hydrate(){
    const profile=await this.request<{profile:Record<string,unknown>;version:number}>('/me/profile');
    const [glucose,hba1c,medications,questions,conversations]=await Promise.all([
      this.all<ServerRecord>('/records/glucose'),this.all<ServerRecord>('/records/hba1c'),this.all<any>('/medications'),this.all<any>('/questions'),this.all<any>('/ai/conversations')]);
    const intakes={items:await this.all<any>('/medication-intakes/history')};
    const meds=medications.map(m=>({...m}));
    const merged:UserProfile={...emptyProfile(),...profile.profile,medications:meds,
      savedDoctorQuestions:questions.map(q=>q.text),nextClinicQuestions:questions.filter(q=>q.selected).map(q=>q.text),
      medicationIntakes:intakes.items.map(i=>({...i,name:i.name??meds.find(m=>m.id===i.medicationId)?.name??''}))};
    const mappingKey=this.key('ai_conversation_map');
    const mapping=JSON.parse(localStorage.getItem(mappingKey)||'{}') as Record<string,string>;
    const localByRemote=Object.fromEntries(Object.entries(mapping).map(([local,remote])=>[remote,local]));
    const chatList=[];
    for(const conversation of conversations){
      const messages=await this.all<any>(`/ai/conversations/${conversation.id}/messages`);
      const localId=localByRemote[conversation.id]||conversation.id;
      mapping[localId]=conversation.id;
      chatList.push({id:localId,title:conversation.title,createdAt:Date.parse(conversation.createdAt),messages:messages.reverse().map(message=>({
        id:message.id,role:message.role,text:message.body,timestamp:Date.parse(message.createdAt),
        source:message.role==='user'?'user':message.source||'qwen',hasPhoto:message.hasPhoto,
        shouldSave:message.shouldSave??undefined,doctorQuestion:message.doctorQuestion??undefined,
        ...(message.shouldSave?{suggestionState:'pending'}:{}),delivery:'sent',
      }))});
    }
    this.ensureActive();
    localStorage.setItem(this.key('profile'),JSON.stringify(merged));
    localStorage.setItem(this.key('glucose'),JSON.stringify(glucose.map(r=>({...r.data,id:r.id}))));
    localStorage.setItem(this.key('hba1c'),JSON.stringify(hba1c.map(r=>({...r.data,id:r.id}))));
    localStorage.setItem(mappingKey,JSON.stringify(mapping));
    if(chatList.length)localStorage.setItem(this.key('conversations'),JSON.stringify(chatList));
    this.versions=emptyVersions();this.versions.profile=profile.version;
    for(const [kind,rows] of [['glucose',glucose],['hba1c',hba1c]] as const)
      for(const row of rows)this.versions[kind][row.id]={id:row.id,version:row.version};
    for(const med of meds)this.versions.medication[med.id]={id:med.id,version:med.version};
    for(const question of questions)this.versions.question[question.text]={id:question.id,version:question.version};
    for(const intake of intakes.items)this.versions.intake[intake.id]={id:intake.id,version:intake.version};
    this.save();
  }
  async flush(){
    if(this.stopped||this.flushing)return;
    this.flushing=true;
    try {
      await this.locked(async()=>{
        try{this.queue=JSON.parse(localStorage.getItem(this.queueKey())||'[]');}catch{this.queue=[];}
        try{this.versions={...emptyVersions(),...JSON.parse(localStorage.getItem(this.versionsKey())||'{}')};}catch{}
        while(this.queue.length) {
          const op=this.queue[0];
          try{this.ensureActive();await this.apply(op);this.ensureActive();this.queue.shift();this.save();}
          catch(error){
            if(isSessionFailure(error))throw error;
            if(this.stopped)return;
            // A later profile save is a complete replacement of the rejected draft.
            if(error instanceof BackendError&&[400,422].includes(error.status)&&op.kind==='profile'
              &&this.queue.slice(1).some(next=>next.kind==='profile')){
              this.queue.shift();this.save();continue;
            }
            if(error instanceof BackendError&&[400,422].includes(error.status)&&['glucose','hba1c'].includes(op.kind)
              &&['create','update'].includes(op.action)){
              const next=this.queue.slice(1).find(next=>next.kind===op.kind&&next.localId===op.localId
                &&(next.action==='delete'||JSON.stringify(next.body)!==JSON.stringify(op.body)));
              if(next){
                // Keep the later operation in FIFO order; a never-created record's delete is a no-op.
                if(next.action==='delete')this.queue.shift();
                else this.queue[0]={...op,key:requestKey(),body:next.body};
                this.save();continue;
              }
            }
            if(error instanceof BackendError&&[400,422].includes(error.status)&&['INVALID_MEDICATION','MEDICATION_NAME_REQUIRED'].includes(error.code)
              &&op.kind==='medication'&&['create','update'].includes(op.action)){
              const corrected=this.queue.slice(1).find(next=>next.kind==='medication'&&next.localId===op.localId&&['create','update'].includes(next.action)
                &&['name','dosage','usage'].some(field=>next.body?.[field]!==op.body?.[field]));
              if(corrected){
                // Repair rejected text in place; keep the later full save after
                // intervening intake mutations so inventory is not debited twice.
                this.queue[0]={...op,key:requestKey(),body:{...op.body,name:corrected.body.name,dosage:corrected.body.dosage,usage:corrected.body.usage}};
                this.save();continue;
              }
            }
            this.notify(error instanceof BackendError&&[404,409].includes(error.status)?'conflict':error instanceof BackendError&&error.status>0&&error.status<500?'invalid':'offline');
            break;
          }
        }
      });
    } finally {this.flushing=false;}
  }
  async useCloudAfterConflict(){
    this.ensureActive();
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const backup={queue:this.queue,profile:localStorage.getItem(this.key('profile')),
      glucose:localStorage.getItem(this.key('glucose')),hba1c:localStorage.getItem(this.key('hba1c'))};
    localStorage.setItem(`dia_cloud_${this.userId}_conflict_backup_${stamp}`,JSON.stringify(backup));
    await this.hydrate();this.ensureActive();this.queue=[];this.save();location.reload();
  }
  private async apply(op:Operation){
    if(op.kind==='profile'){
      const result=await this.request<{version:number}>('/me/profile',{method:'PUT',body:op.body,version:this.versions.profile});
      this.versions.profile=result.version;return;
    }
    const kind=op.kind,localId=op.localId!;
    const refs=this.versions[kind] as Record<string,Ref>;
    const ref=refs[localId];
    if(kind==='glucose'||kind==='hba1c'){
      const path=`/records/${kind}`;
      if(op.action==='create'){
        const row=await this.request<{id:string;version:number}>(path,{method:'POST',body:op.body,idempotencyKey:op.key});refs[localId]={id:row.id,version:row.version};
      } else if(ref&&op.action==='update'){
        const row=await this.request<{version:number}>(`${path}/${ref.id}`,{method:'PUT',body:op.body,version:ref.version});ref.version=row.version;
      } else if(ref&&op.action==='delete'){
        await this.request(`${path}/${ref.id}`,{method:'DELETE',version:ref.version});delete refs[localId];
      }return;
    }
    if(kind==='medication'){
      const body={...op.body,inventory:op.body?.inventory??null};
      if(op.action==='create'){
        const row=await this.request<{id:string;version:number}>('/medications',{method:'POST',body,idempotencyKey:op.key});refs[localId]={id:row.id,version:row.version};
      } else if(ref&&op.action==='update'){
        const row=await this.request<{version:number}>(`/medications/${ref.id}`,{method:'PUT',body,version:ref.version});ref.version=row.version;
      } else if(ref&&op.action==='delete'){
        await this.request(`/medications/${ref.id}`,{method:'DELETE',version:ref.version});delete refs[localId];
      }return;
    }
    if(kind==='question'){
      if(op.action==='create'){
        const row=await this.request<{id:string;version:number}>('/questions',{method:'POST',body:op.body,idempotencyKey:op.key});refs[localId]={id:row.id,version:row.version};
      } else if(ref&&op.action==='update'){
        const row=await this.request<{version:number}>(`/questions/${ref.id}`,{method:'PUT',body:op.body,version:ref.version});ref.version=row.version;
      } else if(ref&&op.action==='delete'){
        await this.request(`/questions/${ref.id}`,{method:'DELETE',version:ref.version});delete refs[localId];
      }return;
    }
    if(kind==='intake'){
      if(op.action==='create'){
        const medication=this.versions.medication[op.body.medicationId]?.id??op.body.medicationId;
        const row=await this.request<{id:string;version:number}>('/medication-intakes',{method:'POST',body:{...op.body,medicationId:medication},idempotencyKey:op.key});refs[localId]={id:row.id,version:row.version};
      } else if(ref&&['confirm','undo'].includes(op.action)){
        const row=await this.request<{version:number;medicationId?:string;medicationVersionBefore?:number;medicationVersion?:number}>(`/medication-intakes/${ref.id}/${op.action}`,{method:'POST',body:{},idempotencyKey:op.key});ref.version=row.version;
        // Surface stale local stock immediately, even though the idempotent
        // intake mutation has committed. Existing conflict recovery reloads it.
        if(row.medicationId&&Number.isInteger(row.medicationVersionBefore)&&Number.isInteger(row.medicationVersion)){
          for(const medication of Object.values(this.versions.medication)){
            if(medication.id===row.medicationId){
              if(medication.version!==row.medicationVersionBefore)throw new BackendError(409,'VERSION_CONFLICT','庫存已在其他裝置更新，請重新載入。');
              medication.version=row.medicationVersion!;
            }
          }
        }
      }
    }
  }
}
