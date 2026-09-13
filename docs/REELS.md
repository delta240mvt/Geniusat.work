# Studio rolek

Studio działa lokalnie pod `http://127.0.0.1:4188/`. Uruchom je przez `npm.cmd run genius -- start` albo `npm.cmd run studio`.

Wybierz „Nowa rolka”, dodaj nagranie z biblioteki i dopracuj sceny. Po zapisaniu zmian przycisk „Eksportuj MP4” tworzy film przez Hyperframes. „Zaplanuj lub opublikuj” przekazuje gotowy materiał do schedulera.

Eksport jest lokalny: Hyperframes 0.8.36, GSAP, H.264/AAC, 1080 × 1920 i 30 fps. Hyperframes nie wymaga klucza API. Nowe transkrypcje korzystają z lokalnego Whisper. Potrzebny jest FFmpeg/ffprobe; pierwsze renderowanie może pobrać przeglądarkę.

Nagrania i opcjonalne gotowe transkrypcje należą do `apps/genius-content/input/`. Lokalne presety można zapisać jako tablicę projektów w `input/featured-reels.json`; `npm.cmd run reels:seed` dodaje tylko brakujące projekty. Gdy presetów nie ma, studio zaczyna z pustą biblioteką. Walidację scenariusza określa `src/reels/model.ts`.

Edytowalne projekty są w `apps/genius-content/reels/`, podglądy w `public/reels/`, a gotowe filmy w `output/renders/`. Wszystkie te dane są wykluczone z Git. Testy używają sztucznych transkrypcji i nie potrzebują nagrań użytkownika.

Opcjonalny moduł AI Studio wymaga własnego katalogu `apps/genius-content/AI Studio/` z konfiguracją, scenariuszami i referencjami postaci. Ten prywatny katalog nie jest częścią repozytorium. Schematy konfiguracji znajdują się w `src/ai-studio/config/schema.ts`.
