<img width="3000" height="500" alt="Brain Trace (3)" src="https://github.com/user-attachments/assets/8f92baaa-158e-4475-b34a-5f1f440649ac" />

<p align="center"><i>지식 그래프를 활용한 지식 관리 시스템</i></p>

Brain Trace System (BrainT)는 사용자가 업로드한 PDF, TXT, DOCX, Markdown 문서에서 핵심 개념과 개념 간의 관계를 자동으로 추출하고, 이를 지식 그래프 형태로 저장하여 활용하는 시스템입니다. 문서 내용을 단순히 저장하는 것을 넘어, 개념 단위로 구조화하여 탐색하고 활용할 수 있도록 돕습니다.

사용자가 질문을 입력하면, 시스템은 지식 그래프에서 관련된 개념들을 중심으로 의미 있는 노드들을 탐색하고, 필요 시 문서 내 해당 개념이 포함된 부분(청크)을 함께 가져와, 문서 기반의 답변을 제공합니다. 이때, 답변은 단순한 키워드 검색이 아닌, 그래프 구조를 따라 의미를 이해하고 연결하는 방식으로 생성됩니다. 또한, 기능을 로컬 또는 클라우드의 구동 환경을 선택하여 실행할 수 있으며, 외부 서버와의 연결 없이도 작동하므로 보안에 민감한 환경에서도 사용할 수 있습니다.

문서를 계속 추가할수록 그래프는 더욱 정교해지고, 검색과 탐색의 깊이와 정확성도 함께 향상됩니다. 흩어져 있던 정보들이 유기적으로 연결되며, 지식은 단순히 쌓이는 것을 넘어 구조화되고 유의미하게 진화하는 형태로 재탄생합니다.

<퀄컴 연계 캡스톤 디자인 당시 퀄컴에 업로드 된 포스트>>
https://www.qualcomm.com/developer/blog/2025/12/hansung-university-relations-capstone-design-projects
---

## 시스템 아키텍처

