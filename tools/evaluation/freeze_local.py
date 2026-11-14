"""Create a new credential-free source snapshot for the opt-in local recorder.

Run from the repository root. Never replaces an existing configuration manifest.
The historical eval/freeze_camera_ready.py format belongs to its own capture tool.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
import shutil
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', default='recordings/local-evaluation')
args = parser.parse_args()
root = Path.cwd()
if not (root / 'backend/src').is_dir() or not (root / 'frontend/src').is_dir():
    raise SystemExit('Run this command from the repository root.')
destination = Path(args.output).resolve()
manifest_path = destination / 'configuration.json'
if manifest_path.exists():
    raise SystemExit('Existing freeze preserved. Choose a new output directory for a new configuration.')

# Parse settings as data, never execute the dotenv file. Process variables take
# precedence, matching dotenv/config's normal behavior in the backend.
settings = {}
env_path = root / 'backend/.env'
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        settings[key.strip()] = value
settings.update(os.environ)
keys = ['HYBRID_RISK_CLASSIFIER', 'NEMOTRON_ULTRA_MODEL', 'NEMOTRON_MODEL',
        'GEMINI_MODEL', 'GEMINI_MODEL_1', 'GEMINI_MODEL_2', 'GROK_MODEL', 'AI_STRATEGY']
files = sorted(set([
    *Path('backend/src').rglob('*.ts'), *Path('frontend/src').rglob('*.ts'),
    *Path('frontend/src').rglob('*.tsx'), *Path('backend/eval').glob('*.ts'),
    *Path('backend/eval').glob('*.py'), Path('backend/package-lock.json'),
    Path('frontend/package-lock.json'), Path('frontend/next.config.js'), Path('netlify.toml')]))
manifest = {
    'frozen_at_utc': datetime.now(timezone.utc).isoformat(),
    'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'source_sha256': {p.as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
    'environment_settings': {key: settings.get(key) for key in keys},
    'classifier_timeout_ms': 30000, 'reviewer_timeout_ms': 12000,
    'generation_call_timeout_ms': 45000, 'sampling_temperature': 0.7,
    'scope': 'New local configuration snapshot; no independent evaluation or human labels implied.',
    'caveat': 'Model identifiers do not pin provider-side weights. Credential changes require a new recorded version.'}
destination.mkdir(parents=True, exist_ok=True)
for source in files:
    target = destination / 'source' / source
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
with manifest_path.open('x', encoding='utf8') as stream:
    json.dump(manifest, stream, indent=2)
digest = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
(destination / 'configuration.sha256').write_text(digest + '\n', encoding='utf8')
print(json.dumps({'manifest': str(manifest_path), 'sha256': digest, 'source_files': len(files)}))
