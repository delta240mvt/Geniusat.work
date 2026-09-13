# G@CLight Genius Suite - szczegolowy brief landing page

G@CLight Genius Suite to projekt open source. Landing page musi komunikowac to od pierwszego ekranu: produkt jest lokalny, transparentny, artifact-first i rozszerzalny przez developerow. W stopce strony musi znalezc sie ikona Git/GitHub oraz link lub miejsce na link do repozytorium open source.

Ten dokument opisuje trzy aplikacje produktu:

1. `Genius@Content` - pipeline tworzenia rolek, job-packow AI Studio i renderow.
2. `Genius@Brains` - pipeline inteligencji odbiorcow z komentarzy YouTube.
3. `Genius@Scale` - pipeline walidacji, kalendarza i publikacji na Threads.

`Genius Canvas` jest wspolnym kokpitem preview dla tych trzech aplikacji. Nie nalezy go przedstawic jako czwartej aplikacji, tylko jako ekran operacyjny, ktory pokazuje wyniki pracy calego systemu.

---

## 1. Esencja produktu

G@CLight Genius Suite to lokalny system operacyjny dla tworcow, editorow i operatorow contentu. Produkt laczy research odbiorcow, planowanie rolek, generowanie promptow, render video oraz publikacje w jeden spojny przeplyw oparty o pliki, artefakty i przewidywalne komendy CLI.

Najwazniejsza obietnica landing page:

> Od komentarza odbiorcy do gotowego contentu i zaplanowanej publikacji - w otwartym, lokalnym i audytowalnym pipeline.

Produkt nie jest prostym dashboardem social media. To bardziej "editorial operating system": narzedzie dla osob, ktore chca widziec caly lancuch decyzyjny, dowody, prompty, outputy, statusy i historie runow.

### Krotka narracja landing page

1. `Genius@Brains` czyta odbiorcow: komentarze, sygnaly, pytania, tarcia, tematy.
2. `Genius@Content` zamienia sygnaly w skrypty, sceny, prompty, job-packi i rendery.
3. `Genius@Scale` przygotowuje publikacje: waliduje, generuje kalendarz, robi dry-run i publikuje na Threads.
4. `Genius Canvas` pozwala obejrzec wszystkie artefakty w jednym kokpicie preview.

### Glowny diagram produktu

```text
┌──────────────────┐      ┌───────────────────┐      ┌──────────────────┐
│  Genius@Brains   │      │  Genius@Content   │      │  Genius@Scale    │
│ Audience signals │ ───▶ │ Reels + AI packs  │ ───▶ │ Publish pipeline │
└──────────────────┘      └───────────────────┘      └──────────────────┘
         │                         │                          │
         │                         │                          │
         ▼                         ▼                          ▼
  comments.scored.json       job packs / renders        calendar / run logs
         │                         │                          │
         └─────────────────────────┴──────────────────────────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │  Genius Canvas   │
                         │ preview cockpit  │
                         └──────────────────┘
```

### Pozycjonowanie

Produkt powinien byc pokazany jako:

- open-source content pipeline,
- lokalny system pracy z video i social contentem,
- narzedzie dla operatorow AI, ktorzy chca miec kontrole nad kazdym etapem,
- "artifact-first" alternatywa dla czarnych skrzynek SaaS,
- most miedzy research, generacja video i publikacja.

Produkt nie powinien byc pokazany jako:

- zwykly social media scheduler,
- generyczny kreator AI video,
- dashboard marketingowy bez szczegolow,
- lekka aplikacja do zabawy promptami.

---

## 2. Odbiorcy landing page

### Primary: Creator-operator

Osoba, ktora sama tworzy tresci, testuje formaty, analizuje odbiorcow i chce miec system, ktory zamienia insighty w powtarzalny proces.

Potrzeby:

- szybkie zrozumienie, skad biora sie pomysly,
- podglad kazdego artefaktu,
- mozliwosc powtarzania procesu,
- kontrola nad promptami i outputami,
- brak zamknietej czarnej skrzynki.

### Secondary: Editor / motion designer

Osoba, ktora dostaje material, storyboard, prompty, reference assets i potrzebuje wiedziec, co gdzie jest oraz jak wyglada finalny rytm rolki.

Potrzeby:

- jasne okna: flow, prompty, render preview, storyboard,
- latwe rozpoznanie statusu scen,
- widoczne referencje i zrodla,
- porzadek w plikach job-packa.

### Secondary: Developer / AI automation builder

Osoba, ktora chce forkowac projekt, dodawac integracje, zmieniac kontrakty danych i rozbudowywac pipeline.

Potrzeby:

- widoczne open source,
- jasne granice aplikacji,
- plikowe kontrakty JSON/MD,
- lokalne komendy,
- Git/GitHub w stopce.

---

## 3. Proponowana struktura landing page

### Sekcja 1 - Hero

Cel: natychmiast wyjasnic, ze to open-source content operating system dla pipeline'u AI.

W hero powinno byc:

- H1 z nazwa lub kategoria:
  - `G@CLight Genius Suite`
  - albo `Open-source content pipeline for AI-native creators`
