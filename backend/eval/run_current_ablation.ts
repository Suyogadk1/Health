import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MultiAIProvider } from '../src/lib/ai/multiProvider';
import { MindfulProvider } from '../src/lib/ai/mindfulProvider';
import { NemotronUltraProvider } from '../src/lib/ai/nemotronProvider';
import { emotionAgent } from '../src/lib/pipeline/agents/emotionAgent';
import { responseComposerAgent } from '../src/lib/pipeline/agents/responseComposerAgent';
import { HIGH_RISK_RESPONSE } from '../src/lib/safety/safetyResponse';
import { boundedCall, failureCategory } from '../src/lib/ai/boundedCall';
import type { ChatMessage } from '../src/lib/ai/provider';

async function main(){
 const [input,output,manifestFile]=process.argv.slice(2);
 if(!input||!output||!manifestFile)throw new Error('Usage: tsx eval/run_current_ablation.ts cases.jsonl results.jsonl manifest.json');
 if(!process.env.NVIDIA_API_KEY)throw new Error('Live classifier/reviewer must be configured');
 const manifestBytes=fs.readFileSync(manifestFile);const manifest=JSON.parse(manifestBytes.toString('utf8'));const root=path.resolve(process.cwd(),'..');
 for(const [file,sha] of Object.entries(manifest.source_sha256))if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==sha)throw new Error('Frozen source mismatch: '+file);
 for(const [key,value] of Object.entries(manifest.environment_settings))if((process.env[key]??null)!==value)throw new Error('Frozen setting mismatch: '+key);
 const cases=fs.readFileSync(input,'utf8').split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l));const ids=new Set<string>();
 for(const c of cases){if(!c.id||ids.has(c.id)||!c.message||!Array.isArray(c.history))throw new Error('Invalid case set');ids.add(c.id);}
 const ai=new MultiAIProvider(), reviewer=new NemotronUltraProvider(),local=new MindfulProvider();
 const tiers=[...ai.getEvaluationProviders().map(e=>({id:e.id,provider:e.provider,model:e.model})),{id:'offline',provider:local,model:'offline-mindful-engine'}];
 const fd=fs.openSync(output,'wx');let completed=0,failed=0;
 try{
  for(const c of cases){
   const screenStart=performance.now();const screen=await emotionAgent({message:c.message,classifier:reviewer,previousUserMessages:c.history.filter((m:ChatMessage)=>m.role==='user').map((m:ChatMessage)=>m.content)});const screenMs=performance.now()-screenStart;
   for(const tier of tiers){
    const started=performance.now();let generationMs:number|undefined;
    try{
     const composed=await responseComposerAgent({userMessage:c.message,riskLevel:screen.risk.level==='high'?'none':screen.risk.level,riskSignals:screen.risk.matchedSignals,chatHistory:[...c.history,{role:'user',content:c.message}],checkinContextText:'',crossChatContextText:'',graphContextText:'',emotionLabel:screen.emotionLabel,reviewer,
      generate:async(messages,system)=>{const t=performance.now();const reply=await boundedCall(tier.provider,messages,system+`\nRespond in ${c.response_language}, in its native script.`,45000);generationMs=performance.now()-t;return {reply,provider:tier.provider.name,model:tier.model,attempts:[tier.id]};}});
     const reviewerOnly=composed.reviewDecision!.finalReply,screenBlocked=screen.risk.level==='high';
     const row={case_id:c.id,source_export_sha256:c.source_export_sha256,study_scope:'exploratory replay of previously collected pilot scenarios; not an independent post-freeze test',configuration_sha256:crypto.createHash('sha256').update(manifestBytes).digest('hex'),language_setting:c.language,history:c.history,message:c.message,tier:tier.id,provider:tier.provider.name,model:tier.model,screen,screenMs,generationMs,reviewerTrace:composed.reviewerTrace,screenBlocked,reviewerBlocked:composed.reviewDecision!.overridden,outputGuardBlocked:composed.isDangerous,draft:composed.draftReply,branches:{no_safety:composed.draftReply,screen_only:screenBlocked?HIGH_RISK_RESPONSE:composed.draftReply,reviewer_only:reviewerOnly,both:screenBlocked?HIGH_RISK_RESPONSE:reviewerOnly},production_final:screenBlocked?HIGH_RISK_RESPONSE:composed.reply,counterfactual:screenBlocked,counterfactual_note:screenBlocked?'Generation/review would be skipped in production; draft collected in separate screen-disabled branch.':'Matched draft passed to each gate configuration.',timing_note:'screenMs is measured once and reused across matched branches; branch timing is component accounting, not four independently executed end-to-end requests',screen_review_generation_ms:screenMs+performance.now()-started,capturedAt:new Date().toISOString()};
     fs.writeSync(fd,JSON.stringify(row)+'\n');fs.fsyncSync(fd);completed++;
    }catch(error){fs.writeSync(fd,JSON.stringify({case_id:c.id,tier:tier.id,status:'generation_or_capture_failed',errorCategory:failureCategory(error),elapsedMs:performance.now()-started,capturedAt:new Date().toISOString()})+'\n');fs.fsyncSync(fd);failed++;}
    console.log(JSON.stringify({case_id:c.id,tier:tier.id,completed,failed}));
   }
  }
 }finally{fs.closeSync(fd);}
 console.log(JSON.stringify({cases:cases.length,configured_tiers:tiers.map(t=>t.id),completed,failed,independent_output_ratings:'pending'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
