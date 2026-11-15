# 바로미 데이터셋 계약

실제 쇼핑몰 원문·계정·개인정보·스크린샷은 저장소에 커밋하지 않는다. 이 디렉터리에는 스키마, 라벨 지침, 익명화된 메타데이터만 둔다.

권장 레코드 키:

- `shopGroupId`: 쇼핑몰과 스킨을 묶는 그룹 ID
- `flowId`: 구매 경로·뷰포트·실행 회차 ID
- `split`: `development`, `training`, `validation`
- `evidenceIds`: 원본 증거 레코드 ID 목록
- `labels`: 유형별 사람 라벨과 합의 상태
- `collectorVersion`, `ruleVersion`

동일 쇼핑몰의 PC/모바일과 반복 실행은 같은 `shopGroupId`를 사용해 데이터 누수를 방지한다.

## 라벨 체계

온라인 AI 검토 API의 운영자 라벨과 오프라인 평가 데이터셋의 `labels[].status`는 저장 목적이 달라 이름을 그대로 섞지 않는다.

| AI 검토 라벨 | 데이터셋 상태 | 의미 |
| --- | --- | --- |
| `LIKELY_RISK` | `RISK` | 저장된 증거가 위험 신호를 뒷받침함 |
| `NEEDS_REVIEW` | `REVIEW` | 신호는 있으나 사람 검토가 더 필요함 |
| `LIKELY_BENIGN` | `NOT_OBSERVED` | 해당 유형을 뒷받침하는 관찰이 없음 |
| `INSUFFICIENT_EVIDENCE` | `NOT_TESTED` | 접근 차단·증거 누락으로 판단하지 못함 |

`adjudication`은 `PENDING` 또는 `AGREED`로 기록한다. `PENDING` 행은 모델의 최종 정확도·정밀도·재현율 계산에 포함하지 않는다. 실제 원문, 계정, 개인정보, 스크린샷은 저장소에 넣지 않고 익명화된 증거 ID와 메타데이터만 커밋한다.
