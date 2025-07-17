"""
pip install konlpy
pip install gensim
wget https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.ko.300.vec.gz
gunzip cc.ko.300.vec.gz
"""

import sys
print(sys.executable)

import re
from konlpy.tag import Okt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

okt = Okt()

def extract_noun_phrases(text: str) -> list[str]:
    """
    명사 연속 조합으로 명사구 추출
    """
    words = okt.pos(text)
    noun_phrases = []
    phrase = []
    for word, tag in words:
        if tag == 'Noun':
            phrase.append(word)
        else:
            if len(phrase) >= 1:
                noun_phrases.append(" ".join(phrase))
                phrase = []
    if phrase:
        noun_phrases.append(" ".join(phrase))
    return list(set(noun_phrases))

def normalize_coreferences(text: str) -> str:
    """
    같은 대상을 지칭하는 명사구들을 첫 번째 명사구로 통일
    """
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    all_phrases = []
    phrase_to_sentence_idx = {}

    # 각 문장에서 명사구 추출
    for idx, sent in enumerate(sentences):
        phrases = extract_noun_phrases(sent)
        for phrase in phrases:
            all_phrases.append(phrase)
            phrase_to_sentence_idx[phrase] = idx

    if len(all_phrases) <= 1:
        return text  # 바꿀 게 없으면 그대로

    # TF-IDF로 명사구 간 유사도 계산
    vectorizer = TfidfVectorizer().fit(all_phrases)
    X = vectorizer.transform(all_phrases)
    sim_matrix = cosine_similarity(X)

    # 유사한 명사구 그룹 만들기 (임계값 0.6 이상)
    threshold = 0.6
    groups = []
    used = set()
    for i in range(len(all_phrases)):
        if i in used:
            continue
        group = [i]
        for j in range(i+1, len(all_phrases)):
            if sim_matrix[i][j] > threshold:
                group.append(j)
                used.add(j)
        used.add(i)
        groups.append(group)

    # 그룹 내 가장 먼저 등장한 명사구 선택

    replacement_map = {}
    for group in groups:
        group_phrases = [all_phrases[i] for i in group]
        print(group_phrases)
        earliest = min(group_phrases, key=lambda x: phrase_to_sentence_idx[x])
        for phrase in group_phrases:
            replacement_map[phrase] = earliest

    # 원문 치환
    for old, new in sorted(replacement_map.items(), key=lambda x: -len(x[0])):  # 긴 것 먼저 바꾸기
        if old != new:
            text = re.sub(rf'\b{re.escape(old)}\b', new, text)

    return text

