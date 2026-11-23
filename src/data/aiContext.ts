import type { GlucoseRecord, HbA1cRecord, UserProfile } from './types';
import type { HealthContext } from '../../shared/ai';
export function buildHealthContext(profile: UserProfile, records: GlucoseRecord[], hba1c: HbA1cRecord[], demo: boolean, now = Date.now()): HealthContext {
  return {
    source: demo ? 'demo' : 'user', age: profile.age ?? null, diabetesType: profile.diabetesType ?? null,
    usesInsulin: profile.usesInsulin || 'unknown', conditions: profile.conditions || [],
    medications: (profile.medications || []).filter(m => m.name?.trim()).map(m => ({ name: m.name, dosage: m.dosage, usage: m.usage })),
    glucose: records.filter(r => r.timestamp >= now - 14 * 86400000 && r.timestamp <= now)
      .sort((a,b) => b.timestamp - a.timestamp).slice(0,100)
      .map(r => ({ value: r.value > 0 ? r.value : null, timestamp: r.timestamp, timeType: r.timeType, mealTag: r.mealTag, symptoms: r.symptoms || [] })),
    hba1c: [...hba1c].sort((a,b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')).slice(0,3)
      .map(r => ({ value: r.value, date: r.date, ...(r.time ? {time:r.time} : {}) })),

    // Extended profile fields
    name: profile.name || null,
    sex: profile.sex || null,
    heightCm: profile.heightCm ?? null,
    weight: profile.weight ?? null,
    weightUnit: profile.weightUnit || 'kg',
    diabetesDurationYears: profile.diabetesDurationYears ?? null,

    // Risk flags
    hasHypoHistory: !!profile.hasHypoHistory,
    isFrail: !!profile.isFrail,
    hasHypoUnawareness: !!profile.hasHypoUnawareness,
    healthLiteracy: profile.healthLiteracy || null,

    // Lifestyle
    hasCaregiverSupport: !!profile.hasCaregiver,
    livesAlone: !!profile.livesAlone,
    dietHabits: profile.dietHabits || [],
    favoriteFoods: profile.favoriteFoods || '',
    exerciseFreq: profile.exerciseFreq || null,
    exerciseTypes: profile.exerciseTypes || [],
    exerciseMinutes: profile.exerciseMinutes ?? null,

    // Clinic
    clinicTypes: profile.clinicTypes || [],

    // Accumulated AI cognition
    expressedConcerns: profile.expressedConcerns || [],
    preferenceSignals: profile.preferenceSignals || [],
    educationTopicsViewed: profile.educationTopicsViewed || [],
    recentQuestionThemes: profile.recentQuestionThemes || [],
    inferredNotes: profile.inferredNotes || [],
    riskSignals: profile.riskSignals || [],
  };
}