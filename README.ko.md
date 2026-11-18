# dsh-cam-plugin

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [العربية](README.ar.md)

로컬 [cam](https://github.com/HanochZhu/codeagent_memory)(code agent memory, 프로젝트의 코드 그래프와 해법 메모리)을 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH, DeepSeek의 에이전트 런타임)에 연결합니다.

플러그인은 로컬 `cam --json`을 호출합니다. 메모리와 코드 그래프는 대상 프로젝트의 `.cam/cam.db`에 남으며 업로드되지 않습니다.

## 준비

`cam`이 `PATH`에 있고 `cam --help`가 동작해야 합니다. 이 패키지에는 바이너리가 포함되지 않습니다.

## 설치

```sh
dsh plugin --profile <profile> add github:HanochZhu/dsh-cam-plugin
```

진입점은 순수 ESM이라 설치할 때 빌드 스크립트를 실행하지 않습니다. 해당 프로필로 시작합니다.

```sh
dsh --profile <profile>
```

`--dump-config`의 레이어 목록에 `# == dsh-cam-plugin`이 나타납니다.

바이너리나 기본 프로젝트를 고정하려면 프로필의 `cordis.patch.yml`에서 id `cam` 행을 덮어씁니다. 이 레이어는 해당 행의 `config` 전체를 바꿉니다.

```yaml
- id: cam
  config:
    camBin: cam
    project: D:/work/my-repo
```

`project`는 생략할 수 있습니다. 각 도구는 `path`를 받습니다. 둘 다 없으면 cam은 `CAM_PROJECT`를 쓰고, 그다음 프로세스 작업 디렉터리에서 `.cam` 또는 `.git`을 위로 찾습니다.

번들로 설치하지 않고 체크아웃만 시험할 때:

```sh
dsh web --patch ./cordis.example.yml
```

`cordis.example.yml`의 플러그인 경로는 절대 경로여야 합니다.

## 도구

| 도구 | 역할 |
| --- | --- |
| `cam_recall` | 영어 한 문장으로 해법 메모리를 검색 |
| `cam_index` | 처음에 그래프를 만들고, 이후에는 증분 갱신 |
| `cam_ls` / `cam_find` / `cam_grep` | 디렉터리 나열, 심볼 이름 검색, 리터럴 텍스트 검색 |
| `cam_read` / `cam_ref` | 심볼 하나를 읽거나, 호출자(`in`)와 피호출자(`out`)를 조회 |
| `cam_add` / `cam_mem_show` / `cam_mem_tree` | 메모리 하나를 저장하고, id로 보고, 트리를 출력 |
| `cam_status` | 해석된 프로젝트와 데이터베이스를 표시 |

Harness에 skill 서비스가 있으면 플러그인은 런타임 skill `cam`을 등록합니다. 단계는 위 도구와 같습니다.

## 개발

```sh
npm test
```
