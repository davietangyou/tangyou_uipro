import { GoogleGenAI } from '@google/genai';
import { performance } from 'node:perf_hooks';
import { AiError } from '../shared/ai';
import type { Generate } from './app';
import { log, logModelText } from './log';
export type AiProvider = 'qwen' | 'gemini';

export function createProvider(env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch) {
  const provider = env.AI_PROVIDER || 'qwen';
  if (provider !== 'qwen' && provider !== 'gemini') throw new Error('AI_PROVIDER must be qwen or gemini');
  const key = provider === 'qwen' ? env.DASHSCOPE_API_KEY : env.GEMINI_API_KEY;
  const model = provider === 'qwen' ? env.QWEN_MODEL || 'qwen3.8-flash' : env.GEMINI_MODEL || 'gemini-3.8-flash';
  const visionModel = provider === 'qwen' ? env.QWEN_VISION_MODEL : env.GEMINI_VISION_MODEL;
  const geminiMaxOutputTokens = Number(env.GEMINI_MAX_OUTPUT_TOKENS || 50_000);
  const geminiTimeoutMs = Number(env.GEMINI_TIMEOUT_MS || 600_000);
  const qwenMaxOutputTokens = Number(env.QWEN_MAX_OUTPUT_TOKENS || 50_000);
  const requireVision = () => { if (!visionModel?.trim()) throw new AiError('VISION_NOT_CONFIGURED', '尚未設定圖片識別模型，請稍後再試或自行輸入。', 503); };
  const invalid = () => new AiError('INVALID_RESPONSE', 'AI 回應格式不完整，請再試一次。', 502);
  let generate: Generate;
  if (provider === 'qwen') {
    const base = new URL(env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    // Only official Model Studio endpoints may receive the configured credential.
    if (base.protocol !== 'https:' || base.username || base.password || base.port || base.search || base.hash ||
      !(/^(dashscope|dashscope-intl|dashscope-us)\.aliyuncs\.com$/.test(base.hostname) || /^[a-z0-9-]+\.[a-z0-9-]+\.maas\.aliyuncs\.com$/.test(base.hostname)) ||
      !/^\/compatible-mode\/v1\/?$/.test(base.pathname)) throw new Error('QWEN_BASE_URL must be an official Model Studio compatible endpoint');
    generate = async ({system,instruction,data,schema,signal,image}) => {
      if (image) requireVision();
      const started = performance.now();
      const response = await request(base.href.replace(/\/$/,'')+'/chat/completions', {
        method:'POST', redirect:'error', signal,
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify({ model: image ? visionModel! : model, enable_thinking:false, messages:[{role:'system',content:system},{role:'user',content:image ? [{type:"text",text:`${instruction}\n輸入資料：\n${JSON.stringify(data)}`},{type:"image_url",image_url:{url:`data:${image.mimeType};base64,${image.data}`}}] : `${instruction}\n輸入資料：\n${JSON.stringify(data)}`}],
          response_format:image ? {type:'json_object'} : {type:'json_schema',json_schema:{name:'ai_result',strict:true,schema}},max_tokens:qwenMaxOutputTokens }),
      });
      const body = await response.json().catch(() => null);
      log('debug', 'provider.response', {
        provider: 'qwen',
        status: response.status,
        durationMs: Math.round(performance.now() - started),
        model: image ? visionModel : model,
      });
      if (!response.ok) {
        if (image && response.status === 400) throw new AiError('VISION_REQUEST_REJECTED', '圖片識別服務未能處理照片，請檢查模型是否支援圖片，或更換照片後重試。', 502);
        // Keep only a bounded machine code; do not surface provider messages or request bodies.
        const rawCode = body?.error?.code ?? body?.code;
        const code = typeof rawCode === 'string' && /^[\w.-]{1,100}$/.test(rawCode) ? rawCode : 'ProviderError';
        log('warn', 'provider.http_error', { provider: 'qwen', status: response.status, code });
        throw Object.assign(new Error(code), {status:response.status});
      }
      const choice = body?.choices?.[0];
      log('debug', 'provider.choice', {
        provider: 'qwen',
        finishReason: choice?.finish_reason,
        refusal: !!choice?.message?.refusal,
        contentType: typeof choice?.message?.content,
        contentLen: typeof choice?.message?.content === 'string' ? choice.message.content.length : undefined,
        usage: body?.usage,
      });
      if (choice?.finish_reason !== 'stop' || choice.message?.refusal || typeof choice.message?.content !== 'string') {
        log('error', 'provider.unusable_choice', {
          provider: 'qwen',
          finishReason: choice?.finish_reason,
          refusal: !!choice?.message?.refusal,
          contentType: typeof choice?.message?.content,
        });
        throw invalid();
      }
      try { return JSON.parse(choice.message.content); } catch (error) {
        log('error', 'provider.json_error', {
          provider: 'qwen',
          finishReason: choice.finish_reason,
          error: error instanceof Error ? error.message : String(error),
        });
        logModelText('provider.raw', choice.message.content);
        throw invalid();
      }
    };
  } else {
    const client = key ? new GoogleGenAI({apiKey:key}) : null;
    generate = async ({system,instruction,data,schema,signal,image}) => {
      if (image) requireVision();
      const started = performance.now();
      const response = await client!.models.generateContent({ model: image ? visionModel! : model, contents:image ? [{text:`${instruction}\n輸入資料：\n${JSON.stringify(data)}`},{inlineData:{mimeType:image.mimeType,data:image.data}}] : `${instruction}\n輸入資料：\n${JSON.stringify(data)}`,
        config:{systemInstruction:system,responseMimeType:'application/json',responseJsonSchema:schema,abortSignal:signal,httpOptions:{timeout:geminiTimeoutMs},maxOutputTokens:geminiMaxOutputTokens} });
      const durationMs = Math.round(performance.now() - started);
      let text = '';
      try {
        text = response.text || '';
      } catch (error) {
        log('error', 'provider.text_error', {
          provider: 'gemini',
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          finishReason: (response as any).candidates?.[0]?.finishReason,
          candidates: (response as any).candidates?.length,
        });
        throw invalid();
      }
      log('debug', 'provider.response', {
        provider: 'gemini',
        durationMs,
        model: image ? visionModel : model,
        finishReason: (response as any).candidates?.[0]?.finishReason,
        candidates: (response as any).candidates?.length,
        blockReason: (response as any).promptFeedback?.blockReason,
        textLen: text.length,
        usage: (response as any).usageMetadata,
      });
      try { return JSON.parse(text); } catch (error) {
        log('error', 'provider.json_error', {
          provider: 'gemini',
          finishReason: (response as any).candidates?.[0]?.finishReason,
          error: error instanceof Error ? error.message : String(error),
        });
        logModelText('provider.raw', text);
        throw invalid();
      }
    };
  }
  log('info', 'provider.ready', {
    provider,
    model,
    visionModel: visionModel || null,
    configured: Boolean(key?.trim()),
  });
  return {provider:provider as AiProvider,model,configured:Boolean(key?.trim()),generate};
}