- Podtytul:
  - `Analyze audience signals, build AI video job packs, preview every artifact, and publish with a transparent local workflow.`
- Badge:
  - `Open source`
  - `Local-first`
  - `Artifact-first`
- Glowny visual:
  - realny kokpit lub makieta kokpitu `Genius Canvas`,
  - sidebar z trzema aplikacjami,
  - widoczne zakladki `Comments`, `Run Flow`, `Calendar`,
  - nie abstrakcyjny gradient.

### Sekcja 2 - Three Apps, One Pipeline

Pokazac trzy aplikacje jako trzy czesci jednego procesu:

```text
Audience intelligence  ->  Content generation  ->  Publishing control
Genius@Brains          ->  Genius@Content      ->  Genius@Scale
```

Kazda karta aplikacji powinna miec:

- nazwe,
- jednozdaniowa obietnice,
- 3-5 funkcji,
- mini diagram przeplywu,
- mini preview okna.

### Sekcja 3 - Genius Canvas Preview

Pokazac, ze wszystkie trzy aplikacje maja wspolny cockpit.

Wizualnie:

- lewy sidebar z aplikacjami,
- lista runow,
- metryki na gorze,
- zakladki wewnetrzne,
- panel szczegolow.

Komunikat:

> Canvas is read-only by design: preview, inspect, compare, and debug without accidentally publishing or mutating files.

### Sekcja 4 - Detailed App Sections

Kazda aplikacja dostaje osobny blok z:

- purpose,
- okna/zakladki,
- funkcje,
- input/output,
- przeplyw ASCII,
- co designer powinien pokazac na makiecie.

### Sekcja 5 - Open Source / Local Artifacts

Pokazac wartosc transparentnosci:

- wszystkie runy zapisuja pliki,
- JSON i Markdown jako kontrakty,
- sekrety sa maskowane,
- workflow da sie audytowac,
- repo open source.

### Sekcja 6 - Footer

Obowiazkowo:

- ikona Git/GitHub na dole,
- tekst: `Open source project`,
- link/miejsce na repo,
- male linki: Docs, GitHub, Issues, License, Local setup.

---

## 4. Wspolny kokpit: Genius Canvas

Canvas jest preview-only cockpit, ktory spina trzy aplikacje w jeden interfejs. Jego rola na landing page jest krytyczna, bo daje designerowi realny "produktowy ekran", a nie tylko opis backendowych pipeline'ow.

### Charakter Canvas

- lokalna aplikacja webowa serwowana przez Node HTTP server,
- statyczny frontend bez rozbudowanego frameworka,
- czyta lokalne artefakty z `apps/genius-content/output`, `apps/genius-brains/output`, `apps/genius-scale/output`,
- nie publikuje,
- nie renderuje,
- nie edytuje promptow,
- nie uruchamia dry-runow,
- jest bezpiecznym oknem inspekcji.

### Glowne okna Canvas

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Sidebar: G@CLight / Genius Canvas                                   │
│                                                                     │
│  ▣ Genius@Brains                                                    │
│  ◉ Genius@Content                                                   │
│  ◫ Genius@Scale                                                     │
│                                                                     │
│  Runs list                                                          │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│ Topbar: active app + title + Preview only + disabled actions        │
├─────────────────────────────────────────────────────────────────────┤
│ Metrics: Runs | Nodes | Prompts/comments | Assets                   │
├─────────────────────────────────────────────────────────────────────┤
│ Sub-tabs per app                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Active preview window                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Canvas tabs by app

| Aplikacja | Zakladki w Canvas | Co pokazuja |
|---|---|---|
| `Genius@Brains` | `Comments`, `Channels`, `Insights` | komentarze, wybrane video, sygnaly z odbiorcow |
| `Genius@Content` | `Run Flow`, `Prompts`, `Render Preview` | graf runu, prompty, job-packi, render sequence |
| `Genius@Scale` | `Calendar`, `Runs`, `Assets` | kalendarz publikacji, historia dry-run/publish, asset readiness |

### Styl Canvas

Design system kieruje sie stylem `Rose Slate`:

- tlo papierowe,
- cienkie rose-ash borders,
- ciemny ink text,
- male status chips,
- metadata w monospace,
- kompaktowe panele,
- spokojny, produkcyjny charakter.

To ma wygladac jak premium editorial operating system, nie kolorowy SaaS dashboard.

---

## 5. Aplikacja 1: Genius@Content

### Jednozdaniowy opis

`Genius@Content` zamienia surowe video, skrypty i wiedze o formacie w gotowe artefakty produkcyjne: transkrypty, scene contracts, prompty, job-packi AI Studio, storyboardy, choreografie i rendery Remotion.

### Rola w calym systemie

To serce tworzenia contentu. `Genius@Content` bierze material lub script idea i produkuje wszystko, czego potrzeba, zeby operator, AI model albo motion designer mogli zbudowac rolke.

### Dwa glowne tryby pracy

#### Tryb A: Reel / Remotion pipeline