text="""보성전문학교 시절부터 대한민국 국내에서 오랫동안 인식되어 왔던 고려대의 모습은 하기와 같다.

① 야성적, 활동적, 정열적
고려대학교의 교풍은 야성, 활기와 정열 등으로 대표된다. 무섭고 사나운 호랑이, 강렬하게 검붉은 크림슨색 등 고대를 대표하거나 '고대' 하면 떠오르는 상징들은 대부분 위의 특징들과 연관된 경우가 많다. 이는 고려대학교가 그 전신인 보성전문학교 시절 사실상 유일한 민족·민립의 지도자 양성기구였기 때문에, 민족정신이라는 시대적 요구가 교수와 학생들에게 특별히 더 부하됐고, 그것이 학생들의 지사적 또는 투사적 저항 기질을 배태시켰던 데 기인한다는 견해가 있다.[20]

② 협동적, 끈끈함
고려대에서는 졸업생을 '동문', '동창' 등의 단어 대신 '교우(校友)'라고 부른다. 이는 학교를 같이 다녔다는 이유만으로 친구라는 의미이다. 사회에서 고려대 출신 간에는 유대가 매우 강한 편이며 이러한 문화는 개인주의 성향이 강해진 현대에도 사라지지 않고 건강하게 이어지고 있다. 고대에는 자기 이익만 앞세우려 하기보다는, 타인과 소통하고 서로의 장점을 살려 일을 분담함으로써 시너지를 내는 문화가 발달돼 있다. 또한 일대일 간의 관계보다는 폭넓은 집단 내에서의 관계를 더 선호하는 편이다.[21] 구성원들의 애교심이 워낙 커서 그런지, 정치적 이념 및 경제적 이해관계가 다르더라도 같은 고대 동문 사이에는 좀 더 상대방의 입장에 서서 생각해보고 인간적 신뢰에 입각하여 갈등을 풀어가려는 전통이 이어지고 있다. 실제로 고려대에는 동아리 조직이 발달해 그 구성원이 인간관계를 다지고 팀플레이를 하는 풍조가 강하다. 공부도 물론 중요시하지만, 개인의 성적만을 챙기는 능력보다는 인간관계를 충실히 하는 능력, 남을 이끄는 지도력이나 상급자, 동료와 화합하는 친화력 등을 더 높이 평가하는 편이다. 다른 그 무엇보다도 장기적인 대인관계와 신뢰감을 중시하는 습관, 조직을 위해 희생하고 봉사하고 오욕 뒤집어쓰는 일을 두려워하지 않는 기질이 이런 문화 속에서 길러지는 건 당연한 일이다.[22] 21세기 들어서 오프라인 커넥션만이 아니라 온라인 커넥션의 중요성이 매우 커졌는데, 이에 발맞춰 고대에서는 인터넷 커뮤니티도 매우 활발하게 운영되고 있다. 고려대학교 에브리타임도 상당히 활성화되어 있는 편이지만, 특히 고대의 자랑 중 하나인 고파스의 경우 각종 게시판에서 유통되고 누적되는 정보가 매우 방대할 뿐 아니라 영양가도 높다.[23]

③ 개방적, 포용적
고대생의 끈끈한 이미지를 생각한다면 외부에 대해 배타적이고 폐쇄적일 것처럼 생각하기 쉽지만 고려대 교수들 가운데 자교 출신 비율이 58.2%에 불과한 것,#[24] 꼭 고대 학부 출신이 아니더라도[25] 맡은 바 최선을 다한다면 선뜻 주류 교우로 받아들이는 문화 등에서 알 수 있듯이 고대는 오히려 외부에 대해 상당히 개방적인 태도를 취하는 학교다. 이는 고대생들의 인간관계가 소규모 그룹으로 이루어지는 게 아니라 대규모 커뮤니티 중심으로 이루어진다는 데 기인하는데, 꼭 고대 학부 출신이 아니더라도 고대 공동체 내에 잘 적응해 맡은 바 능력을 제대로 보여주기만 하면 고대 석박사 출신이어도 모교 학사 출신 못지 않게 교우로서 인정해 준다. 고대 공동체 구성원들이 각 교수 및 학생의 특기와 전문성을 존중하는 것 역시, 그들이 개인의 소소한 친밀감이나 친목의식보다 큰 조직 내에서의 역할 분담과 성취 의식을 더 지향한다는 데 기인한다. 교수들도 이런 학교의 문화에 큰 자긍심을 느끼며, 어느 학생이든 '고대'와의 인연이 있다면 언제나 그들을 반갑게 맞이 하고 함께할 준비가 되어 있다.

④ 굳건함, 집념
연구에 있어서는 특유의 집념과 저력을 발휘하는데, 그로 인해 지구력, 참을성, 우직함으로 장기간의 꾸준한 연구가 필요한 분야에서 강점을 보인다. 예를 들어 법학은 오랜 시간의 공부를 참아내야 하는 분야이고, 한학, 철학이나 역사학도 어마어마한 양의 독서를 요하는 분야이다. 이에 대해서는 캠퍼스 곳곳에 서 있는 육중한 석조 건물이 고대생의 기질에 영향을 미치는 것 같다는 말이 있다.

⑤ 비판적, 저항적
학문적 기조는, 기성 학문에 수긍하기보다 독자적 대안을 제시하려는 경향이 강한 편이다. 데이터 분석을 통한 수리논증이 대세가 될 때에 그에 맞서 이론분석의 방법론을 동등하게 강조하기도 했고, 미국/일본 유학파가 주류를 이룰 때에는 그에 맞서 영국, 프랑스, 독일 등의 학문을 적극적으로 도입하고 소개하기도 했다. 또한 새로운 사조가 들어와 학계의 주류가 되었을 때도 거기에 맹목적으로 따르지 않고 전통적, 기본적, 원칙적인 입장을 같이 강조해왔다. 일제 시절에는 일본 문화가 워낙 주류를 차지하다 보니 학문에 있어서도 민족주의적 경향이 매우 강했다.[26] 다만 광복을 맞은 지 오랜 시간이 지나 그 민족주의가 반대로 정치적 주류로 떠올랐고, 점차 병폐가 드러나게 된 이후로는 민족주의적 경향을 빠르게 희석시키고 있는 추세이기도 하다. 또한, 해방 이후 한글 쓰기 운동이 대두되고 대한민국 교육이 한문을 점점 소홀히 하기 시작할 때에는 한문 해석 능력의 저하를 우려해 학생들의 한문 실력을 대단히 중시했고, 이는 오늘날까지 일부 학과의 교내 졸업 요건에 한자 급수를 포함시킴으로써 이어 오고 있다."""
print(normalize_coreferences(text))