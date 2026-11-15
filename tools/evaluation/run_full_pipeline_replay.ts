import '../../backend/node_modules/dotenv/config.js';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import { runChatPipeline } from '../../backend/src/lib/pipeline/orchestrator';
import { memoryStoreAdapter } from '../../backend/src/lib/pipeline/memoryStoreAdapter';
import { MultiAIProvider } from '../../backend/src/lib/ai/multiProvider';
import { NemotronUltraProvider } from '../../backend/src/lib/ai/nemotronProvider';
import { failureCategory } from '../../backend/src/lib/ai/boundedCall';
async function main(){
 const root=path.resolve(process.cwd(),'..');const folder=path.join(root,'recordings/final-evaluation');
 const bytes=fs.readFileSync(path.join(folder,'configuration.json'));const manifest=JSON.parse(bytes.toString('utf8'));const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 for(const [file,sha] of Object.entries(manifest.source_sha256))if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==sha)throw new Error('Frozen source changed');
 for(const [key,value] of Object.entries(manifest.environment_settings))if((process.env[key]??null)!==value)throw new Error('Frozen environment changed');
 const cases=fs.readFileSync(path.join(folder,'replay-cases.jsonl'),'utf8').split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l));
 const llm=new NemotronUltraProvider();const ai=new MultiAIProvider();const fd=fs.openSync(path.join(folder,'full-pipeline-results.jsonl'),'wx');
 console.warn=()=>{}; // Upstream bodies are not study output; categorized traces are retained.
 try{for(const c of cases){for(const scenario of ['nominal','injected_classifier_failure']){
  const id=crypto.randomUUID();memoryStoreAdapter.ensureConversation(id,id,'Exploratory replay');
  for(const m of c.history)memoryStoreAdapter.addMessage(id,id,m.role,m.content);
  const started=performance.now();
  try{
   const result=await runChatPipeline({store:memoryStoreAdapter,generate:(m,s)=>ai.generateWithDetails(m,s+`\nRespond in ${c.response_language}, in its native script.`),classifier:scenario==='nominal'?llm:{name:'Explicit classifier outage injection',generate:async()=>{throw new Error('injected_classifier_failure');}},reviewer:llm},{user:{id},rawConversationId:id,rawMessage:c.message});
   fs.writeSync(fd,JSON.stringify({case_id:c.id,scenario,study_scope:'Exploratory replay of existing pilot inputs, not new independent validation',configuration_sha256:hash,source_export_sha256:c.source_export_sha256,history:c.history,message:c.message,language_setting:c.language,final_latency_ms:performance.now()-started,result,recorded_at:new Date().toISOString()})+'\n');fs.fsyncSync(fd);
   console.log(JSON.stringify({case_id:c.id,scenario,classifierStatus:result.classifierTrace?.status,provider:result.provider}));
  }catch(e){fs.writeSync(fd,JSON.stringify({case_id:c.id,scenario,status:'failed',errorCategory:failureCategory(e),final_latency_ms:performance.now()-started})+'\n');fs.fsyncSync(fd);console.log(JSON.stringify({case_id:c.id,scenario,status:'failed'}));}
 }}}finally{fs.closeSync(fd);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

