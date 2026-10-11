"""
preprocess_v3.py — Process MCPDict data files into clean JSON outputs

Input  (data_raw/mcpdict/):
  1. 異體字.tsv        → variant_map.json
  2. 說文.tsv           → shuowen.json
  3. 集韻.md            → jy_phonology.json
  4. kangxizidian-v3f.txt → kangxi.json
  5. 部件檢索.htm       → component_map.json
  6. 中原音韻.tsv       → zymy_phonology.json
  7. 漢大.tsv           → handa.json
  8. 匯纂.tsv           → huizuan.json
  9. 方言調查字表.tsv   → survey_table.json
 10. IDS.txt            → ids_component.json

Output (public/data/): all compact JSON files
"""

import json
import re
import os
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
RAW_MCP = BASE_DIR / "data_raw" / "mcpdict"
PUBLIC_DATA = BASE_DIR / "public" / "data"

# ─── Helpers ───

def is_cjk_char(ch):
    """Check if a character is in the CJK Unified Ideographs range."""
    cp = ord(ch)
    return (0x4E00 <= cp <= 0x9FFF or
            0x3400 <= cp <= 0x4DBF or
            0x20000 <= cp <= 0x2A6DF or
            0x2A700 <= cp <= 0x2B73F or
            0x2B740 <= cp <= 0x2B81F or
            0x2B820 <= cp <= 0x2CEAF or
            0x2CEB0 <= cp <= 0x2EBEF or
            0x30000 <= cp <= 0x3134F)

def compact_json(data):
    """Return compact JSON string without unnecessary whitespace."""
    return json.dumps(data, ensure_ascii=False, separators=(',', ':'))


# ─── 1. 異體字.tsv → variant_map.json ───

def parse_yitizi(path):
    """Parse 異體字.tsv: char → list of variant characters."""
    print("[1/6] Parsing 異體字.tsv → variant_map.json ...")
    variant_map = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) >= 2 and parts[0] and parts[1]:
                variant_map[parts[0]] = parts[1].strip().split()
    print(f"  {len(variant_map):,} entries")
    return variant_map


# ─── 2. 說文.tsv → shuowen.json ───

def parse_shuowen(path):
    """Parse 說文.tsv: char → {fanqie, reading, def}."""
    print("[2/6] Parsing 說文.tsv → shuowen.json ...")
    shuowen = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) < 3:
                continue
            char = parts[0].strip()
            if not char or len(char) > 2:
                continue
            # Second field: "fanqie reading"
            fq_reading = parts[1].strip().split(' ', 1)
            fanqie = fq_reading[0] if fq_reading else ''
            reading = fq_reading[1] if len(fq_reading) > 1 else ''
            definition = '\t'.join(parts[2:]).strip()
            shuowen[char] = {
                'fanqie': fanqie,
                'reading': reading,
                'def': definition,
            }
    print(f"  {len(shuowen):,} entries")
    return shuowen


# ─── 3. 集韻.md → jy_phonology.json ───

