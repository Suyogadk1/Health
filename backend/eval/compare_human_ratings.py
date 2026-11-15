"""Compare two completed human rating files; never supplies or adjudicates labels."""
import json,sys
from pathlib import Path
from collections import Counter

def agreement(a,b):
 n=len(a)
 if not n: return {'n':0,'agreement':None,'kappa':None}
 ca,cb=Counter(a),Counter(b); po=sum(x==y for x,y in zip(a,b))/n
 pe=sum(ca[k]*cb[k] for k in ca.keys()|cb.keys())/(n*n)
 return {'n':n,'agreement':po,'kappa':None if pe==1 else (po-pe)/(1-pe),'expected_agreement':pe}

def main():
 a,b=[json.loads(Path(p).read_text(encoding='utf8')) for p in sys.argv[1:3]]
 if a.get('status')!='complete' or b.get('status')!='complete':raise ValueError('Both files must be completed ratings')
 if a['rater']==b['rater']:raise ValueError('Rater identities must differ')
 aa={r['case_id']:r for r in a['labels']}; bb={r['case_id']:r for r in b['labels']}
 if len(aa)!=len(a['labels']) or len(bb)!=len(b['labels']) or aa.keys()!=bb.keys():raise ValueError('Duplicate or unmatched case IDs')
 for k in aa:
  if aa[k]['export_sha256']!=bb[k]['export_sha256']:raise ValueError('Different source exports')
 dimensions={'risk':{'none','moderate','high','uncertain'},'disclosure':{'explicit','implicit','not_applicable','uncertain'},'subject':{'self','other_person','not_applicable','uncertain'},'language':{'English','Hindi','Hinglish','Nepali','Tamil','Telugu','other_mixed','uncertain'},'final_reply_safety':{'safe','unsafe','uncertain','not_applicable'}}
 result={'raters':[a['rater'],b['rater']],'interpretation':'Pre-adjudication agreement only. Uncertain labels require adjudication. Turns are clustered within conversations; no population uncertainty estimate is implied.','dimensions':{},'disagreements':[]}
 for field,allowed in dimensions.items():
  for k in aa:
   if aa[k].get(field) not in allowed or bb[k].get(field) not in allowed:raise ValueError('Missing/invalid '+field+' label')
  ids=[k for k in aa if not (field=='final_reply_safety' and aa[k][field]==bb[k][field]=='not_applicable')]
  result['dimensions'][field]=agreement([aa[k][field] for k in ids],[bb[k][field] for k in ids])
 for k in aa:
  diffs={f:{'rater_a':aa[k][f],'rater_b':bb[k][f]} for f in dimensions if aa[k][f]!=bb[k][f]}
  if diffs:result['disagreements'].append({'case_id':k,'differences':diffs,'adjudicated_labels':None,'adjudicator':None,'rationale':None})
 print(json.dumps(result,indent=2,allow_nan=False))
if __name__=='__main__':main()
