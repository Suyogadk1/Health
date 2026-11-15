import assert from 'node:assert/strict';
import { assessRiskHybrid } from '../src/lib/safety/riskAssessment';
import { reviewAndFinalize } from '../src/lib/safety/safetyOrchestrator';
import type { AIProvider } from '../src/lib/ai/provider';
async function main(){
 const ok:AIProvider={name:'test',generate:async()=>JSON.stringify({level:'none'})};
 const unchanged=await assessRiskHybrid('Hello there',ok,100);assert.equal(unchanged.source,'regex');assert.equal(unchanged.classifierTrace.status,'success');
 const bad=await assessRiskHybrid('Hello there',{name:'bad',generate:async()=>'{broken'},100);assert.equal(bad.classifierTrace.status,'fallback');assert.equal(bad.classifierTrace.errorCategory,'invalid_json');
 let aborted=false;
 const slow:AIProvider={name:'slow',generate:(_m,_s,options)=>new Promise((_resolve,reject)=>{options?.signal?.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));});})};
 const timeout=await assessRiskHybrid('Hello there',slow,10);assert.equal(timeout.classifierTrace.errorCategory,'timeout');assert.equal(aborted,true);
 const bypass=await assessRiskHybrid('I want to die',ok,100);assert.equal(bypass.classifierTrace.status,'not_called');assert.equal(bypass.classifierTrace.bypassReason,'rules_high');
 const review=await reviewAndFinalize('Hello there','A friendly greeting',{reviewerProvider:{name:'invalid',generate:async()=>'{"level":"unrecognized"}'},timeoutMs:100});assert.equal(review.agentBLevel,'moderate');assert.equal(review.reviewerTrace?.status,'invalid_response');assert.equal(review.overridden,true);
 const failed=await reviewAndFinalize('Hello there','A friendly greeting',{reviewerProvider:{name:'down',generate:async()=>{throw new Error('down');}},timeoutMs:100});assert.equal(failed.reviewerTrace?.status,'fallback');
 console.log('PASS classifier success, bypass, invalid JSON, cancellation, reviewer invalid-level and fallback traces');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
