"""Freeze source and non-secret process settings before independent data collection.
Run from backend with the same explicit environment used for capture.
"""
import hashlib,json,os,subprocess
from pathlib import Path
files=sorted([*Path('src').rglob('*.ts'),Path('package-lock.json'),Path('eval/capture_camera_ready.ts')])
settings=['HYBRID_RISK_CLASSIFIER','NEMOTRON_ULTRA_MODEL','NEMOTRON_MODEL','GEMINI_MODEL','GEMINI_MODEL_1','GEMINI_MODEL_2','GROK_MODEL','AI_STRATEGY']
if os.environ.get('HYBRID_RISK_CLASSIFIER') != 'true':
 raise SystemExit('Set HYBRID_RISK_CLASSIFIER=true before freezing. Select and record all intended model settings first.')
manifest={'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
 'files':{str(p).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
 'environment':{k:os.environ.get(k) for k in settings},
 'note':'Hashes pin source bytes, including defaults, prompts, timeouts and sampling. Provider-side weights may change. No evaluation is implied.'}
with Path('eval/camera_ready_freeze.json').open('x',encoding='utf8') as f: json.dump(manifest,f,indent=2)
print('Freeze saved. Do not tune after independent data collection starts.')
