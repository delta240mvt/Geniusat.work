# Studio rolek

Studio działa lokalnie pod `http://127.0.0.1:4188/`. Uruchom je przez `npm.cmd run genius -- start` albo `npm.cmd run studio`.

Wybierz „Nowa rolka”, dodaj nagranie z biblioteki i dopracuj sceny. Po zapisaniu zmian przycisk „Eksportuj MP4” tworzy film przez Hyperframes. „Zaplanuj lub opublikuj” przekazuje gotowy materiał do schedulera.

## Animacje i podgląd na żywo

Podgląd odtwarza nagranie z dźwiękiem, a warstwy tekstu, okien i szkła składa w przeglądarce na bieżąco. Suwaki nie uruchamiają eksportu ani kodowania wideo. Oś czasu pozwala przeskakiwać między scenami i chwilami filmu. Niezapisane zmiany są zachowywane w przeglądarce; przycisk „Zapisz animacje” zapisuje projekt i odświeża kompozycję. Dopiero „Eksportuj MP4” uruchamia render Hyperframes.

Inspektor ma osobne ustawienia tytułów i napisów z transkrypcji: czcionkę (`delta240mvt_font Bold` lub Inter), sposób wejścia, krzywą ruchu, czas, przesunięcie, rozmiar, odstępy liter, pozycję i cień. Napisy mogą narastać w kolejnych pozycjach albo zastępować się w jednym miejscu. Parametry mowy pozwalają dostroić opóźnienie i czas widoczności słowa.

Opcja „Tylko wideo i napisy” ukrywa nagłówek i grafikę sceny. „Napisy na Liquid Glass” daje czarny tekst bez cienia nad szkłem. Napisy są osobną warstwą nad oknami i Liquid Glass, także w podglądzie Hyperframes. Zmiany suwaków przeliczają również zatrzymaną klatkę.

Projekt może zawierać pełnoekranowe plansze marki `#00D6D8`. Ich granice wypadają na początku słowa, a każde słowo występuje tylko na jednym rodzaju kadru. Plansza ukrywa okna, wyświetla jeden wyraz pośrodku bez cienia i bez zanikania; na osi czasu widać ją jako turkusowy pasek. Ustawienia referencyjne transkrypcji to `delta240mvt_font Bold`, 120 px, tracking −10,2 px i linia 0,805.

Do sceny można dodać Finder, Safari, edytor, terminal i dużą taflę Liquid Glass. Każde okno ma własną treść, pozycję, rozmiar, czas na osi, wejście i wyjście, krzywą ruchu, prędkość pojawiania się treści oraz parametry szkła. Tafla ma dodatkowe suwaki intensywności miękkiego cienia, bieli ramki i jej wtapiania. Uchwyty w podglądzie służą do przesuwania i zmiany rozmiaru okna. Okna są składane z komponentów w czasie odtwarzania; nie wymagają nagrania ekranu macOS.

W trybie stosu każda trzywyrazowa fraza zajmuje stałe pozycje: wyświetlone słowa nie przesuwają się podczas wejścia kolejnego. Odstępy są korygowane według widocznych granic glifów czcionki.

Podgląd i eksport używają tej samej kompozycji HTML/CSS/GSAP. Przeglądarka odtwarza ją podczas edycji, a Hyperframes próbuje te same chwile filmu przy eksporcie. Zachowanie refrakcji Liquid Glass zależy od silnika przeglądarki i GPU, więc przed publikacją należy obejrzeć gotowy MP4.

Eksport jest lokalny: Hyperframes 0.8.36, GSAP, H.264/AAC, 1080 × 1920 i 30 fps. Hyperframes nie wymaga klucza API. Nowe transkrypcje korzystają z lokalnego Whisper. Potrzebny jest FFmpeg/ffprobe; pierwsze renderowanie może pobrać przeglądarkę.

Nagrania i opcjonalne gotowe transkrypcje należą do `apps/genius-content/input/`. Lokalne presety można zapisać jako tablicę projektów w `input/featured-reels.json`; `npm.cmd run reels:seed` dodaje tylko brakujące projekty. Gdy presetów nie ma, studio zaczyna z pustą biblioteką. Walidację scenariusza określa `src/reels/model.ts`.

Edytowalne projekty są w `apps/genius-content/reels/`, podglądy w `public/reels/`, a gotowe filmy w `output/renders/`. Wszystkie te dane są wykluczone z Git. Testy używają sztucznych transkrypcji i nie potrzebują nagrań użytkownika.

Opcjonalny moduł AI Studio wymaga własnego katalogu `apps/genius-content/AI Studio/` z konfiguracją, scenariuszami i referencjami postaci. Ten prywatny katalog nie jest częścią repozytorium. Schematy konfiguracji znajdują się w `src/ai-studio/config/schema.ts`.
