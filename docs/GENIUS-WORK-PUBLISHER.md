# GENIUS@WORK — publikacje i konfiguracja

Stan: 13.09.2026, branch `baza130926-new`. Aplikacja i scheduler działają na `http://127.0.0.1:4188`. Skrót na pulpicie uruchamia proces w tle. Zamknięcie przeglądarki nie zatrzymuje kolejki. Wyłączenie lub uśpienie komputera wstrzymuje publikacje; po ponownym uruchomieniu zaległe zadania są podejmowane.

## Podłączenie Cloudflare R2

Jedynym hostingiem mediów jest **Cloudflare R2**. W „Konta i klucze → Hosting mediów” wpisz nazwę swojego bucketu i jego publiczny adres. Ustawienia tej instalacji pozostają w lokalnym magazynie `.genius/`.

Aplikacja używa istniejącej sesji Wrangler OAuth. Nie trzeba wklejać kolejnego tokenu Cloudflare. Wrangler odświeża sesję podczas pobierania tokenu; token pozostaje po stronie lokalnego serwera. Jeśli sesja zostanie odwołana, uruchom `npx.cmd wrangler login`.

W **Konta i klucze → Hosting mediów** można sprawdzić połączenie, podłączyć publiczny bucket lub utworzyć nowy. Konfigurator nie upublicznia istniejącego prywatnego bucketu. Upload przez OAuth/REST obsługuje do 300 MB na plik; większe filmy wymagają opcjonalnych kluczy S3 R2 z prawem zapisu/odczytu bucketu, dostępnych w opcjach ręcznych. Wysyłane są materiały wybrane do publikacji potrzebującej publicznego URL. Cała biblioteka pozostaje lokalna.

