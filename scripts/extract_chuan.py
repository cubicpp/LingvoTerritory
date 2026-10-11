from huggingface_hub import hf_hub_download
import json
from pathlib import Path

path = hf_hub_download(repo_id='ASLP-lab/WSC-Train', filename='wsc_metadata.jsonl', repo_type='dataset')
print('Downloaded:', path)

with open(path, encoding='utf-8') as f:
    lines = f.readlines()
print(f'Total lines: {len(lines)}')

for i, line in enumerate(lines[:5]):
    obj = json.loads(line)
    t = obj.get('text', '')[:150]
    print(f'  [{i}] {t}')

all_text = ''
for line in lines:
    try:
        obj = json.loads(line)
        all_text += obj.get('text', '') + '\n'
    except:
        pass
print(f'Total chars: {len(all_text)}')

freq = {}
for ch in all_text:
    code = ord(ch)
    if (0x4E00 <= code <= 0x9FFF) or (0x3400 <= code <= 0x4DBF):
        freq[ch] = freq.get(ch, 0) + 1

sorted_items = sorted(freq.items(), key=lambda x: -x[1])
print(f'Unique CJK: {len(sorted_items)}')
for ch, n in sorted_items[:20]:
    print(f'  {ch} {n}')

output = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'chuan_freq.tsv'
with output.open('w', encoding='utf-8') as f:
    for ch, n in sorted_items:
        f.write(f'{ch}\t{n}\n')
print(f'Saved {output}')