Ten tryb pracuje na realnym pliku video. Pipeline potrafi:

- przyjac lokalny plik `.mov`, `.mp4` lub inne video,
- wykonac lokalna transkrypcje Whisper,
- wyczyscic transkrypt przez AI albo fallback deterministyczny,
- uzyc Google Video Intelligence do shot changes, labels, OCR, speech, objects, faces,
- wzbogacic research przez Firecrawl,
- znormalizowac wynik do `analysis.json`,
- zbudowac storyboard i choreografie,
- przygotowac propsy do Remotion Studio,
- renderowac pionowy format 9:16,
- zapisywac outputy do lokalnych folderow.

#### Tryb B: AI Studio job-pack pipeline

Ten tryb nie renderuje automatycznie finalnego video. Buduje pakiet pracy dla operatora AI:

- czyta `script_id` z virality knowledge base,
- laduje konfiguracje modeli, person, shotow i promptow,
- rozwiazuje persony Zoe i Elena z lokalnych referencji,
- generuje scene contract,
- generuje capture contract,
- buduje 4-shot plan,
- tworzy prompty Nano Banana,
- tworzy payloady Veo,
- zapisuje job-pack z JSON/MD/TXT,
- daje operatorowi komplet do manualnego generowania obrazow i video.

### Glowne okna dla designera

#### Okno 1: Run Flow

Najwazniejsze okno aplikacji. Pokazuje graf runu jako sekwencje wezlow.

Elementy:

- lista runow po lewej,
- graf krokow w centrum,
- inspector po kliknieciu wezla,
- status kazdego kroku,
- sciezki source/output,
- podsumowanie artefaktow,
- mini timeline procesu.

Wezly, ktore warto pokazac w makiecie:

```text
Input video
  -> Whisper transcript
  -> Transcript cleanup
  -> Google Video Intelligence
  -> Firecrawl research
  -> Asset analysis
  -> Scene design
  -> Remotion direction
  -> Choreography
  -> Render
  -> Final artifacts
```

AI Studio variant:

```text
Virality script
  -> Config validation
  -> Persona resolver
  -> Scene contract
  -> Shot plan
  -> Nano Banana prompts
  -> Veo requests
  -> Job pack files
```

#### Okno 2: Prompts

Okno do podgladu promptow i payloadow.

Pokazywane typy plikow:

- `prompt.txt`,
- `dialogue.txt`,
- `nano-banana-first.json`,
- `nano-banana-last.json`,
- `veo-request.json`,
- `preview-prompt.md`,
- `scene-rationale.md`,
- `audio-notes.md`,
- `edit-brief.md`.

Projektowo to powinno wygladac jak prompt operations room:

- lista shotow,
- per-shot cards,
- prompt body,
- source references,
- target model,
- frame mode,
- persona,
- scene delta,
- output path.

#### Okno 3: Render Preview

Okno do wizualnego sledzenia finalnej sekwencji.

Elementy:

- pionowy phone preview 9:16,
- timeline,
- storyboard strip,
- render sequence per shot,
- input prompts po lewej,
- output assets po prawej,
- strzalka `prompt -> generated image/video`,
- asset cards,
- statusy brakujacych outputow.

### Dane wejsciowe Genius@Content

#### Reel pipeline

```text
input video
project.config.json
.env / API keys
optional research sources
Remotion templates
```

#### AI Studio pipeline

```text
AI Studio/virality/*.md
AI Studio/config/studio.config.json
AI Studio/config/models.json
AI Studio/config/personas.json
AI Studio/config/shots.json
AI Studio/config/prompts.json
AI Studio/Zoe_*.png
AI Studio/Elena_*.png
```

### Dane wyjsciowe Genius@Content

Najwazniejsze artefakty:

```text
output/pipeline/<video-id>/
  00-transcript-clean.json
  00-transcript-clean.md
  01-transcript-analysis.json
  02-evidence-plan.json
  03-research-plan.json
  04-asset-analysis.json
  05-scene-design.json
  06-remotion-direction.json

output/analysis/
  <video-id>.json
  <video-id>-cleanup-report.json

output/renders/
  <video-id>.mp4

output/ai-studio/jobs/<timestamp>-<script-id>/
  job.json
  script.json
  personas.json
  scene-contract.json
  scene-rationale.md
  preview-prompt.md
  audio-notes.md
  edit-brief.md
  flow.md
  shots/
    01-zoe-open/
    02-elena-response/
    03-zoe-reaction/
    04-elena-cta/
```

### Pelny przeplyw Reel / Remotion

