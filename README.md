# GENIUS@WORK

Lokalne studio animowanych rolek i publikacji. Twórz z nagrań w bibliotece, eksportuj przez Hyperframes, a następnie przeciągnij materiał na kalendarz. Scheduler obsługuje Instagram, Threads, Facebook Pages, TikTok i YouTube Shorts, zgodnie z formatami dostępnymi w ich API.

## Uruchomienie

Otwórz skrót **GENIUS@WORK** na pulpicie albo w terminalu:

```powershell
npm.cmd run genius -- start
```

Aplikacja: **http://127.0.0.1:4188/**. Serwer i kolejka pracują w tle po zamknięciu karty. Komputer musi być włączony; po ponownym uruchomieniu aplikacja podejmuje zaległe zadania. `npm.cmd run genius -- stop` kończy bieżącą wysyłkę i zatrzymuje aplikację. `CANVAS_PORT` zmienia port.

Pierwsza instalacja wymaga Node.js 22+, npm, FFmpeg/ffprobe z filtrami `zscale`, `tonemap`, `loudnorm`, następnie `npm.cmd install` i `npm.cmd run desktop:install`. Python z `openai-whisper` jest potrzebny tylko do nowych transkrypcji. `npm.cmd run dev` uruchamia serwer w bieżącym terminalu.

## Jak pracować

- **Rolki** — wybierz nagranie, edytuj sceny i napisy, obejrzyj podgląd, eksportuj MP4. **Zaplanuj lub opublikuj** przenosi film do publikacji.
- **Publikacje → Kalendarz** — przeciągnij materiał na dzień, wybierz konta i godzinę. Przeciągnięcie zaplanowanego wpisu zmienia dzień.
- **Nowa publikacja** — dodaj pliki z dysku lub studia, ułóż slajdy, wybierz rolkę, karuzelę albo pojedynczy wpis. Szkic można zapisać przed podłączeniem kont.
- **Kolejka** — wynik osobno dla każdej platformy, anulowanie terminu i ponowienie nieudanych wysyłek.
- **Konta i klucze** — dane aplikacji i OAuth lub ręczny token. Sekrety są szyfrowane lokalnie i nie wracają do interfejsu.

Hosting mediów korzysta wyłącznie z **Cloudflare R2**. Istniejąca sesja **Wrangler OAuth** pozwala skonfigurować bucket i przesyłać pliki do 300 MB bez dodatkowych kluczy Cloudflare. Opcjonalne klucze S3 R2 obsługują większe pliki. Media trafiają do publicznego bucketu, kiedy platforma potrzebuje URL.

Instrukcje: [publikacje, R2 i konta](docs/GENIUS-WORK-PUBLISHER.md), [studio animowanych rolek](docs/REELS.md).

## Własne nagrania

Nowa instalacja zaczyna z pustą biblioteką. Dodaj własne nagranie przez studio lub CLI. Nagrania, transkrypcje, scenariusze i eksporty pozostają lokalne.

```powershell
npm.cmd run pipeline -- "input/moje-nagranie.MOV" --prepare
npm.cmd run reels -- --id moje-nagranie
npm.cmd run genius -- help
npm.cmd run genius -- status
```

AI może zarządzać szkicami, plikami, terminami i publikacją przez CLI z wynikiem JSON. Przykład: [publication.json](docs/examples/publication.json). W PowerShell używaj `npm.cmd` do flag po `--`, ponieważ wrapper `npm.ps1` może je przechwytywać.

## Klucze

Do montażu i eksportu nie potrzeba kluczy. R2 można podłączyć przez sesję Wrangler OAuth. Do publikacji dodaj identyfikatory i sekrety aplikacji Meta/Threads, TikTok i Google OAuth, a następnie zaloguj konta w UI. Wymagania i weryfikację aplikacji opisuje [instrukcja konfiguracji](docs/GENIUS-WORK-PUBLISHER.md). Platformy mogą wymagać audytu przed publiczną publikacją; TikTok oferuje też tryb dokończenia publikacji w swojej aplikacji.

Opcjonalne funkcje korzystają z `.env`: `GEMINI_API_KEY` (korekta napisów), `FIRECRAWL_API_KEY` (research), `YOUTUBE_API_KEY` (komentarze). `GOOGLE_SERVICE_ACCOUNT_JSON` dotyczy dodatkowej analizy Google Cloud. Istniejącego `.env` nie nadpisuj. `npm.cmd run doctor` sprawdza zależności i obecność konfiguracji bez płatnych zapytań.

## Weryfikacja i dane

```powershell
npm.cmd run workspace:typecheck
npm.cmd run workspace:test
```

Testy obejmują montaż, napisy, Hyperframes, zgodność zapisanych projektów, szkice, drag and drop, trwałą kolejkę, odświeżanie tokenów, OAuth, R2 i pełny przepływ HTTP przez pięć adapterów publikacji. Testy społecznościowe używają lokalnych serwerów testowych; rzeczywista publikacja wymaga podłączonych kont.

`.genius/` zawiera bibliotekę publikacji, kolejkę, logi i zaszyfrowane sekrety; jest wyłączony z Git. Na Windows sekrety są powiązane z użytkownikiem przez DPAPI. Zachowaj ten katalog przy aktualizacji. Stare projekty i kalendarz Threads są w **Archiwum i narzędzia**. Analiza komentarzy pozostaje osobnym widokiem.

## Dane prywatne i Git

Repozytorium zawiera kod i sztuczne dane testowe. `.gitignore` wyklucza `.env`, klucze, `.genius/`, nagrania, projekty rolek, wyniki analiz, AI Studio, research oraz lokalne logi. Nie dodawaj tych plików przez `git add -f`. Wyjątkami są sprawdzone pliki `.env.example` i `sample-*.json` z danymi demonstracyjnymi.

Wykluczenie i usunięcie pliku z indeksu nie usuwa go ze starszych commitów. Przed otwarciem istniejącego repozytorium trzeba osobno oczyścić historię lub opublikować nowy projekt z czystą historią. Instrukcja: [prywatne dane](docs/PRIVATE-DATA.md).
