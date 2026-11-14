import 'dotenv/config';
import { NemotronUltraProvider } from '../src/lib/ai/nemotronProvider';
import { assessRiskHybrid } from '../src/lib/safety/riskAssessment';
const provider=new NemotronUltraProvider();
async function main(){
 for(const timeout of [4000,30000]){
  let callMs:number|undefined, validJSON:boolean|undefined, errorType:string|undefined;
  const wrapper={name:provider.name,generate:async(m:any,s:string)=>{const t=performance.now();try{const raw=await provider.generate(m,s);callMs=Math.round(performance.now()-t);try{JSON.parse(raw.replace(/```json|```/g,'').trim());validJSON=true;}catch{validJSON=false;}return raw;}catch(e:any){callMs=Math.round(performance.now()-t);errorType=e?.name;throw e;}}};
  const t=performance.now();const result=await assessRiskHybrid('Hello, I would like a short friendly greeting.',wrapper,timeout);
  console.log(JSON.stringify({calibration_only:true,timeoutMs:timeout,source:result.source,totalMs:Math.round(performance.now()-t),providerCallMs:callMs,validJSON,errorType}));
 }
}
main().catch(()=>{console.error('Calibration failed; no secrets logged');process.exitCode=1;});