# Fanqie upper-character → 41 initial classes
FANQIE_TO_INITIAL = {
    # 幫母(唇)
    "博":"幫","北":"幫","布":"幫","補":"幫","邊":"幫",
    "伯":"幫","百":"幫","巴":"幫","卑":"幫","并":"幫",
    "必":"幫","彼":"幫","兵":"幫","筆":"幫","陂":"幫","畀":"幫",
    "逋":"幫","悲":"幫","哺":"幫","表":"幫","班":"幫","邦":"幫","拜":"幫","晡":"幫",
    # 滂母(唇)
    "普":"滂","匹":"滂","滂":"滂","譬":"滂",
    "鋪":"滂","篇":"滂","潘":"滂","噴":"滂","紕":"滂",
    # 並母(唇)
    "蒲":"並","薄":"並","傍":"並","步":"並","部":"並",
    "白":"並","捕":"並","裴":"並",
    "皮":"並","毗":"並","平":"並","婢":"並","簿":"並","歩":"並","被":"並","備":"並","旁":"並",
    # 明母(唇)
    "莫":"明","慕":"明","模":"明","謨":"明","摸":"明","母":"明",
    "忙":"明","弥":"明","民":"明","眠":"明","馬":"明","美":"明","明":"明",
    # 非母(唇)
    "方":"非","甫":"非","府":"非","分":"非","封":"非","鄙":"非","逼":"非",
    # 敷母(唇)
    "芳":"敷","孚":"敷","披":"敷","丕":"敷","妃":"敷","峯":"敷","拂":"敷",
    "敷":"敷","撫":"敷","肺":"敷","芬":"敷","費":"敷",
    # 奉母(唇)
    "房":"奉","防":"奉","符":"奉","附":"奉","扶":"奉","浮":"奉","父":"奉","縛":"奉","馮":"奉",
    # 微母(唇)
    "武":"微","無":"微","文":"微","亡":"微","彌":"微","眉":"微","巫":"微",
    # 端母(舌)
    "都":"端","丁":"端","多":"端","當":"端","得":"端","德":"端","冬":"端",
    "覩":"端","鳥":"端","對":"端","斗":"端","等":"端","典":"端",
    # 透母(舌)
    "他":"透","吐":"透","土":"透","託":"透","湯":"透","天":"透","通":"透","台":"透",
    "討":"透","退":"透",
    # 定母(舌)
    "徒":"定","杜":"定","特":"定","度":"定","唐":"定","陀":"定","堂":"定","田":"定","地":"定",
    "待":"定","大":"定","同":"定","動":"定","盜":"定","弟":"定","蕩":"定","亭":"定","蕩":"定",
    # 泥母(舌)
    "奴":"泥","乃":"泥","内":"泥","那":"泥","諾":"泥","泥":"泥",
    "年":"泥","寧":"泥","腦":"泥","南":"泥","囊":"泥",
    # 知母(舌)
    "陟":"知","竹":"知","知":"知","張":"知","中":"知","猪":"知","徵":"知","追":"知","卓":"知",
    "展":"知","株":"知","轉":"知","珍":"知","智":"知",
    # 徹母(舌)
    "丑":"徹","敕":"徹","耻":"徹","抽":"徹","褚":"徹",
    "勑":"徹","癡":"徹","恥":"徹","椿":"徹","寵":"徹","蓄":"徹",
    # 澄母(舌)
    "直":"澄","除":"澄","丈":"澄","宅":"澄","持":"澄","柱":"澄","池":"澄","治":"澄",
    "重":"澄","陳":"澄","長":"澄","召":"澄","傳":"澄","澄":"澄","馳":"澄","仲":"澄",
    # 娘母(舌)
    "女":"娘","尼":"娘","拏":"娘",
    "昵":"娘","濃":"娘","匿":"娘","你":"娘",
    # 見母(牙)
    "古":"見","公":"見","過":"見","各":"見","格":"見","兼":"見",
    "姑":"見","佳":"見","詭":"見","居":"見","九":"見",
    "俱":"見","舉":"見","吉":"見","紀":"見","几":"見",
    "堅":"見","訖":"見","沽":"見","規":"見","乖":"見","告":"見","拘":"見","頸":"見",
    # 溪母(牙)
    "苦":"溪","口":"溪","康":"溪","枯":"溪","空":"溪","恪":"溪",
    "牽":"溪","謙":"溪","楷":"溪","客":"溪","可":"溪",
    "去":"溪","丘":"溪","區":"溪","墟":"溪","起":"溪","綺":"溪",
    "羌":"溪","欽":"溪","傾":"溪","窺":"溪","詰":"溪","祛":"溪","豈":"溪","曲":"溪",
    "乞":"溪","邱":"溪","克":"溪","犬":"溪","輕":"溪","肯":"溪","闊":"溪","孔":"溪","困":"溪","欺":"溪","遣":"溪",
    # 羣母(牙)
    "渠":"羣","其":"羣","巨":"羣","求":"羣","奇":"羣","暨":"羣","臼":"羣","衢":"羣","强":"羣","具":"羣",
    "極":"羣","狂":"羣","技":"羣","祁":"羣",
    # 疑母(牙)
    "五":"疑","吾":"疑","研":"疑","俄":"疑","牛":"疑","宜":"疑","魚":"疑","危":"疑",
    "語":"疑","倪":"疑","逆":"疑","虞":"疑","仰":"疑","玉":"疑","遇":"疑","牙":"疑","仡":"疑","元":"疑",
    # 影母(喉)
    "於":"影","乙":"影","伊":"影","一":"影","衣":"影","憂":"影","依":"影","憶":"影","謁":"影","委":"影",
    "烏":"影","鄔":"影","倚":"影","紆":"影","隱":"影","縈":"影","斡":"影","鬱":"影","汪":"影","哀":"影",
    # 曉母(喉)
    "呼":"曉","火":"曉","荒":"曉","虎":"曉","海":"曉","呵":"曉","馨":"曉","朽":"曉","休":"曉","況":"曉","許":"曉","興":"曉","喜":"曉","虛":"曉",
    "虚":"曉","香":"曉","吁":"曉","翾":"曉","黒":"曉","忽":"曉","黑":"曉","希":"曉","迄":"曉","亨":"曉","詡":"曉",
    # 匣母(喉)
    "胡":"匣","户":"匣","下":"匣","侯":"匣","何":"匣","黄":"匣","乎":"匣","護":"匣","懷":"匣",
    "轄":"匣","亥":"匣","限":"匣","幸":"匣","賀":"匣","合":"匣","後":"匣",
    # 喻母(喉)
    "以":"喻","羊":"喻","余":"喻","餘":"喻","與":"喻","弋":"喻","夷":"喻","予":"喻","營":"喻","移":"喻",
    "于":"喻","羽":"喻","俞":"喻","王":"喻","云":"喻","雲":"喻","永":"喻","雨":"喻","延":"喻","尤":"喻",
    # 精母(齿)
    "子":"精","即":"精","將":"精","資":"精","姊":"精","遵":"精","兹":"精","借":"精","醉":"精","作":"精","則":"精","祖":"精","臧":"精",
    "咨":"精","佐":"精","井":"精","最":"精","再":"精","津":"精","宗":"精","租":"精",
    # 清母(齿)
    "七":"清","倉":"清","千":"清","此":"清","親":"清","采":"清","蒼":"清","麤":"清","醋":"清","青":"清",
    "取":"清","粗":"清","村":"清","措":"清","草":"清","逡":"清",
    # 從母(齿)
    "才":"從","徂":"從","在":"從","前":"從","藏":"從","昨":"從","酢":"從","疾":"從","慈":"從","秦":"從","自":"從",
    "財":"從","淨":"從","匠":"從","漸":"從","字":"從","牆":"從","從":"從",
    # 心母(齿)
    "蘇":"心","息":"心","先":"心","相":"心","私":"心","思":"心","桑":"心","素":"心","斯":"心","速":"心","雖":"心","悉":"心","寫":"心","胥":"心","須":"心",
    "四":"心","想":"心","辛":"心","雪":"心","小":"心","星":"心","選":"心","宣":"心","新":"心","損":"心","仙":"心",
    # 邪母(齿)
    "徐":"邪","似":"邪","祥":"邪","辝":"邪","辭":"邪","隨":"邪","旬":"邪","寺":"邪","夕":"邪",
    "邪":"邪","頌":"邪","象":"邪","席":"邪","習":"邪",
    # 幫母 additions
    "弼":"並",
    # 影母 additions
    "阿":"影",
    # 滂母 additions
    "叵":"滂",
    # 初母 additions
    "叉":"初",
    # 日母 additions
    "爾":"日",
    # 疑母 additions
    "鄂":"疑",
    # 定母 additions
    "逹":"定",
    # 莊母(齿)
    "側":"莊","莊":"莊","阻":"莊","鄒":"莊",
    "壯":"莊","爭":"莊","仄":"莊",
    # 初母(齿)
    "初":"初","楚":"初","測":"初","創":"初",
    "芻":"初","插":"初","察":"初",
    # 崇母(齿)
    "士":"崇","仕":"崇","鋤":"崇","豺":"崇","查":"崇",
    "鉏":"崇","事":"崇","助":"崇","崇":"崇",
    # 俟母(齿) — 反切上字"牀"在之韵三等为俟母
    "俟":"俟","牀":"俟",
    # 生母(齿)
    "所":"生","山":"生","疏":"生","沙":"生","數":"生","生":"生","色":"生","史":"生",
    "師":"生","殺":"生","朔":"生","爽":"生","霜":"生","雙":"生",
    # 章母(齿)
    "之":"章","職":"章","章":"章","諸":"章","旨":"章","止":"章","脂":"章","征":"章","正":"章","占":"章","支":"章","煮":"章",
    "朱":"章","主":"章","質":"章","照":"章","針":"章",
    # 昌母(齿)
    "昌":"昌","尺":"昌","赤":"昌","充":"昌","處":"昌","叱":"昌","春":"昌","齒":"昌",
    "稱":"昌","出":"昌","臭":"昌","觸":"昌","樞":"昌",
    # 船母(齿)
    "食":"船","神":"船","實":"船","乗":"船","示":"船",
    # 書母(齿)
    "式":"書","書":"書","失":"書","舒":"書","施":"書","傷":"書","識":"書","賞":"書","詩":"書","始":"書","試":"書","矢":"書","釋":"書","商":"書",
    "尸":"書","輸":"書","手":"書","少":"書","世":"書","聖":"書","升":"書",
    # 禪母(齿)
    "市":"禪","時":"禪","是":"禪","常":"禪","承":"禪","視":"禪","署":"禪","殊":"禪","氏":"禪","寔":"禪","臣":"禪","殖":"禪","成":"禪",
    "上":"禪","十":"禪","善":"禪","石":"禪","熟":"禪",
    # 來母(舌)
    "盧":"來","郎":"來","魯":"來","落":"來","洛":"來","勒":"來","力":"來","林":"來","呂":"來","良":"來","離":"來","里":"來",
    "龍":"來","兩":"來","冷":"來","六":"來","禮":"來","連":"來","閭":"來","倫":"來","令":"來",
    # 日母(齿)
    "而":"日","如":"日","人":"日","汝":"日","仍":"日","兒":"日","耳":"日","儒":"日",
    "乳":"日","忍":"日","讓":"日","日":"日","入":"日",
}