```text
┌──────────────┐
│ Input video  │
└──────┬───────┘
       │
       ▼
┌────────────────────┐
│ Local Whisper       │
│ raw transcript      │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐
│ AI cleanup          │
│ clean transcript    │
└──────┬─────────────┘
       │
       ├────────────────────────────────────────────┐
       │                                            │
       ▼                                            ▼
┌───────────────────────┐                 ┌──────────────────────┐
│ Google Video Intel.   │                 │ Firecrawl enrichment │
│ labels/shots/OCR/etc. │                 │ pages/assets/proofs  │
└──────────┬────────────┘                 └─────────┬────────────┘
           │                                        │
           └────────────────────┬───────────────────┘
                                ▼
                      ┌──────────────────┐
                      │ Normalize data   │
                      │ analysis.json    │
                      └────────┬─────────┘
                               ▼
                      ┌──────────────────┐
                      │ Storyboard       │
                      │ scenes/captions  │
                      └────────┬─────────┘
                               ▼
                      ┌──────────────────┐
                      │ Choreography     │
                      │ motion/evidence  │
                      └────────┬─────────┘
                               ▼
                      ┌──────────────────┐
                      │ Remotion render  │
                      │ 1080x1920 MP4    │
                      └──────────────────┘
```

### Pelny przeplyw AI Studio job-pack

```text
┌───────────────────────┐
│ Virality knowledge MD │
│ script_id blocks      │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐     ┌──────────────────────┐
│ Parse selected script │ ◀── │ AI Studio config     │
│ beats/dialogue/goal   │     │ models/personas/etc. │
└──────────┬────────────┘     └──────────────────────┘
           │
           ▼
┌───────────────────────┐
│ Resolve personas      │
│ Zoe / Elena refs      │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Derive scene contract │
│ world/capture rules   │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Build 4-shot plan     │
│ open/response/reaction│
│ CTA                   │
└──────────┬────────────┘
           │
           ├────────────────────────┐
           ▼                        ▼
┌───────────────────────┐   ┌───────────────────────┐
│ Nano Banana inputs    │   │ Veo request payloads  │
│ first/last frames     │   │ video generation      │
└──────────┬────────────┘   └──────────┬────────────┘
           └───────────────┬───────────┘
                           ▼
                 ┌──────────────────┐
                 │ Job pack folder  │
                 │ JSON / MD / TXT  │
                 └──────────────────┘
```

### Funkcje Genius@Content

- `list-scripts`: pokazuje dostepne `script_id` z virality library.
- `build --script-id <id>`: tworzy job-pack AI Studio.
- `transcript`: uruchamia transkrypcje i cleanup.
- `studio:prepare`: przygotowuje propsy dla Remotion Studio.
- `studio`: uruchamia Remotion Studio.
- `render:final:hq`: renderuje finalny MP4.
- `doctor`: sprawdza dostep do Google/Firecrawl i lokalne env.

### Statusy i kontrola jakosci

`Genius@Content` powinien byc wizualizowany jako pipeline z kontrola jakosci:

- kazdy etap zapisuje artefakty,
- brak Firecrawl nie powinien zatrzymac renderu, jesli fallback jest wlaczony,
- brak Google Video Intelligence moze zatrzymac render, jesli config tak stanowi,
- brak wymaganej persony lub configu w AI Studio powinien failowac szybko,
- prompty i scene contract sa czescia audytu.

### Co landing page powinien pokazac dla Genius@Content

Wizual:

- ekran `Run Flow` z grafem,
- ekran `Prompts` z czterema shotami,
- pionowy render preview 9:16,
- per-shot cards: Zoe open, Elena response, Zoe reaction, Elena CTA,
- podglad `scene-contract.json`,
- asset cards z wygenerowanymi frames/promptami.

Copy:

- "Turn scripts and raw footage into inspectable AI video job packs."
- "Every prompt, scene rule, reference, and output is saved as a local artifact."
- "Built for operators who need control before generation."

---

## 6. Aplikacja 2: Genius@Brains

### Jednozdaniowy opis

`Genius@Brains` analizuje komentarze YouTube i wybiera najbardziej wartosciowe sygnaly odbiorcow, zeby zamienic je w research, insighty i material dla przyszlych tresci.

### Rola w calym systemie

To warstwa sluchania rynku. Aplikacja odpowiada na pytania:

- co odbiorcy faktycznie komentuja,
- ktore watki maja najwiecej energii,
- gdzie sa spory, bol, pytania i reakcje,
- jakie komentarze warto uzyc jako material do content planningu.

`Genius@Brains` produkuje dane, ktore moga pozniej karmic `Genius@Content`.

### Glowne tryby wejscia

#### Tryb A: Single video

Uzytkownik podaje:

- `videoUrl`,
- albo `videoId`.

Aplikacja:

- rozpoznaje ID video,
- pobiera metadata,
- pobiera komentarze,
- liczy engagement score,
- wybiera top komentarze,
- zapisuje JSON i Markdown.

#### Tryb B: Channel

Uzytkownik podaje:

- `channelUrl`, np. `https://www.youtube.com/@openai`.

Aplikacja:

- rozwiazuje kanal,
- pobiera upload playlist,
- bierze do 50 kandydatow,
- odrzuca live, niepubliczne i Shorts-like video,
- sortuje po `viewCount`,
- wybiera top 5 video,
- dla kazdego video pobiera i rankuje komentarze.

### Glowne okna dla designera

#### Okno 1: Comments

Najwazniejsze okno dla operatora insightow.

Pokazuje:

