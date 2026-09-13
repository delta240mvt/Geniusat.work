# Prywatne dane

Kod aplikacji, lokalne fonty z licencjami, ikony oraz sztuczne dane testowe mogą być wersjonowane. Materiały użytkownika są przechowywane lokalnie:

- `.genius/`: konta, zaszyfrowane klucze, biblioteka publikacji, kolejka i kopie.
- `.env*`, pliki kluczy i katalogi credentials/secrets: konfiguracja dostępu. Publiczne przykłady muszą zawierać wyłącznie puste pola lub wartości demonstracyjne.
- `apps/*/input/`, `apps/*/reels/`, `apps/*/output/`: nagrania, scenariusze, transkrypcje, analizy i eksporty. Sprawdzone pliki `sample-*.json` w katalogach wejściowych Brains i Scale są wyjątkami.
- `apps/*/public/input/`, `public/reels/`, `public/research/`: kopie materiałów używane przez lokalny podgląd.
- `apps/genius-content/AI Studio/`, `market_research/`, `.firecrawl/`: referencje postaci, prywatne skrypty, strategia i research.
- Logi, cache, ustawienia edytorów, robocze notatki oraz archiwalny katalog `template1_uix_CC/`.

`.gitignore` działa na pliki, których Git jeszcze nie śledzi. Wcześniej śledzony plik trzeba usunąć z indeksu przez `git rm --cached`, zachowując go na dysku. Takie usunięcie będzie częścią następnego commita.

Przed udostępnieniem repozytorium sprawdź też historię. Usunięte pliki pozostają w poprzednich commitach, branchach i tagach. Sam commit z nowym `.gitignore` nie wystarcza. Można opublikować nowy projekt ze sprawdzonych plików i bez starej historii albo osobno przeprowadzić jej czyszczenie. Zmiana historii współdzielonego repozytorium wymaga uzgodnienia z osobami, które mają jego kopie.

Jeśli rzeczywisty klucz został wcześniej udostępniony, unieważnij go u dostawcy. Usunięcie z Git nie unieważnia klucza.

Przed commitem `git ls-files -ci --exclude-standard` powinno zwrócić pusty wynik. Nie używaj `git add -f` do prywatnych katalogów. Nie wysyłaj lokalnych kopii kontrolnych z `.genius/`.