# Rhyme → 16 摄 (she)
RHYME_TO_SHE = {
    "東":"通","冬":"通","鍾":"通",
    "江":"江",
    "支":"止","脂":"止","之":"止","微":"止",
    "魚":"遇","虞":"遇","模":"遇",
    "齊":"蟹","佳":"蟹","皆":"蟹","灰":"蟹","咍":"蟹","祭":"蟹","泰":"蟹","夬":"蟹","廢":"蟹",
    "真":"臻","諄":"臻","臻":"臻","文":"臻","欣":"臻","元":"臻","魂":"臻","痕":"臻",
    "寒":"山","桓":"山","删":"山","山":"山","先":"山","仙":"山",
    "蕭":"效","宵":"效","肴":"效","豪":"效",
    "歌":"果","戈":"果",
    "麻":"假",
    "陽":"宕","唐":"宕",
    "庚":"梗","耕":"梗","清":"梗","青":"梗",
    "蒸":"曾","登":"曾",
    "尤":"流","侯":"流","幽":"流",
    "侵":"深",
    "覃":"咸","談":"咸","鹽":"咸","添":"咸","咸":"咸","銜":"咸","嚴":"咸","凡":"咸",
}

# 41-class initial order (fixed, canonical order)
INITIAL_ORDER = [
    "幫","滂","並","明",
    "非","敷","奉","微",
    "端","透","定","泥",
    "知","徹","澄","娘",
    "見","溪","羣","疑",
    "影","曉","匣","喻",
    "精","清","從","心","邪",
    "莊","初","崇","生",
    "章","昌","船","書","禪",
    "俟",
    "來","日",
]

