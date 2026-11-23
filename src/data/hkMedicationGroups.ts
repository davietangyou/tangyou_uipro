export interface HkDiabetesMedication {
    name: string;
    label: string;
    class: string;
    classZh: string;
}

// 由舊 utils/constants.ts 遷出的活躍藥物分組。
// 舊 BMI 評估、舊疾病常量及舊扁平藥物清單未遷移。
export const HK_HA_MEDICATION_GROUPS = [
    {
        category: 'Biguanides (雙胍類)',
        meds: [
            { name: 'Metformin (Glucophage)', label: 'Metformin / Glucophage (美福明 / 雙胍)', class: 'Biguanides', classZh: '雙胍類' },
            { name: 'Metformin XR (Glucophage XR)', label: 'Metformin XR / Glucophage XR (美福明緩釋片)', class: 'Biguanides', classZh: '雙胍類' },
        ]
    },
    {
        category: 'Sulfonylureas (磺酰脲類促泌劑)',
        meds: [
            { name: 'Gliclazide (Diamicron)', label: 'Gliclazide / Diamicron (格列齊特 / 達美康)', class: 'Sulfonylureas', classZh: '磺酰脲類' },
            { name: 'Gliclazide MR (Diamicron MR)', label: 'Gliclazide MR / Diamicron MR (達美康緩釋片)', class: 'Sulfonylureas', classZh: '磺酰脲類' },
            { name: 'Glipizide (Minidiab)', label: 'Glipizide / Minidiab (格列吡嗪)', class: 'Sulfonylureas', classZh: '磺酰脲類' },
            { name: 'Glimepiride (Amaryl)', label: 'Glimepiride / Amaryl (格列美脲)', class: 'Sulfonylureas', classZh: '磺酰脲類' },
        ]
    },
    {
        category: 'DPP-4 Inhibitors (DPP-4 抑制劑)',
        meds: [
            { name: 'Sitagliptin (Januvia)', label: 'Sitagliptin / Januvia (西格列汀 / 捷諾維)', class: 'DPP-4 Inhibitors', classZh: 'DPP-4 抑制劑' },
            { name: 'Linagliptin (Trajenta)', label: 'Linagliptin / Trajenta (利格列汀 / 糖適平)', class: 'DPP-4 Inhibitors', classZh: 'DPP-4 抑制劑' },
            { name: 'Vildagliptin (Galvus)', label: 'Vildagliptin / Galvus (維格列汀 / 佳維樂)', class: 'DPP-4 Inhibitors', classZh: 'DPP-4 抑制劑' },
            { name: 'Alogliptin (Nesina)', label: 'Alogliptin / Nesina (阿格列汀)', class: 'DPP-4 Inhibitors', classZh: 'DPP-4 抑制劑' },
            { name: 'Saxagliptin (Onglyza)', label: 'Saxagliptin / Onglyza (沙格列汀)', class: 'DPP-4 Inhibitors', classZh: 'DPP-4 抑制劑' },
        ]
    },
    {
        category: 'SGLT-2 Inhibitors (SGLT-2 抑制劑 / 排糖藥)',
        meds: [
            { name: 'Empagliflozin (Jardiance)', label: 'Empagliflozin / Jardiance (恩格列淨 / 恩排糖)', class: 'SGLT-2 Inhibitors', classZh: 'SGLT-2 抑制劑' },
            { name: 'Dapagliflozin (Forxiga)', label: 'Dapagliflozin / Forxiga (達格列淨 / 安達糖)', class: 'SGLT-2 Inhibitors', classZh: 'SGLT-2 抑制劑' },
            { name: 'Canagliflozin (Invokana)', label: 'Canagliflozin / Invokana (卡格列淨)', class: 'SGLT-2 Inhibitors', classZh: 'SGLT-2 抑制劑' },
        ]
    },
    {
        category: 'GLP-1 Receptor Agonists (GLP-1 激動劑)',
        meds: [
            { name: 'Semaglutide (Ozempic / Rybelsus)', label: 'Semaglutide / Ozempic / Rybelsus (司美格魯肽)', class: 'GLP-1 RA', classZh: 'GLP-1 激動劑' },
            { name: 'Dulaglutide (Trulicity)', label: 'Dulaglutide / Trulicity (度拉糖肽)', class: 'GLP-1 RA', classZh: 'GLP-1 激動劑' },
            { name: 'Liraglutide (Victoza)', label: 'Liraglutide / Victoza (利拉魯肽 / 諾和力)', class: 'GLP-1 RA', classZh: 'GLP-1 激動劑' },
            { name: 'Tirzepatide (Mounjaro)', label: 'Tirzepatide / Mounjaro (替爾泊肽 GIP/GLP-1)', class: 'GLP-1 RA', classZh: 'GLP-1 激動劑' },
        ]
    },
    {
        category: 'Oral Combination Drugs (HA 常用口服複方)',
        meds: [
            { name: 'Janumet (Metformin + Sitagliptin)', label: 'Janumet (Metformin + Sitagliptin 捷諾達)', class: 'Combinations', classZh: '口服複方' },
            { name: 'Janumet XR (Metformin XR + Sitagliptin)', label: 'Janumet XR (Metformin XR + Sitagliptin)', class: 'Combinations', classZh: '口服複方' },
            { name: 'Galvus Met (Metformin + Vildagliptin)', label: 'Galvus Met (Metformin + Vildagliptin 宜妥達)', class: 'Combinations', classZh: '口服複方' },
            { name: 'Trajenta Duo (Metformin + Linagliptin)', label: 'Trajenta Duo (Metformin + Linagliptin 歐唐寧)', class: 'Combinations', classZh: '口服複方' },
            { name: 'Synjardy (Metformin + Empagliflozin)', label: 'Synjardy (Metformin + Empagliflozin 恩排糖複方)', class: 'Combinations', classZh: '口服複方' },
            { name: 'Xigduo XR (Metformin XR + Dapagliflozin)', label: 'Xigduo XR (Metformin XR + Dapagliflozin 安達糖複方)', class: 'Combinations', classZh: '口服複方' },
            { name: 'Glyxambi (Empagliflozin + Linagliptin)', label: 'Glyxambi (Empagliflozin + Linagliptin)', class: 'Combinations', classZh: '口服複方' },
        ]
    },
    {
        category: 'Thiazolidinediones & Others (增敏劑及其他口服藥)',
        meds: [
            { name: 'Pioglitazone (Actos)', label: 'Pioglitazone / Actos (吡格列酮)', class: 'TZDs', classZh: '胰島素增敏劑' },
            { name: 'Acarbose (Glucobay)', label: 'Acarbose / Glucobay (阿卡波糖 / 拜糖平)', class: 'Alpha-glucosidase', classZh: '葡萄糖苷酶抑制劑' },
        ]
    },
    {
        category: 'Insulins (香港 HA 常用胰島素針劑)',
        meds: [
            { name: 'Insulin Glargine (Lantus / Toujeo)', label: 'Insulin Glargine (Lantus / Toujeo 長效基礎)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Insulin Degludec (Tresiba)', label: 'Insulin Degludec (Tresiba 超長效基礎)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Insulin Detemir (Levemir)', label: 'Insulin Detemir (Levemir 長效基礎)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Insulin NPH / Isophane (Humulin N / Insulatard)', label: 'Insulin NPH / Isophane (Humulin N / Insulatard 中效)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Insulin Aspart (NovoRapid)', label: 'Insulin Aspart (NovoRapid 諾和速效)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Insulin Lispro (Humalog)', label: 'Insulin Lispro (Humalog 優泌樂速效)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Insulin Glulisine (Apidra)', label: 'Insulin Glulisine (Apidra 艾倍得速效)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Regular Human Insulin (Actrapid / Humulin R)', label: 'Regular Insulin (Actrapid / Humulin R 短效常規)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Biphasic Insulin Aspart 30 (NovoMix 30)', label: 'NovoMix 30 (雙相門冬胰島素 30)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Biphasic Insulin Lispro (Humalog Mix 25/50)', label: 'Humalog Mix 25/50 (優泌樂預混型)', class: 'Insulins', classZh: '胰島素' },
            { name: 'Biphasic Isophane Insulin (Mixtard 30)', label: 'Mixtard 30 (雙相等糖胰島素 30)', class: 'Insulins', classZh: '胰島素' },
        ]
    }
];