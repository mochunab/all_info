# Signal Network 그래프 크기 수정 인계서

## 문제

Signal Network의 3D Force Graph가 컨테이너(728×420px) 대비 너무 작게 렌더링됨.
노드 클러스터가 캔버스 중앙에 아주 작게 뭉쳐서 표시되고, 카메라/줌 조정으로는 해결 불가.

## 시도한 것 (모두 실패)

| 시도 | 결과 |
|------|------|
| `zoomToFit(400, -20)` 음수 패딩 | 효과 없음 |
| `cameraPosition({ z: 80~250 })` | 그래프 크기 변화 없음 |
| `camera.fov = 25` + `updateProjectionMatrix()` | 라이브러리가 매 프레임 덮어씀 |
| 사전 배치 반경 조절 (r=15~40) | d3 시뮬레이션이 재배치 |
| `d3Force charge/link` 강도 조절 | 노드 분포만 바뀌고 카메라 줌 동일 |
| `cooldownTicks=0`, `d3AlphaDecay` 등 | 시뮬레이션 속도만 변경 |
| 사전 배치 제거 (d3에 위임) | 동일 |

**근본 원인**: `react-force-graph-3d`가 내부적으로 ThreeJS 카메라 + TrackballControls를 관리하며, 외부에서 FOV/position을 변경해도 다음 렌더 사이클에서 리셋됨.

## 해결 방안: `nodeThreeObject` 커스텀 렌더링

나다운세 `NebulaOntologyGraph`가 동일 라이브러리로 큰 노드를 성공적으로 렌더링하는 방법:

### 레퍼런스: `stargiosoft/nadaunse` staging 브랜치
- 파일: `src/components/NebulaOntologyGraph.tsx`
- GitHub: `gh api "repos/stargiosoft/nadaunse/contents/src/components/NebulaOntologyGraph.tsx?ref=staging" -H "Accept: application/vnd.github.raw+json"`

### 핵심 차이점

1. **`nodeThreeObject` 사용** — 기본 구체 대신 커스텀 THREE.js 메시
   ```tsx
   const nodeThreeObject = useCallback((node: GraphNode) => {
     const group = new THREE.Group();
     const radius = node.isCenter ? 9 : 5;  // ← 직접 크기 제어
     const geometry = new THREE.SphereGeometry(radius, 32, 32);
     const material = new THREE.MeshPhongMaterial({ ... });
     const sphere = new THREE.Mesh(geometry, material);
     group.add(sphere);
     // + glow ring, text label sprite
     return group;
   }, []);
   ```

2. **커스텀 라이팅** — scene에서 기본 조명 제거 후 커스텀 추가
   ```tsx
   const scene = fg.scene();
   // AmbientLight + DirectionalLight × 2 + PointLight
   ```

3. **`nodeVal` 대신 직접 radius 계산** — `nodeRelSize` prop 무시

### 구현 계획

1. `three`, `three-spritetext` 패키지 추가 (이미 `three`는 `react-force-graph-3d` 의존성)
2. `SignalNetwork.tsx`에 `nodeThreeObject` 콜백 추가:
   - coin 노드: 센티먼트 색상 구체 (radius 6~10)
   - influencer/narrative/event: 타입별 색상 + 작은 크기
   - 선택된 코인: 더 큰 크기 + glow
3. 커스텀 라이팅 추가 (NebulaOntologyGraph 패턴 그대로)
4. `nodeRelSize`, `nodeVal`, `nodeColor` props 제거 → `nodeThreeObject`가 전담
5. `SpriteText`로 노드 라벨 추가 (선택적)

### 주의사항
- `three`를 직접 import하면 번들 크기 증가 → 이미 `react-force-graph-3d`가 의존하므로 추가 비용 없음
- `three-spritetext` 패키지 설치 필요: `npm install three-spritetext`
- `nodeThreeObject` 사용 시 `nodeVal`, `nodeColor` props는 무시됨
- 기존 `nodeColorFn`, `nodeValFn` 콜백 제거 필요

## 현재 파일 상태

- `components/crypto/SignalNetwork.tsx` — 아코디언 + 좌우 분할 + WHY 패널 통합 완료
- 그래프 관련 현재 설정:
  - `nodeRelSize={5}`, `warmupTicks={100}`, `cooldownTicks={30}`
  - `cameraPosition({ z: 250 })` + `camera.fov = 25` + `zoomToFit(600, 15)`
  - 사전 배치 없음 (d3 시뮬레이션에 위임)