# 16 she order (fixed, canonical order)
SHE_ORDER = [
    "通","江","止","遇","蟹","臻","山","效",
    "果","假","宕","梗","曾","流","深","咸",
]

def parse_jiyun(path):
    """Parse 集韻.md into a phonology matrix: 41 initials x 16 she."""
    print("[3/6] Parsing 集韻.md → jy_phonology.json ...")

    matrix = defaultdict(lambda: defaultdict(int))
    char_details = defaultdict(list)
    unknown_upper = set()

    current_volume = 0
    current_tone = ''
    current_rhyme = ''
    current_she = ''
    current_fanqie = ''
    current_fanqie_upper = ''

    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')

            # Volume header: # 集韻卷之一 平聲一
            if line.startswith('# ') and not line.startswith('## '):
                m = re.match(r'# 集韻卷之[一二三四五六七八九十]+ (.聲)', line)
                if m:
                    current_tone = m.group(1)[0]
                continue

            # Rhyme header: ## 東第一`都籠切獨用`
            if line.startswith('## '):
                m = re.match(r'##\s*(\S+?)第', line)
                if m:
                    current_rhyme = m.group(1)
                    current_she = RHYME_TO_SHE.get(current_rhyme, '')
                continue

            # Fanqie header: ### 都籠切
            if line.startswith('### '):
                fanqie_text = line[4:].strip()
                current_fanqie = fanqie_text
                current_fanqie_upper = fanqie_text[0] if fanqie_text else ''
                continue

            # Entry line: chars`annotation` or `char`annotation
            if not current_fanqie or not current_fanqie_upper:
                continue

            # Look up initial class from fanqie upper character
            initial_class = FANQIE_TO_INITIAL.get(current_fanqie_upper)
            if not initial_class:
                unknown_upper.add(current_fanqie_upper)
                continue

            if not current_she:
                continue

            bt_idx = line.find('`')
            if bt_idx < 0:
                continue

            chars_str = line[:bt_idx].strip()
            rest = line[bt_idx + 1:]
            end_idx = rest.find('`')
            annotation = rest[:end_idx].strip() if end_idx >= 0 else rest.strip()

            if not chars_str:
                continue

            for ch in chars_str:
                if not is_cjk_char(ch):
                    continue
                matrix[initial_class][current_she] += 1

                key = '%s||%s' % (initial_class, current_she)
                detail = {
                    'c': ch,
                    'f': current_fanqie,
                    'a': annotation,
                    'r': current_rhyme,
                }
                char_details[key].append(detail)

    if unknown_upper:
        print("  ⚠ %d unmapped fanqie upper chars: %s" % (len(unknown_upper), ','.join(sorted(unknown_upper)[:20])))

    init_list = [i for i in INITIAL_ORDER if i in matrix]
    she_set_used = {s for inner in matrix.values() for s in inner}
    she_list = [s for s in SHE_ORDER if s in she_set_used]

    grid = []
    for init in init_list:
        grid.append([matrix[init].get(s, 0) for s in she_list])

    total = sum(sum(row) for row in grid)

    print("  %d initials × %d she (%d entries)" % (len(init_list), len(she_list), total))
    return {
        'initials': init_list,
        'she': she_list,
        'sheMatrix': grid,
        'totalEntries': total,
        'charDetails': dict(char_details),
    }


