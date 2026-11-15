"""Preserve and validate a supplied frozen-configuration chat export without assigning labels."""
from pathlib import Path
from datetime import datetime
from collections import Counter
import json,hashlib,sys,re
src=Path(sys.argv[1]);raw=src.read_bytes();d=json.loads(raw);base=Path('recordings/final-evaluation')
mb=(base/'configuration.json').read_bytes();manifest=json.loads(mb);config=hashlib.sha256(mb).hexdigest()
ms=d['messages'];users=[x for x in ms if x['role']=='user'];replies=[x for x in ms if x['role']=='assistant']
assert len(users)==len(replies)>0,'Export has incomplete exchanges'
assert [x['role'] for x in ms]==['user','assistant']*len(users),'Expected alternating complete exchanges'
ids={x['evaluation']['recordingId'] for x in replies};assert len(ids)==1
log=base/'sessions'/f'{next(iter(ids))}.jsonl';lograw=log.read_bytes();events=[json.loads(x) for x in lograw.decode('utf8').splitlines()]
requests=[x for x in events if x['event']=='request'];responses=[x for x in events if x['event']=='response']
assert len(requests)>=len(users) and len(responses)>=len(replies),'Missing recorded events'
all_requests=requests;all_responses=responses
contents=[x['content'] for x in users]
starts=[i for i in range(len(requests)-len(users)+1) if [x['message'] for x in requests[i:i+len(users)]]==contents]
assert len(starts)==1,'Export does not identify one unambiguous contiguous log segment'
start=starts[0];requests=requests[start:start+len(users)];responses=responses[start:start+len(replies)]
assert d.get('consentConfirmed') is True and all(x.get('consentConfirmed') is True for x in requests)
assert all(x['configurationHash']==config for x in requests+responses)
assert all(x['evaluation']['configurationHash']==config for x in replies)
assert [x['message'] for x in requests]==[x['content'] for x in users]
export_transcript=[{'role':x['role'],'content':x['content']} for x in ms]
assert export_transcript==responses[-1]['transcript'][-len(ms):],'Export differs from server transcript segment'
assert all(datetime.fromisoformat(x['recordedAt'].replace('Z','+00:00'))>datetime.fromisoformat(manifest['frozen_at_utc']) for x in requests+responses)
code=d['participantCode'];assert code and all(c.isalnum() or c in '_-' for c in code)
assert all(x['participant']==code for x in requests+responses)
analysis_code=('P'+str(int(code[1:])).zfill(2)) if re.fullmatch(r'[pP]\d+',code) else code.upper()
sha=hashlib.sha256(raw).hexdigest();out=base/'received'/analysis_code;out.mkdir(parents=True,exist_ok=True)
original=out/'original-export.json'
if original.exists() and original.read_bytes()!=raw:
 old=json.loads(original.read_text(encoding='utf8'))
 assert old['conversationId']==d['conversationId'],'New conversation for same participant needs a distinct session folder'
 dest=out/('export-'+sha[:12]+'.json')
else:dest=original
if not dest.exists():dest.write_bytes(raw)
snapshot=out/('server-log-'+sha[:12]+'.jsonl')
if not snapshot.exists():snapshot.write_bytes(lograw)
(out/('server-transcript-'+sha[:12]+'.json')).write_text(json.dumps(responses[-1]['transcript'],ensure_ascii=False,indent=2),encoding='utf8')
trace=Counter(x['evaluation']['classifierTrace']['status'] for x in replies)
audit={'analysis_code':analysis_code,'participant_code_as_exported':code,'conversation_id':d['conversationId'],'source_sha256':sha,'preserved_export':str(dest),'server_log_sha256':hashlib.sha256(lograw).hexdigest(),'configuration_sha256':config,'consent_flag':True,'collected_after_freeze':True,'server_transcript_matches_export':True,'user_turns':len(users),'assistant_replies':len(replies),'minimum_three_exchanges_met':len(users)>=3,'classifier_paths':dict(trace),'reviewer_status':dict(Counter(x.get('evaluation',{}).get('reviewerTrace',{}).get('status','not_called') for x in replies)),'language_setting':d.get('language'),'independent_human_labels':'pending','authorship_provenance':'Distinct user per standing author statement; independent wording and absence of development role need confirmation','evaluation_status':'Validated post-freeze operational capture; safety outcomes await independent annotation. Turns within a conversation are not independent samples.'}
(out/('audit-'+sha[:12]+'.json')).write_text(json.dumps(audit,indent=2),encoding='utf8');(out/'audit.json').write_text(json.dumps(audit,indent=2),encoding='utf8')
audit.update({'export_starts_at_recorded_user_turn':start+1,'server_context_user_turns_at_export':sum(x['role']=='user' for x in responses[-1]['transcript']),'export_is_complete_server_history':start==0,'same_conversation_not_new_participant':original.exists() and dest!=original})
(out/('audit-'+sha[:12]+'.json')).write_text(json.dumps(audit,indent=2),encoding='utf8');(out/'audit.json').write_text(json.dumps(audit,indent=2),encoding='utf8')
print(json.dumps(audit,indent=2))