- liste top komentarzy,
- autora,
- tekst komentarza,
- engagement score,
- likes,
- replies,
- `whySelected`,
- link do zrodla,
- powiazane video.

Wizualnie:

- komentarze jako zwarte rows,
- score jako mocny chip,
- `whySelected` jako maly signal tag,
- panel artefaktow po prawej.

#### Okno 2: Channels

Okno wyboru i stanu kanalow/video.

Pokazuje:

- wybrane video,
- tytul,
- `viewCount`,
- `commentCount`,
- status,
- powod wyboru, np. `top by viewCount`,
- kanal,
- folder outputu.

To okno powinno dac poczucie, ze system nie bierze przypadkowych komentarzy, tylko wybiera mocne materialy.

#### Okno 3: Insights

Okno syntetyczne.

Obecnie w kodzie jest preview insightow, ktore pokazuje:

- najlepszy komentarz po engagement score,
- liczbe komentarzy,
- laczne likes,
- laczne replies,
- wysokosignalowe watki.

Dla landing page designer moze pokazac przyszlosciowa warstwe:

- topic clusters,
- reusable knowledge cards,
- "audience pain points",
- "content angles",
- "questions worth answering".

### Dane wejsciowe Genius@Brains

```text
input/jobs/*.json
.env with YOUTUBE_API_KEY
videoUrl / videoId / channelUrl
selection settings
ranking weights
output toggles
```

Przykladowy kontrakt job:

```text
source.type = video | channel
selection.topCommentsLimit = 100
selection.commentFetchLimit = 200
selection.channelCandidateLimit = 50
selection.channelSelectedVideosLimit = 5
ranking.likesWeight = 1
ranking.repliesWeight = 3
output.writeRawJson = true
output.writeMarkdown = true
output.writeFlow = true
```

### Dane wyjsciowe Genius@Brains

```text
apps/genius-brains/output/<job-id>/
  job.json
  videos.json
  comments.raw.json
  comments.scored.json
  comments.md
  flow.md

apps/genius-brains/output/all-comments/
  <job-name>.md
```

### Pelny przeplyw video job

```text
┌──────────────┐
│ Job JSON     │
│ video mode   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Resolve video│
│ URL -> ID    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Fetch video  │
│ metadata     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│ Fetch comments           │
│ relevance + time orders  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Merge + normalize        │
│ author/text/likes/reply  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Rank comments            │
│ likes + replies * 3      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Write artifacts          │
│ JSON + Markdown + flow   │
└──────────────────────────┘
```

### Pelny przeplyw channel job

```text
┌──────────────┐
│ Channel URL  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Resolve channel      │
│ @handle / channel ID │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Uploads playlist     │
│ up to 50 candidates  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Filter candidates    │
│ public, no live,     │
│ no shorts <= 90s     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Sort by viewCount    │
│ keep top 5           │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ For each video       │
│ fetch/rank comments  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Output per video     │
│ JSON/MD/flow         │
└──────────────────────┘
```

### Model rankingu komentarzy

Komentarz dostaje:

```text
engagementScore = likeCount * likesWeight + replyCount * repliesWeight
```

Domyslnie:

```text
likesWeight = 1
repliesWeight = 3
```

Dlaczego replies sa wazniejsze:

- odpowiedzi oznaczaja dyskusje,
- dyskusja czesto wskazuje konflikt lub silny temat,
- konflikt i pytania sa lepszym paliwem dla contentu niz same lajki.

Sortowanie:

```text
engagementScore desc
likeCount desc
publishedAt asc
commentId asc
```

`whySelected` moze przyjmowac semantyczne opisy:

- `strong reply activity`,
- `high likes + replies`,
- `high likes`,
- `active discussion`,
- `useful signal`.

### Funkcje Genius@Brains

- `check:youtube`: sprawdza lacznosc z YouTube Data API.
- `scrape --job-file <path>`: wykonuje job scrapingowy.
- `resolve video`: parsuje URL/ID.
- `resolve channel`: obsluguje `@handle` i `/channel/<id>`.
- `fetch comments`: pobiera watki komentarzy.
- `fetch best comments`: pobiera rownolegle `relevance` i `time`, laczy wyniki.
- `filter channel videos`: odrzuca live/shorts/niepubliczne.
- `rank comments`: liczy score.
- `write JSON`: deterministyczny zapis.
- `write Markdown`: plik czytelny dla operatora.
- `write flow`: run summary.

### Co landing page powinien pokazac dla Genius@Brains

Wizual:

- ekran `Comments` z komentarzami i score,
- ekran `Channels` z wybranymi filmami,
- mini wykres `likes + replies -> signal`,
- karta "Top audience signal",
- link do zrodla komentarza.

Copy:

- "Find the comments worth building content around."
- "Rank YouTube comments by visible audience energy, not opaque relevance alone."
- "Export structured JSON and readable Markdown for downstream creative work."

---

## 7. Aplikacja 3: Genius@Scale

### Jednozdaniowy opis