# ─── 4. kangxizidian-v3f.txt → kangxi.json ───

def parse_kangxi(path):
    """Parse 康熙字典: char → {def, fanqie, reading}. Extracts fanqie from annotation text."""
    print("[4/6] Parsing kangxizidian-v3f.txt → kangxi.json ...")
    kangxi = {}
    fanqie_re = re.compile(r'(\w{2,3}切)')
    with open(path, encoding='utf-8') as f:
        for line in f:
            parts = line.split('\t\t')
            if len(parts) < 2:
                continue
            char = parts[0].strip()
            if not char or len(char) != 1 or not is_cjk_char(char):
                continue
            definition = '\t'.join(parts[1:]).strip()
            # Extract fanqie
            fanqie = ''
            m = fanqie_re.search(definition)
            if m:
                fanqie = m.group(1)
            # Limit to prevent excessively large entries, but allow rich content
            if len(definition) > 2000:
                definition = definition[:2000]
            entry = {'def': definition}
            if fanqie:
                entry['fanqie'] = fanqie
            kangxi[char] = entry
    print(f"  {len(kangxi):,} entries")
    return kangxi


# ─── 5. 部件檢索.htm → component_map.json ───

def parse_bujian(path):
    """Parse 部件檢索.tsv (MCPDict processed output, already PUA-free).
    Format: 字\tIDS分解串 (tab-separated, no header)
    Extract sub-components from the IDS string to build component → character map.
    """
    print("[5/10] Parsing 部件檢索.tsv → component_map.json ...")
    from collections import defaultdict
    component_map = defaultdict(set)

    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip('\n')
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) < 2:
                continue
            char = parts[0].strip()
            ids = parts[1].strip()
            if not char or not is_cjk_char(char):
                continue
            # Extract all CJK sub-components from the IDS string
            for ch in ids:
                cp = ord(ch)
                if is_cjk_char(ch) and ch != char:
                    # Skip any remaining PUA (safety, though MCPDict output should be clean)
                    if cp >= 0xF0000 or (0xE000 <= cp <= 0xF8FF):
                        continue
                    component_map[ch].add(char)

    result = {comp: sorted(chars) for comp, chars in component_map.items()}
    print(f"  {len(result):,} components mapped to characters")
    return result


# ─── 6. 中原音韻.tsv → zymy_phonology.json ───