Publiczny adres `r2.dev` ma limity ruchu. Przy większym ruchu podłącz własną domenę R2 i zmień adres w hostingu. [Publiczne buckety R2](https://developers.cloudflare.com/r2/data-access/public-buckets/), [Wrangler auth token](https://developers.cloudflare.com/changelog/post/2025-12-18-wrangler-auth-token/), [limit REST upload](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/upload/).

## Dane platform społecznościowych

Wybierz platformę w UI, podaj nazwę konta oraz identyfikator i sekret aplikacji, zapisz i kliknij **Połącz przez OAuth**. Alternatywnie dodaj token w opcjach zaawansowanych. API key YouTube do komentarzy nie pozwala wysyłać filmów.

| Platforma | Dane aplikacji | Konto i dostęp |
|---|---|---|
| Instagram | Meta App ID i App Secret | Profesjonalny Instagram połączony ze stroną Facebook; `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish` |
| Facebook | Meta App ID i App Secret | Strona Facebook i prawo zarządzania publikacjami; `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` |
| Threads | Threads App ID i App Secret | `threads_basic`, `threads_content_publish`; token testera można wygenerować w panelu Meta |
| TikTok | Client Key i Client Secret | Login Kit Desktop + Content Posting API; `user.info.basic`, `video.upload`; Direct Post wymaga też `video.publish` |
| YouTube Shorts | Google OAuth Client ID i Client Secret | YouTube Data API v3; klient OAuth Web z lokalnym redirectem; `youtube.upload`, `youtube.readonly`; konto z kanałem |

Domyślny adres powrotu: **`http://127.0.0.1:4188/api/publisher/oauth/callback`**. Wpisz go dokładnie w panelu aplikacji. Dla TikToka wybierz Login Kit Desktop. Dla Google w trybie Testing dodaj konto do test users; token odświeżania może w tym trybie wygasnąć po siedmiu dniach.

Threads wymaga HTTPS dla OAuth. Dla własnego konta testera możesz użyć tokenu wygenerowanego w panelu Meta. Pełny OAuth wymaga przekierowania publicznego HTTPS wyłącznie na `/api/publisher/oauth/callback` i wpisania adresu w zaawansowanym polu **Adres powrotu OAuth** oraz w Meta. Pozostałe API pozostaje lokalne; callback sprawdza jednorazowy stan. R2 udostępnia pliki, nie realizuje callbacków OAuth.

Scheduler odświeża tokeny YouTube i TikToka, jeśli otrzymał refresh token, oraz długi token Threads przed wygaśnięciem. Facebook/Instagram mogą wymagać ponownego połączenia po odwołaniu dostępu lub zmianie uprawnień.

## Formaty

| Format | Instagram | Threads | Facebook Pages | TikTok | YouTube Shorts |
|---|---|---|---|---|---|
| Rolka / wideo | Tak | Tak | Tak | Tak | Pion/kwadrat do 3 min |
| Karuzela | 2–10 zdjęć/filmów przez API | 2–20 zdjęć/filmów | 2+ zdjęcia | 2–35 zdjęć | Brak formatu |
| Pojedynczy wpis | Zdjęcie lub film | Tekst, zdjęcie lub film | Tekst, zdjęcie lub film | Zdjęcie lub film | Tylko film |

Biblioteka przygotowuje zgodne JPEG, zachowując oryginalne zdjęcia. Kolejność zmieniasz przeciąganiem lub strzałkami. Walidacja sprawdza format, liczbę mediów, długość opisu, czas filmu, konta i hosting przed wysyłką.

**TikTok:** domyślnie film trafia do skrzynki twórcy; kończysz publikację w aplikacji TikTok. Direct Post wymaga uprawnień, ustawienia widoczności zwróconego przez konto, świadomej zgody oraz weryfikacji aplikacji. Wytyczne TikToka wykluczają z akceptacji publicznego Direct Post narzędzia przeznaczone wyłącznie do własnych kont lub zespołu. Nie da się zastąpić tego dodaniem kluczy. Nowe niezweryfikowane integracje mają ograniczenia, w tym prywatność. [Wytyczne TikTok](https://developers.tiktok.com/doc/content-sharing-guidelines/).

Zdjęcia TikToka wymagają zweryfikowanego adresu mediów. W panelu TikTok dodaj URL Prefix bucketu, pobierz plik `tiktok….txt`, prześlij go w hostingu GENIUS@WORK, potwierdź weryfikację w TikToku i zapisz zweryfikowany prefix w UI.

**YouTube:** filmy przesyłane przez nowe, niezweryfikowane projekty API pozostają prywatne do czasu audytu. Publiczne Shorts wymagają przejścia tego procesu. [YouTube videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert). Meta również kontroluje dostęp przez role testerów, stan aplikacji i przyznane uprawnienia.

## Terminal i AI

```powershell
npm.cmd run genius -- start
npm.cmd run genius -- status
npm.cmd run genius -- upload "C:\filmy\rolka.mp4"
npm.cmd run genius -- import "apps/genius-content/output/renders/delta-modele-ai-hyperframes.mp4"
npm.cmd run genius -- create docs/examples/publication.json
npm.cmd run genius -- schedule ID 2026-09-20T12:00:00+02:00
npm.cmd run genius -- publish ID
npm.cmd run genius -- cancel ID
npm.cmd run genius -- retry ID
npm.cmd run genius -- stop
```

W przykładowym JSON podmień `assetIds` i `accountIds` na identyfikatory z `status`. `create` zapisuje szkic; `publish` i `schedule` wykonują rzeczywiste wysyłki. `retry` ponawia tylko nieudane wysyłki, nigdy wyniku niepewnego. Daty podawaj z offsetem; aplikacja zapisuje UTC i wyświetla lokalną strefę.

`account -` i `hosting -` przyjmują JSON na stdin. Pliki z sekretami nazywaj `*.local.json`, aby Git je ignorował. Nie przekazuj tokenów w argumentach. API zapisujące dane wymaga `X-Genius-Local: 1`; serwer sprawdza też Host i Origin. `status` zawiera nazwy ustawionych pól, nigdy sekrety.

## Trwałość i weryfikacja

`.genius/` zawiera kolejkę, media, logi i zaszyfrowane klucze; zachowaj ten katalog przy aktualizacji. Zapisy są atomowe, rewizje wykrywają konflikt edycji, blokada procesu zapobiega dwóm schedulerom. Niepewna wysyłka trafia do **Sprawdź wynik**, aby uniknąć duplikatu. Każde konto ma osobny rezultat.

Logi: `.genius/server.log`, `.genius/server-error.log`. Sekrety Windows używają DPAPI bieżącego użytkownika; przeniesienie ich na inne konto Windows wymaga ponownego połączenia integracji.

E2E HTTP używa prawdziwych lokalnych serwerów z kontrolowanymi odpowiedziami pięciu platform: upload, szkic, kolejka, przetwarzanie i końcowy wynik. Realny test R2 obejmuje upload przez OAuth i publiczny odczyt. Rzeczywiste publikacje społecznościowe wymagają jeszcze danych aplikacji i zalogowania kont.