`Genius@Scale` przygotowuje content do publikacji: waliduje wpisy, generuje kalendarz, wykonuje dry-runy, maskuje sekrety i publikuje wybrane posty na Threads przez jawna komende CLI.

### Rola w calym systemie

To warstwa kontroli publikacji. Dzieki niej output z `Genius@Content` i sygnaly z `Genius@Brains` moga stac sie zaplanowanymi postami z historia walidacji i publikacji.

`Genius@Scale` ma byc bezpieczne:

- dry-run domyslnie nie publikuje,
- publish wymaga jawnego `--item`,
- sekrety sa trzymane w `.env`,
- artefakty sa redaktowane,
- brak publicznych URL-i blokuje realna publikacje mediow.

### Glowne okna dla designera

#### Okno 1: Calendar

Najbardziej wizualne okno `Genius@Scale`.

Pokazuje:

- widok miesiaca,
- widok nadchodzacych postow,
- statusy: draft, ready, dry_run_ok, published, failed,
- filtry platform/status,
- selected post panel,
- asset previews,
- latest run summary.

W landing page mozna pokazac to jako publishing command center.

#### Okno 2: Runs

Okno historii operacyjnej.

Pokazuje:

- dry-run history,
- publish history,
- walidacje,
- status `ok`, `blocked`, `failed`,
- komunikat,
- sciezke do artefaktu,
- masked secret references,
- response/error payload preview.

#### Okno 3: Assets

Okno gotowosci assetow.

Pokazuje:

- `localPath`,
- `publicUrl`,
- `altText`,
- typ: image/video,
- czy asset jest gotowy do publish,
- mapowanie lokalne vs publiczne.

To jest wazne, bo Threads API wymaga publicznie dostepnych URL-i dla mediow.

### Dane wejsciowe Genius@Scale

```text
input/projects/<project-id>.json
input/content/*.json
.env with THREADS_ACCESS_TOKEN
local assets
public media URLs
```

Project config:

```text
projectId
name
timezone
platforms.threads.threadsUserId
platforms.threads.accessTokenEnv
```

Content item:

```text
id
projectId
title
body
scheduledAt
status
source
assets[]
platforms.threads
history[]
```

### Dane wyjsciowe Genius@Scale

```text
apps/genius-scale/output/
  prepared-items.json
  calendar.json
  calendar.md
  runs/
    <item-id>.<type>.<timestamp>.json
```

### Status model

```text
draft
scheduled
ready
validation_failed
dry_run_ok
publish_blocked
publish_pending
published
failed
```

### Typy postow Threads

`Genius@Scale` obsluguje:

- text,
- image,
- video,
- carousel.

Zasady:

- text: zero assetow,
- image: dokladnie jeden image,
- video: dokladnie jeden video,
- carousel: 2-20 assetow,
- body: 1-500 znakow JavaScript string,
- media publish wymaga `publicUrl`,
- dry-run moze pokazac placeholder `<missing-public-url:asset-id>`.

### Pelny przeplyw prepare/calendar/dry-run

```text
┌─────────────────────┐
│ Project config JSON │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Content item JSON   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Prepare items       │
│ normalize + history │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Validate Threads    │
│ body/assets/options │
└──────────┬──────────┘
           │
           ├───────────────┐
           ▼               ▼
┌──────────────────┐  ┌──────────────────────┐
│ Dry-run payload  │  │ Validation errors    │
│ no publish call  │  │ warnings/blockers    │
└────────┬─────────┘  └──────────┬───────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
          ┌─────────────────────┐
          │ Calendar artifacts  │
          │ calendar.json/md    │
          └─────────────────────┘
```

### Pelny przeplyw publish Threads

```text
┌─────────────────────┐
│ publish --item <id> │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Load project/items  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Resolve .env token  │
│ accessTokenEnv      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Validate publish    │
│ status + URLs       │
└──────────┬──────────┘
           │
           ├─────────────── blocked ───────────────┐
           │                                        ▼
           ▼                              ┌───────────────────┐
┌─────────────────────┐                   │ Write run artifact│
│ Create container(s) │                   │ publish_blocked   │
└──────────┬──────────┘                   └───────────────────┘
           │
           ▼
┌─────────────────────┐
│ Publish container   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Redact response     │
│ update calendar     │
└─────────────────────┘
```

### Funkcje Genius@Scale

- `prepare`: normalizuje content itemy i zapisuje `prepared-items.json`.
- `calendar`: generuje `calendar.json` i `calendar.md`.
- `dry-run`: waliduje itemy, buduje payloady Threads bez publikacji, zapisuje run artifacts.
- `publish --item <id>`: publikuje dokladnie jeden item.
- `check:threads`: sprawdza Threads user id, token env i API reachability.
- `buildThreadsDryRunPayload`: buduje requesty bez realnych container IDs.
- `buildThreadsCreateRequests`: buduje requesty dla text/image/video/carousel.
- `publishContentItem`: tworzy kontenery Threads i publikuje finalny container.
- `redactArtifactSecrets`: usuwa sekrety z outputow.

### Bezpieczenstwo i transparentnosc

To powinno byc mocno pokazane na landing page:

- tokeny nigdy nie sa zapisane do artefaktow,
- `publish` jest item-scoped,
- `dry-run` nie dotyka API publikacji,
- brak URL mediow blokuje realny publish,
- outputy sa deterministic JSON/Markdown,
- historia itemu zawiera kazdy prepare/dry-run/publish.

### Co landing page powinien pokazac dla Genius@Scale

Wizual:

- miesieczny kalendarz z postami,
- selected post panel,
- status chips,
- asset readiness,
- dry-run result,
- publish history,
- masked token row.

Copy:

- "Validate before publishing."
- "Dry-run every post, inspect every payload, publish one item at a time."
- "Built for public media URLs, local previews, and auditable Threads output."

---

## 8. End-to-end przeplyw calego systemu

Ten diagram powinien byc jedna z glownych sekcji landing page.

```text
┌──────────────────────┐
│ YouTube video/channel│
│ audience comments    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Genius@Brains        │
│ score/select signals │
└──────────┬───────────┘
           │ comments.scored.json / comments.md
           ▼
┌──────────────────────┐
│ Content angle        │
│ script / pain point  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Genius@Content       │
│ scene + prompts      │
│ job pack / render    │
└──────────┬───────────┘
           │ rendered asset / content item
           ▼
┌──────────────────────┐
│ Genius@Scale         │
│ validate / dry-run   │
│ calendar / publish   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Threads              │
│ published post       │
└──────────────────────┘
```

### Artifact-first mental model

Kazda aplikacja produkuje pliki, ktore mozna pokazac w Canvas:

```text
Brains -> comments.raw.json, comments.scored.json, comments.md, flow.md
Content -> transcript JSON/MD, scene contract, prompts, job pack, render
Scale -> prepared items, calendar JSON/MD, dry-run/publish run artifacts
Canvas -> read-only preview of everything
```

---

## 9. Landing page visual direction

### Ogolny charakter

Landing page ma wygladac jak produkt dla profesjonalnego operatora contentu:

- spokojny,
- gleboki,
- precyzyjny,
- premium,
- technicznie wiarygodny,
- nie przesadnie startupowy.

### Unikac

- abstrakcyjnych gradientow bez UI,
- stockowych ludzi przy laptopie,
- hero z pustym haslem,
- generycznych kart SaaS,
- "AI magic" bez przeplywu danych,
- kolorowej zabawkowosci.

### Preferowac

- realny cockpit UI,
- ASCII/data-flow inspired visual language,
- status chips,
- pliki i artefakty,
- lokalne sciezki,
- prompt previews,
- timeline,
- calendar,
- Git/open-source footer.

### Kolory

Bazowac na `Rose Slate`:

```text
Paper background: #F5F3EF
Elevated panel:   #FBF8F4
Cool surface:     #F4F7F6
Primary ink:      #1F1F23
Secondary slate:  #57585D
Rose ash rule:    #DCC6CF
Accent wine:      #8F4150
Accent wash:      #F2E6EA
Cool teal:        #C7D7D7
Success olive:    #6E8A63
Warning ochre:    #C58A32
Critical wine:    #B84D5A
```

### UI motifs

Designer powinien uzyc:

- sidebar navigation,
- compact panels,
- status chips,
- monospace metadata,
- JSON/MD file labels,
- graph edges,
- node cards,
- 9:16 phone preview,
- calendar cells,
- run cards,
- prompt cards,
- artifact drawers.

---

## 10. Konkretne sekcje funkcjonalne na landing page

### Feature block: Read your audience

App: `Genius@Brains`

Pokazac:

- YouTube comments source,
- top comments by score,
- likes/replies signal,
- channel selection,
- Markdown/JSON output.

Suggested microcopy:

```text
Stop guessing. Pull real comments, rank discussion energy, and turn audience friction into content angles.
```

### Feature block: Build inspectable AI video packs

App: `Genius@Content`

Pokazac:

- scene contract,
- four-shot plan,
- Zoe/Elena persona references,
- Nano Banana first/last frame prompts,
- Veo request payloads,
- Remotion preview.

Suggested microcopy:

```text
Every short is a folder: script, scene rules, references, prompts, audio notes, edit brief, and generated assets.
```

### Feature block: Publish with control

App: `Genius@Scale`

Pokazac:

- content item,
- validation,
- dry-run,
- calendar,
- publish run,
- masked secrets.

Suggested microcopy:

```text
Preview locally, validate constraints, dry-run payloads, then publish exactly one item when it is ready.
```

### Feature block: Preview without mutation

Layer: `Genius Canvas`

Pokazac:

- Canvas shell,
- app switcher,
- tabs,
- run list,
- metrics,
- detail view.

Suggested microcopy:

```text
Canvas is the safe cockpit: inspect local artifacts, compare run states, and debug the pipeline without triggering side effects.
```

---

## 11. App-by-app landing cards

### Card: Genius@Brains

Headline:

```text
Audience intelligence from real comments.
```

Bullets:

- Scrape single videos or channels.
- Select top public long-form videos by view count.
- Fetch comments by relevance and recency.
- Score by likes and reply activity.
- Export JSON, Markdown, and run flow docs.

Mini graph:

```text
YouTube -> comments -> score -> top signals -> content angles
```

### Card: Genius@Content

Headline:

```text
AI video production as inspectable artifacts.
```

Bullets:

- Clean transcripts with Whisper/Gemini fallback.
- Build research-backed storyboard and choreography.
- Generate scene contracts and prompt packs.
- Prepare Nano Banana and Veo payloads.
- Render 9:16 Remotion compositions.

Mini graph:

```text
Script/video -> scene contract -> prompts -> assets -> render
```

### Card: Genius@Scale

Headline:

```text
Publishing control with dry-runs first.
```

Bullets:

- Normalize content items.
- Validate Threads text, image, video, carousel rules.
- Generate calendar artifacts.
- Write dry-run and publish histories.
- Mask secrets before artifacts reach preview.

Mini graph:

```text
Content item -> validate -> dry-run -> calendar -> publish
```

---

## 12. Suggested homepage layout wire narrative

```text
┌─────────────────────────────────────────────────────────────┐
│ HERO                                                        │
│ G@CLight Genius Suite                                      │
│ Open-source content pipeline for AI-native creators         │
│ [Open source] [Local-first] [Artifact-first]                │
│ Large Canvas cockpit visual                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ THREE APPS, ONE PIPELINE                                    │
│ Brains -> Content -> Scale                                  │
│ Cards with mini graphs                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ GENIUS CANVAS COCKPIT                                       │
│ Read-only preview screenshot / interactive mock             │
│ App tabs + sub tabs + run list + metrics                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DEEP DIVE: GENIUS@BRAINS                                    │
│ Comments / Channels / Insights                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DEEP DIVE: GENIUS@CONTENT                                   │
│ Run Flow / Prompts / Render Preview                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DEEP DIVE: GENIUS@SCALE                                     │
│ Calendar / Runs / Assets                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ OPEN SOURCE + LOCAL ARTIFACTS                               │
│ JSON/MD contracts, auditable runs, Git workflow             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FOOTER                                                      │
│ Git/GitHub icon required                                    │
│ Open source project | Repo | Docs | Issues | License        │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Copy bank dla designera

### Hero options

```text
G@CLight Genius Suite
Open-source content pipeline for AI-native creators.
```

```text
From audience signal to published post.
All artifacts visible. All steps inspectable.
```

```text
An open-source operating system for content research, AI video production, and publishing control.
```

### Short value props

```text
Listen to your market through real YouTube comments.
```

```text
Turn scripts into scene contracts, prompt packs, and render-ready assets.
```

```text
Dry-run social publishing before anything goes live.
```

```text
Inspect every file, prompt, run, and payload in a local preview cockpit.
```

### Open-source footer copy

```text
G@CLight Genius Suite is an open-source project. Fork it, inspect the pipeline, and build your own content operating system.
```

Footer requirement:

```text
[Git/GitHub icon] Open source project
```

---

## 14. Required visual proof points

Landing page should not rely only on text. It should visibly show:

- the three app tabs in Canvas,
- a ranked comment list,
- a 4-shot AI Studio job pack,
- a scene contract or prompt payload,
- a 9:16 render preview,
- a publishing calendar,
- a dry-run/publish status,
- a Git/GitHub icon in the footer.

Suggested screenshot/mock compositions:

1. Hero: Canvas cockpit wide desktop screenshot.
2. Brains block: comments table with scores.
3. Content block: prompt-to-output sequence.
4. Scale block: calendar + selected post inspector.
5. Open source block: file tree + Git icon.

---

## 15. Najwazniejsze zasady dla designera

- Pokazuj produkt jako jeden system, nie trzy losowe narzedzia.
- Uzywaj realnych nazw aplikacji: `Genius@Brains`, `Genius@Content`, `Genius@Scale`.
- `Genius Canvas` pokazuj jako wspolny cockpit preview.
- Od razu komunikuj open source.
- Ikona Git/GitHub musi byc na dole strony.
- Pokazuj artefakty: JSON, Markdown, prompts, flows, calendar.
- Pokazuj przeplywy, nie tylko funkcje.
- UI ma byc gesta, spokojna i profesjonalna.
- Nie rob marketingowego landing page bez produktu na ekranie.
- Glowny visual powinien byc kokpitem, nie ilustracja.

---

## 16. Finalna synteza produktu

`G@CLight Genius Suite` to open-source, local-first, artifact-first pipeline dla tworcow AI-native.

`Genius@Brains` znajduje sygnaly w komentarzach odbiorcow.

`Genius@Content` zamienia sygnaly, skrypty i video w scene contracts, prompty, job-packi i rendery.

`Genius@Scale` waliduje, planuje, robi dry-runy i publikuje content na Threads.

`Genius Canvas` pokazuje calosc jako bezpieczny, read-only cockpit.

Najmocniejszy przekaz landing page:

```text
Open-source content operations, from audience intelligence to AI video production to controlled publishing.
```