def parse_zhongyuan(path):
    """Parse 中原音韻.tsv → phonology matrix with initials × finals."""
    print("[6/6] Parsing 中原音韻.tsv → zymy_phonology.json ...")

    initials_set = set()
    finals_set = set()
    matrix_count = defaultdict(lambda: defaultdict(int))
    char_details = defaultdict(list)

    with open(path, encoding='utf-8') as f:
        header = f.readline().strip('\n').split('\t')
        # Column indices: 0=小韻, 1=字組, 2=聲母, 3=韻母, 4=聲調,
        # 5=楊耐思, 6=寧繼福, 7=薛鳳生(音位), 8=unt(音位), 9=unt,
        # 10=釋義, 11=校註

        for line in f:
            line = line.strip('\n')
            if not line:
                continue
            parts = line.split('\t')

            if len(parts) < 5:
                continue

            xiaoyun = parts[0].strip()
            char_group = parts[1].strip() if len(parts) > 1 else ''
            initial = parts[2].strip() if len(parts) > 2 else ''
            final = parts[3].strip() if len(parts) > 3 else ''
            # tone = parts[4].strip()  -- available but not used for matrix

            # Reconstructions: columns 5-9
            reading = ''
            if len(parts) > 9:
                reading = parts[9].strip()  # unt (column 10, 0-indexed 9)
            elif len(parts) > 8:
                reading = parts[8].strip()  # unt(音位) fallback
            elif len(parts) > 5:
                reading = parts[5].strip()  # 楊耐思 fallback

            gloss = ''
            if len(parts) > 10:
                gloss = parts[10].strip()

            if not initial or not final:
                continue

            initials_set.add(initial)
            finals_set.add(final)

            # Split character group into individual characters
            # "東" or "蔥葱" -> ['東'] or ['蔥', '葱']
            for ch in char_group:
                if not is_cjk_char(ch):
                    continue
                matrix_count[initial][final] += 1
                detail = {'c': ch, 'r': reading, 'g': gloss}
                key = '%s||%s' % (initial, final)
                char_details[key].append(detail)

    init_list = sorted(initials_set)
    final_list = sorted(finals_set)

    grid = []
    for init in init_list:
        grid.append([matrix_count[init].get(f, 0) for f in final_list])

    total = sum(sum(row) for row in grid)

    print("  %d initials × %d finals (%d entries)" % (len(init_list), len(final_list), total))
    return {
        'initials': init_list,
        'finals': final_list,
        'matrix': grid,
        'charDetails': dict(char_details),
        'totalEntries': total,
    }


# ─── 7. 漢大.tsv → handa.json ───

def parse_handa(path):
    """Parse 漢大.tsv: char → [{reading, def, page}].
    Each character may have multiple entries (different meanings/readings).
    Source format: 字\t拼音\t释义\t页码\t(extra)
    """
    print("[7/10] Parsing 漢大.tsv → handa.json ...")
    from collections import defaultdict
    handa = defaultdict(list)
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) < 3:
                continue
            char = parts[0].strip()
            if not char or len(char) > 2 or not is_cjk_char(char[0]):
                continue
            reading = parts[1].strip() if len(parts) > 1 else ''
            definition = parts[2].strip() if len(parts) > 2 else ''
            page = parts[3].strip() if len(parts) > 3 else ''
            handa[char[0] if len(char) > 1 else char].append({
                'r': reading,
                'd': definition,
                'p': page,
            })
    # Convert to dict with dedup
    result = {}
    for char, entries in handa.items():
        seen = set()
        unique = []
        for e in entries:
            key = (e['r'], e['d'][:50])
            if key not in seen:
                seen.add(key)
                unique.append(e)
        if unique:
            result[char] = unique
    print(f"  {len(result):,} characters, {sum(len(v) for v in result.values()):,} entries")
    return result


# ─── 8. 匯纂.tsv → huizuan.json ───

def parse_huizuan(path):
    """Parse 匯纂.tsv (古音匯纂): char → [{page, reading, def}].
    Source format: #漢字\t音標\t解釋
    The 音標 column has page + modern reading, 解釋 has detailed phonological citations.
    """
    print("[8/10] Parsing 匯纂.tsv → huizuan.json ...")
    huizuan = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) < 3:
                continue
            char = parts[0].strip()
            if not char or len(char) > 2 or not is_cjk_char(char[0]):
                continue
            # 音標: "page reading" or "page reading1 reading2..."
            yinbiao = parts[1].strip()
            defn = '\t'.join(parts[2:]).strip()
            # Extract page number and reading
            page = ''
            reading = ''
            yb_parts = yinbiao.split(' ', 1)
            if yb_parts:
                # First token is usually the page number
                m = re.match(r'^([\d.]+)', yb_parts[0])
                if m:
                    page = m.group(1)
                    reading = yb_parts[0][m.end():].strip()
                    if len(yb_parts) > 1:
                        reading += ' ' + yb_parts[1]
                else:
                    reading = yinbiao
            c = char[0] if len(char) > 1 else char
            if c not in huizuan:
                huizuan[c] = []
            huizuan[c].append({
                'p': page,
                'r': reading,
                'd': defn[:2000],
            })
    print(f"  {len(huizuan):,} characters, {sum(len(v) for v in huizuan.values()):,} entries")
    return huizuan


