import { migrateChatQuestions } from '../data/questionMigration';
import { normalizeMedications } from '../data/medication';
import { migrateHbA1c } from '../data/hba1c';
import type { UserProfile, GlucoseRecord } from '../data/types';
import { buildSeedProfile } from '../data/profileSeed';
import { buildSeedRecords } from '../data/seed';

export const isDesignPreview = () =>
  typeof window !== 'undefined' &&
  (new URLSearchParams(location.search).get('preview') === 'design' ||
    location.hostname.endsWith('.chatgpt.site') ||
    location.pathname === '/diaguide' ||
    location.pathname.startsWith('/diaguide/'));
let cloudUserId: string | null = null;
let storageObserver: ((name: string, previous: unknown, next: unknown) => void | Promise<void>) | null = null;
let pendingSync: Promise<void> = Promise.resolve();
export function setCloudStorageUser(id: string | null) { cloudUserId = id; }
export function observeCloudStorage(callback: ((name: string, previous: unknown, next: unknown) => void | Promise<void>) | null) {
  storageObserver = callback;
  if (!callback) pendingSync = Promise.resolve();
}
export function waitForStorageSync() { return pendingSync; }
export const storageKey = (name: string) => `${isDesignPreview() ? 'dia_design_' : cloudUserId ? `dia_cloud_${cloudUserId}_` : 'dia_v2_'}${name}`;
export function readStored<T>(name: string, fallback: T): T {
  const raw = localStorage.getItem(storageKey(name));
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { throw new Error('本機資料未能讀取，原有資料已保留。'); }
}
export function writeStored(name: string, value: unknown) {
  const key = storageKey(name);
  const old = localStorage.getItem(key);
  const next = JSON.stringify(value);
  localStorage.setItem(key, next);
  if (cloudUserId && storageObserver && old !== next) {
    let previous: unknown = null;
    try { previous = old ? JSON.parse(old) : null; } catch { /* Backup remains untouched. */ }
    pendingSync = Promise.resolve(storageObserver(name, previous, value));
    // The UI consumes this result; a background write must not create an unhandled rejection.
    void pendingSync.catch(() => {});
  }
}
export function emptyProfile(): UserProfile {
  return { name:'',age:null,sex:null,heightCm:null,weight:null,weightUnit:'kg',diabetesType:null,
    diagnosisYear:null,diabetesDurationYears:null,usesDiabetesMeds:'unknown',usesInsulin:'unknown',medications:[],
    noChronicConditions:false,conditions:[],conditionDetails:{},otherConditionNote:'',hasCaregiver:false,livesAlone:false,
    dietHabits:[],favoriteFoods:'',exerciseFreq:null,exerciseMinutes:null,exerciseIntensity:null,exerciseTypes:[],otherExerciseNote:'',
    savedDoctorQuestions:[],nextClinicQuestions:[],nextClinicDate:'' };
}
export function hasLocalImportData(snapshot: {profile: UserProfile; glucose: unknown[]; hba1c: unknown[]; medications: unknown[]; medicationIntakes: unknown[]; questions: unknown[]; conversations: unknown[]}): boolean {
  const defaults = emptyProfile() as unknown as Record<string, unknown>;
  const profileHasData = Object.entries(snapshot.profile).some(([key, value]) => {
    if (value == null || value === '' || (typeof value === 'object' && Object.keys(value).length === 0)) return false;
    return JSON.stringify(value) !== JSON.stringify(defaults[key]);
  });
  return profileHasData || [snapshot.glucose, snapshot.hba1c, snapshot.medications, snapshot.medicationIntakes, snapshot.questions, snapshot.conversations].some(items => items.length > 0);
}
const numberOrNull = (v: unknown) => v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
const conditionNames: Record<string,string> = {HT:'高血壓',DM:'糖尿病',CH:'高血脂',CT:'白內障',HD:'心臟病',ST:'中風',CA:'癌症',RD:'呼吸系統疾病',OA:'退化性關節炎',TD:'甲狀腺疾病',GD:'腸胃疾病',LD:'肝病',OT:'其他'};
export function migrateProfile(raw: any): UserProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('個人資料格式不正確，原有資料已保留。');
  if ('sex' in raw || 'heightCm' in raw) return {...emptyProfile(), ...raw};
  const diabetes: Record<string, UserProfile['diabetesType']> = {TYPE_1:'type1',TYPE_2:'type2',GESTATIONAL:'gestational',PRE_DIABETES:'prediabetes',UNKNOWN:'unknown',OTHER:'other'};
  return {...emptyProfile(), legacyData:raw, name:raw.name || '', age:numberOrNull(raw.age),
    sex:({男:'male',女:'female',其他:'other'} as const)[raw.gender as '男'] || null,
    heightCm:numberOrNull(raw.height),weight:numberOrNull(raw.weight),weightUnit:raw.weightUnit === 'lb' ? 'lb' : 'kg',
    diabetesType:diabetes[raw.diabetesType] ?? null,otherDiabetesType:raw.otherDiabetesType || '', diabetesDurationYears:numberOrNull(raw.yearsWithDiabetes),
    usesInsulin:raw.isInsulinUser === true ? 'yes' : raw.isInsulinUser === false ? 'no' : 'unknown',
    medications:Array.isArray(raw.medicationDetails) ? raw.medicationDetails : raw.medications ? [{name:raw.medications}] : [],
    usesDiabetesMeds:raw.medicationDetails?.length || raw.medications ? 'yes' : 'unknown',
    noChronicConditions:(raw.conditions || []).includes('NONE'),
    conditions:(raw.conditions || []).filter((c:string)=>c !== 'NONE' && c !== 'DM').map((c:string)=>conditionNames[c] || c),
    conditionDetails:Object.fromEntries(Object.entries(raw.conditionDetails || {}).map(([k,v])=>[conditionNames[k] || k,v])),
    otherConditionNote:raw.otherConditions || '',hasCaregiver:raw.hasCaregiverSupport === true,livesAlone:raw.hasNoCaregiverSupport === true,
    dietHabits:raw.dietHabits || [],favoriteFoods:raw.favoriteFoods || '', exerciseFreq:raw.exerciseDaysPerWeek || null,
    exerciseMinutes:numberOrNull(String(raw.exerciseMinutesPerSession || '').replace('+','')),exerciseIntensity:raw.exerciseIntensity || null,
    exerciseTypes:raw.exerciseTypes || [],otherExerciseNote:raw.exerciseTypesOther || '',
    savedDoctorQuestions:raw.savedDoctorQuestions || [],nextClinicQuestions:raw.nextClinicQuestions || [],nextClinicDate:raw.nextClinicDate || ''};
}
export function migrateGlucose(raw: any): GlucoseRecord[] {
  if (!Array.isArray(raw)) throw new Error('血糖資料格式不正確，原有資料已保留。');
  const times:Record<string,GlucoseRecord['timeType']> = {'空腹':'fasting','餐前':'preMeal','餐後2小時':'postMeal','睡前':'bedtime','日常其他時間':'random'};
  const meals:Record<string,string> = {'早餐':'breakfast','午餐':'lunch','晚餐':'dinner','其他':'other'};
  return raw.map((r:any)=>{
    if (!r || !Number.isFinite(Number(r.timestamp)) || (r.value !== '' && !Number.isFinite(Number(r.value)))) throw new Error('部分血糖資料未能轉換，原有資料已保留。');
    return {...r,value:r.value === '' ? 0 : Number(r.value),timestamp:Number(r.timestamp),timeType:times[r.timeType] || r.timeType,
      mealTag:meals[r.mealTag] || r.mealTag,symptoms:r.symptoms || []};
  }).sort((a,b)=>b.timestamp-a.timestamp);
}
function loadOrMigrate<T>(name: string, oldKey: string, empty:()=>T, convert:(r:unknown)=>T, seed:()=>T): T {
  const stored = readStored<T | null>(name,null);
  if (stored !== null) return convert(stored);
  if (isDesignPreview()) { const demo=seed();writeStored(name,demo);return demo; }
  const original=localStorage.getItem(oldKey);
  if (!original) return empty();
  let parsed: unknown;
  try { parsed=JSON.parse(original); } catch { throw new Error('舊資料未能讀取，已保留原件，請勿重置。'); }
  const migrated=convert(parsed);
  // Keep both the untouched old key and an immutable first-migration backup.
  if (!localStorage.getItem(`${oldKey}_pre_v2`)) localStorage.setItem(`${oldKey}_pre_v2`,original);
  writeStored(name,migrated);
  return migrated;
}
export function loadProfile(): UserProfile {
  const profile = migrateChatQuestions(loadOrMigrate('profile','dia_profile',emptyProfile,migrateProfile,buildSeedProfile), localStorage, isDesignPreview() ? 'dia_design_' : 'dia_v2_');
  const medications = normalizeMedications(profile.medications);
  if (JSON.stringify(medications) === JSON.stringify(profile.medications)) return profile;
  const key = storageKey('profile');
  const backup = `${key}_pre_medication`;
  if (!localStorage.getItem(backup)) localStorage.setItem(backup, localStorage.getItem(key) || JSON.stringify(profile));
  const next = { ...profile, medications };
  writeStored('profile', next);
  return next;
}
export const loadGlucose = () => loadOrMigrate('glucose','dia_glucose',()=>[],migrateGlucose,buildSeedRecords);
export type SetupState = {step:number;status:'active'|'later'|'complete'};
export function loadSetup(profile:UserProfile):SetupState {
  return readStored<SetupState>('setup',{step:0,status:isDesignPreview() || (profile.age != null && profile.sex != null) ? 'complete' : 'active'});
}

export const loadHbA1c = () => loadOrMigrate('hba1c', 'dia_hba1c', () => [], migrateHbA1c, () => []);