![시스템 아키텍처](https://github.com/user-attachments/assets/232bcdbe-6238-4b5b-8e5d-cace17a23d94)

---

## 지식 그래프 생성 파이프라인

<p>BrainTrace는 다양한 유형의 학습 자료를 다음의 다섯 단계로 지식 그래프로 변환합니다.</p>

<img width="2048" height="800" alt="flowchart_height_800" src="https://github.com/user-attachments/assets/f8efb47b-f155-466f-809b-d4ff0568e508" />

1. **텍스트 추출**:
   PDF, 텍스트 파일, 메모, Markdown, DOCX 등의 소스에서 텍스트를 추출합니다.

2. **토큰화**:
   추출된 텍스트를 의미 있는 단위(문장, 명사구 등)로 분할합니다.

    로직:
    1. 텍스트를 줄바꿈 문자(\\n)를 기준으로 텍스트 덩어리와 \\n으로 분리합니다.
    2. 텍스트 덩어리를 순회하며 \\n을 만났을 때, 그 *이전까지의 텍스트* 길이를 확인합니다.
    3. 길이가 25자 이하이면, \\n을 유효한 문장 분리점으로 취급합니다. 
       (제목/소제목 등을 감지하기 위함)
    4. 길이가 25자 초과이면, \\n을 무시하고(공백으로 치환) 다음 텍스트 덩어리와 합칩니다. 
       (문장이 끝나지 않았으나 한 줄이 넘어간 경우로 간주)
    5. 이렇게 재구성된 텍스트 덩어리들(merged_lines)을 대상으로 
       intra_line_pattern 정규식을 적용해 최종 문장을 분리합니다.

    
3. **청킹**:
   주제별로 유사한 문장들을 묶어 전체 텍스트를 1000~2000자 사이의 청크로 분할합니다.
   지식 그래프의 골격을 생성합니다.


4. **노드 및 엣지 생성**:
   각 청크에서 개념(노드)과 관계(엣지)를 추출하고 청킹 과정에서 생성한 지식그래프와 연결합니다.


5. **그래프 병합**: 모든 청크에서 노드/엣지를 통합된 지식 그래프로 병합합니다.
 
---

## 청킹 함수 동작 과정

<p>청킹 함수는 재귀적으로 호출되며 다음 동작을 반복합니다.</p>

<img width="960" height="460" alt="image" src="https://github.com/user-attachments/assets/ce93db48-6e44-4520-8d28-b4c3d6ea2623" />

1. **명사구 추출**: (depth 0에서만 수행) 텍스트를 문장 단위로 분할하고 명사구를 추출합니다.

 

2. **LDA 모듈을 통한 주제 벡터 변환 & 유사도 계산**: (depth 0에서만 수행) 각 문장을 주제 벡터로 변환하고 벡터간의 내적값을 계산하여 행렬로 저장합니다.

  

3. **Grouping**: 유사도를 기준으로 각 문장을 묶어 청크를 구성합니다.

 

4. **각 청크에서 노드 및 엣지 생성**: 각 청크에서 tf-idf 키워드를 추출하고 노드와 엣지를 생성합니다.

  

지식 그래프에 대한 더 자세한 설명은 [KNOWLEDGE_GRAPH.md](./KNOWLEDGE_GRAPH.md)에서 확인할 수 있습니다.

---

## 질문-답변(Q&A) 파이프라인

<p>BrainTrace의 Q&A는 <b>질문 → 임베딩 검색 → 그래프 DB 조회 → LLM 답변 생성 → 참조 노드/출처/정확도 계산 → 출처보기</b> 순으로 처리됩니다. </p>

1. **질문 입력**
   - 프론트에서 질문을 먼저 세션에 저장한 뒤, 질문/모델 정보를 전송합니다.


2. **질문 임베딩 & 유사 노드 검색(Qdrant, Q 계산)**
   - 질문을 KoE5 임베딩으로 변환한 뒤 Qdrant에서 유사 노드를 탐색합니다.
   - `Q`는 **질문과 검색된 노드들의 평균 유사도**로, 정확도 계산에 사용됩니다.


3. **그래프 DB 조회 (빠른 탐색 / 딥서치)**
   - `use_deep_search`에 따라 Neo4j 쿼리 경로가 달라집니다.
   - 기본 모드는 **이웃 노드 중 특정 값을 가지고 있는 노드를 탐색**, 딥서치는 **특정 값이 있는 노드가 나올 때까지 탐색**합니다.


4. **스키마 텍스트 구성 (LLM 입력용 컨텍스트)**
   - Neo4j에서 조회된 노드/관계를 **문장형 컨텍스트**로 변환합니다.
   - 노드 설명은 **`original_sentences` 기반으로 정리**됩니다.
  

5. **LLM 답변 생성**
   - 스키마 텍스트 + 질문을 LLM에 전달해 최종 답변을 생성합니다.

  
6. **참조 노드 선정 (답변 임베딩 기반) + 답변에 붙이기**
   - 답변 텍스트를 다시 임베딩하고, 유사 노드를 찾아 LLM이 **참조한 노드**로 선정합니다.
   - 기본 임계값은 `0.7`입니다.
   - BrainTrace는 약 10B 미만의 온디바이스 LLM을 사용합니다. 이정도 크기의 모델에게 “참조한 노드를 함께 반환하라”고 지시하면 응답 포맷이 자주 깨지고, 일관성이 없거나 누락이 발생하는 문제가 잦습니다. 그래서 LLM이 어떤 노드를 참고했는지 **모델 응답을 직접 임베딩해서 그래프에서 다시 찾아내는 방식**이 더 안정적이라고 판단했습니다.


7. **정확도 계산 (Q/S/C 가중합)**
   - 정확도는 **Q(검색 품질), S(답변-컨텍스트 유사도), C(커버리지)**의 가중합입니다.
   - Q는 질문 임베딩으로 Qdrant에서 유사 노드를 검색한 뒤,
      (1) threshold 미만은 제거 → (2) high_score_threshold 이상은 모두 유지 →
      (3) 중복된 노드 제거 → (4) 그 중 점수 상위 limit개를 선택<br>
     이렇게 최종 선택된 노드들의 유사도(score) 평균으로 계산한 값입니다.
   - `S`는 답변과 **Neo4j 노드 description/original_sentences**의 코사인 유사도입니다.
   - `C`는 **커버리지(Coverage)**로, 답변이 실제로 **LLM에 제공된 스키마 컨텍스트 안의 노드**를 얼마나 반영했는지 보는 지표입니다.

   
8. **원본 소스/문장(근거) 구성**
   - `referenced_nodes`에 대해 **source_id 목록 + 원문**을 구성합니다.
   - 원문은 **그래프 생성 시 저장된 `original_sentences`**를 기반으로 합니다.

  

9. **답변 저장 & 응답 구조**
   - 최종 답변/참조노드/정확도를 SQLite에 저장하고 응답합니다.


---

## 지식 그래프 생성 방식 (2가지)

BrainTrace는 지식 그래프를 생성할 때 두 가지 로직을 고려했습니다.

1. **알고리즘 기반(수동 청킹)**  
   위의 “지식 그래프 생성 파이프라인”에서 설명한 방식입니다. LLM 없이 `manual_chunking_sentences`로 문장을 청킹하고, 알고리즘적으로 노드/엣지를 생성합니다.

2. **LLM 기반(OpenAI/Ollama)**  
   OpenAI/Ollama가 원문에서 노드/엣지를 추출하고, `description`을 추가로 생성합니다. (`description`은 노드를 한 문장으로 요약한 설명입니다.) 
   이후 `description`과 원문 문장 임베딩 유사도를 비교해 `original_sentences`를 산출합니다.

---


## 결과물

<div style="margin-left:20px;">

<details open>
<summary>&nbsp;<b>홈 화면</b></summary>

![홈 화면](https://github.com/user-attachments/assets/fccf8b7f-85e2-48ed-8f46-268b491311c9)
</details>

<details open>
<summary>&nbsp;<b>메인 화면</b></summary>

![메인 화면](https://github.com/user-attachments/assets/a384c568-f95d-4552-a778-313ffc862c34)

</details>

</div>

### 주요 기능 데모

<table style="background-color:#ffffff; border-collapse:separate; border-spacing:10px;">
  <tr>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/4d37ea5b-4882-4ba7-8af4-7fb1cb121292" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>새 프로젝트 생성</b></div>
      <div align="center"><sub>프로젝트 이름과 환경을 선택하여 새 프로젝트를 시작할 수 있습니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/3fe7b00f-b5da-4bb0-a458-5f22a09414f4" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>업로드 시 그래프 생성</b></div>
      <div align="center"><sub>파일을 업로드하면 자동으로 노드와 엣지가 생성되어 그래프에 반영됩니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr style="background-color:#ffffff;">
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/40c78b69-84fb-4e4b-8e33-4567e91ee932" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>소스 하이라이팅</b></div>
      <div align="center"><sub>원하는 소스를 클릭하여 내용을 확인하고 하이라이팅할 수 있습니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/5198ff83-b0f4-4eb2-bab9-70bb68a8c782" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>Q&A 후 참조된 노드</b></div>
      <div align="center"><sub>답변에 사용된 노드를 그래프 뷰에서 확인할 수 있습니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr style="background-color:#ffffff;">
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/d326414a-2418-4f97-a3cb-0e3b18273df6" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>출처 보기</b></div>
      <div align="center"><sub>답변에 사용된 노드가 어떤 소스를 참고했는지 확인합니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/3007d333-8566-4098-b474-6979ddd5e810" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>소스 노드 보기</b></div>
      <div align="center"><sub>특정 소스가 생성한 노드를 그래프 뷰에서 확인합니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr style="background-color:#ffffff;">
    <td width="50%" valign="top" style="padding:8px; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/73aae827-6de4-47d7-8642-8e2dde5e764d" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>메모 작성 및 소스로 추가</b></div>
      <div align="center"><sub>메모를 작성하고 소스로 변환하여 그래프에 반영할 수 있습니다.</sub></div>
    </td> 
    <td width="50%" valign="top" style="padding:8px; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/02c1606a-5fc4-4dd5-b308-da98664f81ff" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>LLM 모델 및 탐색 종류 선택</b></div>
      <div align="center"><sub>원하는 LLM 모델을 선택하고, 깊은 탐색 또는 빠른 탐색 중 하나를 진행할 수 있습니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr style="background-color:#ffffff;">
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/7828da0f-0054-41fb-b0d6-8521f8c90a71" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>소스 삭제</b></div>
      <div align="center"><sub>특정 소스를 삭제하면 해당 소스로 생성된 노드도 함께 삭제됩니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/8e077054-aa87-4c45-a8a1-0a9ee0dd9704" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>탐색 기능</b></div>
      <div align="center"><sub>파일 내용이나 키워드로 유사한 소스를 찾습니다.</sub></div>
    </td>
  </tr>
  <tr><td colspan="2" style="height:16px;"></td></tr>
  <tr>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://github.com/user-attachments/assets/52da24d4-094d-4c17-913f-539d585ba94a" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
       <div align="center"><b>그래프 뷰 라이트 모드 노드 검색 및 노드 속성 확인</b></div>
<div align="center"><sub>노드 검색으로 원하는 노드로 카메라를 이동하고, 노드 호버 시 출처 및 원문을 확인할 수 있습니다.</sub></div>
    </td>
    <td width="50%" valign="top" style="padding:0; background-color:#ffffff; border:2px solid #000000;">
      <img src="https://raw.githubusercontent.com/yes6686/portfolio/main/전체화면 다크모드.gif" width="100%" style="border:4px solid #cfd8e3;border-radius:8px;" />
      <div align="center"><b>그래프 뷰 다크 모드</b></div>
      <div align="center"><sub>어두운 테마에서 그래프를 탐색하며 속성을 자유롭게 조절합니다.</sub></div>
    </td>
  </tr>
</table>

---

## 시연 영상

<div align="center">
  <a href="https://youtu.be/CkKStA9WHhY" target="_blank">
    <img src="https://img.youtube.com/vi/CkKStA9WHhY/maxresdefault.jpg" alt="데모 비디오" style="width:70%; max-width:500px; border:2px solid #ddd; border-radius:10px; box-shadow:0 4px 8px rgba(0,0,0,0.2); transition: transform 0.2s;" />
  </a>
</div>

---

## 팀원 소개

|                         팀장 / Full Stack                         |                                Backend                                 |                               DevOps                               |                                AI                                 |
| :---------------------------------------------------------------: | :--------------------------------------------------------------------: | :----------------------------------------------------------------: | :---------------------------------------------------------------: |
| <img src="https://github.com/yes6686.png?size=200" width="100" /> | <img src="https://github.com/kimdonghyuk0.png?size=200" width="100" /> | <img src="https://github.com/Mieulchi.png?size=200" width="100" /> | <img src="https://github.com/selyn-a.png?size=200" width="100" /> |
|               [안예찬](https://github.com/yes6686)                |               [김동혁](https://github.com/kimdonghyuk0)                |               [유정균](https://github.com/Mieulchi)                |               [장세린](https://github.com/selyn-a)                |

---

라이선스는 저장소의 [LICENSE](./LICENSE) 파일을 참고하세요.
<br>
자세한 제3자 오픈소스 사용 및 라이선스 표기는 [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) 파일을 참고하세요.