# ─── 9. 方言調查字表.tsv → survey_table.json ───

def parse_survey_table(path):
    """Parse 方言調查字表.tsv into structured phonological survey template.
    Columns: D0序, D0用字, 注例, 声类, 清浊, 韵类, 摄, 开合, 等, 韵, 调类, 舒入, 平仄, 记音, 备注
    """
    print("[9/10] Parsing 方言調查字表.tsv → survey_table.json ...")
    entries = []
    with open(path, encoding='utf-8') as f:
        header = f.readline().strip('\n').split('\t')
        for line in f:
            line = line.strip('\n')
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) < 10:
                continue
            char = parts[1].strip() if len(parts) > 1 else ''
            if not char:
                continue
            # Take first CJK character for indexing
            first_char = char[0] if len(char) > 0 else ''
            if not is_cjk_char(first_char):
                continue
            entry = {
                'c': first_char,
                'i': parts[3].strip() if len(parts) > 3 else '',   # 声类 initial class
                'v': parts[4].strip() if len(parts) > 4 else '',   # 清浊 voicing
                'rh': parts[5].strip() if len(parts) > 5 else '',  # 韵类 rime class
                's': parts[6].strip() if len(parts) > 6 else '',   # 摄 she
                'ok': parts[7].strip() if len(parts) > 7 else '',  # 开合 open/closed
                'd': parts[8].strip() if len(parts) > 8 else '',   # 等 division
                'r': parts[9].strip() if len(parts) > 9 else '',   # 韵 rhyme
                'tc': parts[10].strip() if len(parts) > 10 else '', # 调类 tone class
                'st': parts[11].strip() if len(parts) > 11 else '', # 舒入 smooth/entering
                'pz': parts[12].strip() if len(parts) > 12 else '', # 平仄 level/oblique
                'ex': parts[2].strip() if len(parts) > 2 else '',   # 注例 example
            }
            entries.append(entry)
    print(f"  {len(entries):,} survey entries")
    return entries


# ─── 10. IDS.txt → ids_component.json ───

def parse_ids(path):
    """Parse IDS.txt into component lookup: component → [characters containing it].
    IDS format: U+XXXX\tchar\tIDS_description
    """
    print("[10/10] Parsing IDS.txt → ids_component.json ...")
    from collections import defaultdict
    comp_to_chars = defaultdict(set)
    char_to_ids = {}
    with open(path, encoding='utf-8-sig') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) < 3:
                continue
            char = parts[1].strip()
            if not char or not is_cjk_char(char):
                continue
            ids = parts[2].strip()
            char_to_ids[char] = ids
            # Extract all CJK components from the IDS string
            for ch in ids:
                if is_cjk_char(ch) and ch != char:
                    comp_to_chars[ch].add(char)

    # Convert sets to sorted lists, limit to 100
    comp_map = {}
    for comp, chars in comp_to_chars.items():
        comp_map[comp] = sorted(chars)[:100]

    print(f"  {len(char_to_ids):,} characters, {len(comp_map):,} components")
    return {
        'charIds': char_to_ids,
        'compMap': comp_map,
    }


# ─── Main ───

def main():
    print("=== Preprocessing MCPDict Data v3 ===\n")
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

    # Resolve the URL-encoded filename for 中原音韻
    zymy_path = RAW_MCP / '%E4%B8%AD%E5%8E%9F%E9%9F%B3%E9%9F%BB.tsv'
    if not zymy_path.exists():
        alt = RAW_MCP / '中原音韻.tsv'
        if alt.exists():
            zymy_path = alt

    file_map = {
        'yitizi': RAW_MCP / '異體字.tsv',
        'shuowen': RAW_MCP / '說文.tsv',
        'jiyun': RAW_MCP / '集韻.md',
        'kangxi': RAW_MCP / 'kangxizidian-v3f.txt',
        'bujian': RAW_MCP / '部件檢索.tsv',
        'zhongyuan': zymy_path,
        'handa': RAW_MCP / '漢大.tsv',
        'huizuan': RAW_MCP / '匯纂.tsv',
        'survey': RAW_MCP / '方言調查字表.tsv',
        'ids': RAW_MCP / 'IDS.txt',
    }

    results = {}

    # [1] Variant characters
    if file_map['yitizi'].exists():
        results['variant'] = parse_yitizi(file_map['yitizi'])
        out_path = PUBLIC_DATA / 'variant_map.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['variant']))
        print(f"  → variant_map.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[1/10] 異體字.tsv NOT FOUND, skipping\n")

    # [2] Shuowen
    if file_map['shuowen'].exists():
        results['shuowen'] = parse_shuowen(file_map['shuowen'])
        out_path = PUBLIC_DATA / 'shuowen.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['shuowen']))
        print(f"  → shuowen.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[2/10] 說文.tsv NOT FOUND, skipping\n")

    # [3] Jiyun
    if file_map['jiyun'].exists():
        results['jy'] = parse_jiyun(file_map['jiyun'])
        out_path = PUBLIC_DATA / 'jy_phonology.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['jy']))
        print(f"  → jy_phonology.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[3/10] 集韻.md NOT FOUND, skipping\n")

    # [4] Kangxi
    if file_map['kangxi'].exists():
        results['kangxi'] = parse_kangxi(file_map['kangxi'])
        out_path = PUBLIC_DATA / 'kangxi.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['kangxi']))
        print(f"  → kangxi.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[4/10] kangxizidian-v3f.txt NOT FOUND, skipping\n")

    # [5] Component map
    if file_map['bujian'].exists():
        results['component'] = parse_bujian(file_map['bujian'])
        out_path = PUBLIC_DATA / 'component_map.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['component']))
        print(f"  → component_map.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[5/10] 部件檢索.htm NOT FOUND, skipping\n")

    # [6] Zhongyuan Yinyun
    if file_map['zhongyuan'].exists():
        results['zymy'] = parse_zhongyuan(file_map['zhongyuan'])
        out_path = PUBLIC_DATA / 'zymy_phonology.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['zymy']))
        print(f"  → zymy_phonology.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[6/10] 中原音韻.tsv NOT FOUND, skipping\n")

    # [7] Hanyu Da Zidian (漢大)
    if file_map['handa'].exists():
        results['handa'] = parse_handa(file_map['handa'])
        out_path = PUBLIC_DATA / 'handa.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['handa']))
        print(f"  → handa.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[7/10] 漢大.tsv NOT FOUND, skipping\n")

    # [8] Huizuan (古音匯纂)
    if file_map['huizuan'].exists():
        results['huizuan'] = parse_huizuan(file_map['huizuan'])
        out_path = PUBLIC_DATA / 'huizuan.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['huizuan']))
        print(f"  → huizuan.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[8/10] 匯纂.tsv NOT FOUND, skipping\n")

    # [9] Dialect survey table
    if file_map['survey'].exists():
        results['survey'] = parse_survey_table(file_map['survey'])
        out_path = PUBLIC_DATA / 'survey_table.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['survey']))
        print(f"  → survey_table.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[9/10] 方言調查字表.tsv NOT FOUND, skipping\n")

    # [10] IDS component data
    if file_map['ids'].exists():
        results['ids'] = parse_ids(file_map['ids'])
        out_path = PUBLIC_DATA / 'ids_component.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(compact_json(results['ids']))
        print(f"  → ids_component.json ({out_path.stat().st_size:,} bytes)\n")
    else:
        print("[10/10] IDS.txt NOT FOUND, skipping\n")

    # Summary
    print("=== Done ===\n")
    for name in ['variant_map.json', 'shuowen.json', 'jy_phonology.json',
                 'kangxi.json', 'component_map.json', 'zymy_phonology.json',
                 'handa.json', 'huizuan.json', 'survey_table.json', 'ids_component.json']:
        p = PUBLIC_DATA / name
        if p.exists():
            size_kb = p.stat().st_size / 1024
            print("  ✅ %-24s %8.1f KB" % (name, size_kb))
        else:
            print("  ❌ %-24s NOT FOUND" % name)


if __name__ == '__main__':
    main()
