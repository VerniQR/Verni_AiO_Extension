# Verni_AiO_Extension v1.12.240 - Copy/Paste Text combined + position fix

## v1.12.240

- Polaczono CopyText i PasteText w jeden modul `jsx/modules/copy_paste.jsx`, zeby ograniczyc ladowanie po stronie Premiere.
- Poprawiono tryb `Styl + pozycja`: PasteText przenosi teraz nie tylko payload `Source Text`, ale tez parametry komponentu Type Tool, m.in. `Position`, `Scale`, `Rotation` i `Anchor Point`.
- Log PasteText pokazuje teraz `Layout=...`, czyli ile parametrow pozycji/ukladu zostalo faktycznie przepisanych.

# Verni_AiO_Extension v1.12.239 - Copy/Paste Text cleanup + optional position

## v1.12.239

- Wyczyszczono martwy kod po testach Copy/Paste Text: usunieto Style Probe, stare fallbacki `setValue`, probe JSON/MOGRT i legacy PasteText.
- CopyText pyta teraz przed kopiowaniem, czy przeniesc rowniez pozycje/uklad tekstu.
- PasteText dalej zachowuje tekst docelowy, ale w zaleznosci od wyboru z Copy zachowuje pozycje targetu albo przenosi pozycje ze zrodla.
- Finalna metoda nadal dziala przez backup `.prproj`, patch `StartKeyframeValue` i ponowne otwarcie projektu.

# Verni_AiO_Extension v1.12.238 - Copy/Paste Text prproj patch + reopen

## v1.12.238

- PasteText nie zapisuje juz pelnego binarnego `Source Text` przez `ComponentParam.setValue`, bo Premiere przyjmuje wywolanie jako OK, ale wizualnie kasuje tekst.
- PasteText robi kopie bezpieczenstwa `.prproj`, podmienia `StartKeyframeValue` bezposrednio w pliku projektu i probuje zamknac oraz otworzyc projekt ponownie przez API Premiere.
- Backup ma nazwe `*_verni_textpaste_backup_YYYYMMDD_HHMMSS.prproj` obok projektu.
- Ta wersja testuje droge dyskowa, ktora odpowiada temu, co reczny Paste stylu zapisuje w `.prproj`.

# Verni_AiO_Extension v1.12.237 - Copy/Paste Text Type Tool blob experiment

## v1.12.237

- CopyText zapisuje projekt i czyta pelny zakodowany payload `Source Text` z `.prproj` dla zaznaczonej grafiki Type Tool.
- PasteText sklada nowy payload: styl ze zrodla + tekst i metryka pola z klipu docelowego, a potem probuje zapisac go przez `Source Text`.
- Algorytm zostal zweryfikowany na parach `BEFORE/AFTER.prproj` i `BEFORE_2/AFTER_2.prproj`: wynikowy blob jest bajt-w-bajt taki sam jak po recznym Paste stylu w Premiere.
- To nadal tryb eksperymentalny: najwazniejszy test to czy Premiere przyjmie pelny blob przez `setValue` podczas pracy panelu.

# Verni_AiO_Extension v1.12.236 - Copy/Paste Text safe Source Text diagnostics

## v1.12.236

- Wylaczono zapis ukrytego `Source Text` tokenu w PasteText, bo test v1.12.235 pokazal, ze usuwa/zmienia tresc grafiki zamiast przenosic styl tekstu.
- CopyText pomija teraz ukryty `Source Text` token i zapisuje to w logu jako `hiddenSourceTextSkipped`.
- Rozszerzono log CopyText o konkretne nazwy kopiowanych parametrow, typ wartosci, kolor, keyframe'y i podglad wartosci.
- PasteText loguje, ze `Source Text hidden-token` jest wylaczony po tescie.

# Verni_AiO_Extension v1.12.235 - Copy/Paste Text hidden Source Text test

## v1.12.235

- Potwierdzono, ze ProjectItem `Text Style` i komendy Linked Styles nie sa wystawione przez publiczne CEP/ExtendScript w Premiere 26.2.2.
- CopyText kopiuje teraz tylko realne parametry stylowe oraz `Source Text`, zamiast brac wszystkie pola z komponentu `Text`.
- PasteText najpierw probuje bezpiecznego wariantu JSON/MOGRT, a gdy Premiere zwraca tylko zakodowany pojedynczy znak, wykonuje kontrolowany test `Source Text hidden token setValue`.
- Log PasteText pokazuje `beforeChars`, `sourceChars` i `afterChars`, zeby ocenic czy ukryty token stylu daje sie przenosic bez pliku `Style`.
- Ten tryb jest eksperymentalny: pierwszy test nalezy wykonac na duplikacie/kopii klipu.

# Verni_AiO_Extension v1.12.234 - Style Probe komendy Linked Styles

## v1.12.234

- Rozszerzono probe komend o dokladne klucze znalezione w zasobach Premiere 2026: `CreateParentStyleAction`, `SetParentStyleAction`, `PushToParentStyleAction`, `StyleBrowserView/CreateStyle`, `SetAsLinkedStyle...` oraz `ExportTextStyle`.
- Ta wersja tylko sprawdza `findMenuCommandId`; niczego nie wykonuje i nie zmienia projektu.
- Celem jest potwierdzenie, czy Linked Styles ma jakakolwiek cicha komende dostepna przez CEP/ExtendScript.

# Verni_AiO_Extension v1.12.233 - Style Probe videoComponents / Linked Styles

## v1.12.233

- Rozszerzono `Style Probe` o wywolanie `videoComponents()` na zaznaczonym ProjectItem `Text Style`.
- Probe pokazuje teraz takze `getProjectColumnsMetadata()` oraz dodatkowe wyniki metod ProjectItem dla stylu.
- Celem jest sprawdzenie, czy payload stylu tekstu jest dostepny przez ukryte komponenty pliku `Text Style`.

# Verni_AiO_Extension v1.12.232 - Style Probe Deep / Linked Styles

## v1.12.232

- Rozszerzono `Logi Premiere Pro / Style Probe` o glebszy podglad plikow `Text Style` tworzonych przez `Linked Styles -> Save to Project`.
- `AFTER` pokazuje teraz metadata/XMP/reflect nowego ProjectItem typu Style oraz zaznaczonego elementu w Project Panelu.
- Dla parametru `Source Text` probe wypisuje kilka wariantow `getValue(...)` / `getValueAtTime(...)` razem z kodami znakow, zeby sprawdzic czy Premiere ukrywa pelny styl w innym wariancie wartosci.
- Ta wersja sluzy tylko do zebrania brakujacych danych pod docelowe CopyText/PasteText bez automatycznego klikania UI.

# Verni_AiO_Extension v1.12.231 - Style Probe / Logi Premiere Pro

## v1.12.231

- Dodano panel diagnostyczny `Logi Premiere Pro / Style Probe` przy dolnych logach.
- `BEFORE` zapisuje stan projektu, zaznaczenia timeline, komponentow tekstu/MOGRT i dostepnych komend Premiere przed reczna akcja.
- `AFTER` robi drugi snapshot i porownuje go z `BEFORE`, pokazujac nowe ProjectItemy oraz zmienione parametry.
- `COPY LOG` kopiuje pelny log z panelu, zeby latwo odeslac wynik diagnostyki.
- Celem tej wersji jest ustalenie, czy Linked Styles / plik Style da sie pozniej odtworzyc kodem bez klikania UI.

# Verni_AiO_Extension v1.12.230 - Transform bez legacy Copy/Paste

## v1.12.230

- Usunieto stare mechaniki CopyText/PasteText z `jsx/modules/transform_tools.jsx`.
- `transform_tools.jsx` odpowiada teraz tylko za Motion -> Transform oraz Shutter Angle.
- Osobne moduly `jsx/modules/copy_text.jsx` i `jsx/modules/paste_text.jsx` zostaja bez zmian jako baza do dalszej przebudowy Copy/Paste.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.229 - CopyText MGT + wider style scan

## v1.12.229

- CopyText skanuje teraz zarowno standardowe `clip.components`, jak i `clip.getMGTComponent()`.
- Rozszerzono kopiowanie parametrow stylu: dla komponentow tekstowych/graficznych kopiowane sa wszystkie sensowne parametry poza ruchem/pozycja/skala/rotacja.
- PasteText pokazuje w logu wynik dla kazdego klipu: ile komponentow dopasowano i ile parametrow zapisano.
- To ma obsluzyc przypadki, w ktorych Premiere/MOGRT nie nazywa parametrow wprost jako font/color/stroke.

# Verni_AiO_Extension v1.12.228 - CopyText/PasteText attribute clipboard

## v1.12.228

- CopyText nie probuje juz tworzyc projektowego pliku `Style`.
- CopyText kopiuje atrybuty tekstu/grafiki bezposrednio z zaznaczonego klipu na timeline do wewnetrznego schowka.
- PasteText naklada skopiowane atrybuty na zaznaczone grafiki/teksty przez `ComponentParam` (`getValue`, `setValue`, `getColorValue`, `setColorValue`).
- Dla `Source Text` moduł probuje zachowac docelowa tresc tekstu, kopiujac styl: font, rozmiar, wypelnienie, obrys, cien i podobne parametry.

# Verni_AiO_Extension v1.12.227 - CopyText Style API probe

## v1.12.227

- CopyText probuje teraz takze ukrytych metod Premiere zwiazanych z `StyleProjectItem` / `CreateParentStyle`.
- Rozszerzono diagnostyke CopyText o liste metod i wlasciwosci `Style/Text/Graphic`, ktore Premiere faktycznie wystawia w ExtendScript.
- Logi CopyText/PasteText sa ASCII-only, zeby uniknac krzakow typu `Ňā` po stronie CEP.

## v1.12.226

- Usunieto automatyzacje UI/AppleScript dla CopyText.
- Dodano osobne moduly `jsx/modules/copy_text.jsx` i `jsx/modules/paste_text.jsx`.
- CopyText/PasteText dzialaja tylko przez dostepne komendy/API Premiere (`findMenuCommandId`/`executeCommand`) bez rozwijania paneli i klikania myszka.

## v1.12.225

- Zmieniono CopyText: zamiast tymczasowego obiektu w pamieci funkcja odpala natywne Linked Styles -> Create Style -> Save to Project i przenosi nowy plik Style do binu VerniAiO.

## v1.12.224

- Skrocono Auto-Sync folderow do 5 sekund.
- Podmieniono przyciski Transform/Shutter i dodano CopyText/PasteText na dolnym pasku.
- Dodano grupowanie dolnych przyciskow pionowym separatorem.
- Dodano tymczasowe kopiowanie i wklejanie atrybutow tekstu/grafiki z timeline.

## v1.12.223
- Organizer projektu tworzy teraz glowny BIN `VerniAiO`.
- Biny `AE Dynamic Relink`, `External Extension` i `NEST` sa tworzone/przenoszone jako pod-biny wewnatrz `VerniAiO`.
- Jezeli stare docelowe biny istnieja juz na glownym poziomie Project Panelu, organizer probuje przeniesc je do `VerniAiO` zamiast tworzyc puste duplikaty.
- Same reguly segregowania plikow pozostaja bez zmian.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.222 - MULTI-NEST snapshot undo hotfix

## v1.12.222
- Naprawiono blad cofania MULTI-NEST, w ktorym panel sprawdzal funkcje jako `AEDRNO.multiNestUndoPrepareOne:0` zamiast `AEDRNO.multiNestUndoPrepareOne`.
- `requiredFn` jest teraz staly, a numer kroku batcha trafia tylko do klucza logowania.
- Jezeli cofanie nie rozpocznie zadnego realnego rozpakowania, snapshot MULTI-NEST nie jest czyszczony i mozna sprobowac ponownie.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.221 - MULTI-NEST snapshot undo

## v1.12.221
- Przycisk cofania nadal jest jeden i wybiera ostatnia operacje: `MULTI-NEST` albo `UN NEST`.
- MULTI-NEST zapisuje teraz snapshot utworzonych NEST-ow: sekwencja rodzica, track, start, typ oraz sekwencja zrodlowa NEST-a.
- Cofanie MULTI-NEST nie uzywa juz wielu krokow historii Premiere; rozpakowuje zapisane NEST-y od konca do poczatku przez natywny flow UN NEST/copy-paste.
- Po cofnieciu snapshot ostatniego MULTI-NEST jest czyszczony, zeby drugi klik nie ruszal przypadkowych zmian.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.220 - MULTI-NEST collapses opposite media range

## v1.12.220
- MULTI-NEST przed wstawieniem NEST-a ustawia zakres mediow ProjectItem jako video-only albo audio-only.
- Dla video-only NEST dostaje normalny zakres video, ale audio w tym samym ProjectItem jest zwijane do `0-0`, zeby Premiere nie mialo czego automatycznie polozyc na A1.
- Timeline audio nadal nie jest czyszczone ani odtwarzane po fakcie; poprawka nie uzywa blokowania/odblokowywania sciezek.
- Log pokazuje teraz `przygotowalem NEST projectItem video-only`.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.219 - MULTI-NEST video-only leaves audio untouched

## v1.12.219
- MULTI-NEST video-only nie usuwa juz zadnych elementow z audio timeline po insercie.
- Priorytetem jest zachowanie audio 1:1 bez zmian: zaznaczone video tworzy video-NEST-y, a audio zostaje nietkniete.
- Log pokazuje teraz `video-only - nie usuwam nic z audio timeline`.
- Poprawka nadal nie uzywa blokowania/odblokowywania sciezek.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.218 - MULTI-NEST videoTrack-first insert

## v1.12.218
- MULTI-NEST video-only wstawia NEST najpierw przez `videoTrack.overwriteClip`, a nie `sequence.overwriteClip(..., V, -1)`, bo ten drugi wariant potrafil naruszac audio.
- Wylaczono automatyczne restore oryginalnego audio po cleanupie, poniewaz restore przez Premiere potrafil wstawic dlugi linked video ze zrodla i uszkodzic V1.
- Zostaje tylko cleanup nowego pustego audio-counterparta po insercie. Oryginalne audio nie jest celowo ruszane ani odtwarzane.
- Poprawka nadal nie uzywa blokowania/odblokowywania sciezek.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.217 - MULTI-NEST restore without linked video

## v1.12.217
- Restore oryginalnego audio po video-only MULTI-NEST nie uzywa juz `audioTrack.overwriteClip`, bo Premiere potrafil przez to wstawic linked video ze zrodla.
- Restore audio wymusza teraz `sequence.overwriteClip(projectItem, time, -1, audioTrack)`.
- Dodano safety cleanup po restore: jezeli Premiere mimo wszystko dorzuci nowe video/audio po stronie NEST-a, zostanie usuniete, a wlasciwy NEST zostanie zachowany.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.216 - MULTI-NEST restore original audio

## v1.12.216
- MULTI-NEST po usunieciu pustego audio/video-counterparta sprawdza snapshot sprzed inserta i przywraca oryginalne przeciwlegle klipy, ktore Premiere nadpisalo podczas wstawiania NEST-a.
- Poprawka zachowuje zalozenie: bez blokowania i odblokowywania sciezek, zeby nie zasmiecac historii Premiere krokami lock/unlock.
- Logi pokazuja teraz `restore original opposite po cleanupie` z liczba przywroconych i juz istniejacych oryginalow.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.215 - MULTI-NEST silent diff cleanup

## v1.12.215
- MULTI-NEST video-only/audio-only dostal cleanup roznicowy po insercie: przed wstawieniem NEST-a zapamietuje przeciwlegle tracki w tym oknie czasu, a po insercie usuwa tylko nowe counterparty, ktorych wczesniej nie bylo.
- Poprawka nie blokuje ani nie odblokowuje zadnych sciezek, wiec nie dodaje lock/unlock krokow do historii Premiere.
- Oryginalne audio/video z timeline jest zachowywane przez dopasowanie po projectItem/nodeId i pozycji czasowej.
- Logi pokazuja teraz `diff baseline przed insertem` i `diff cleanup po insercie`.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.214 - MULTI-NEST silent track purge

## v1.12.214
- MULTI-NEST nie klika juz widocznego menu `Clip > Nest` i nie wysyla automatycznego Entera do dialogow Premiere.
- Glowna operacja znowu dzieje sie cicho w ExtendScript: jeden zaznaczony TrackItem tworzy jeden osobny NEST.
- Video-only uzywa teraz najpierw `sequence.overwriteClip(..., V, -1)`, audio-only `sequence.overwriteClip(..., -1, A)`, aby nie wskazywac przeciwleglych trackow.
- Nowy cleanup usuwa przeciwlegle klipy z NEST-a oraz probuje usunac cale przeciwlegle tracki w NEST-cie przez QE DOM, z logiem `purge opposite tracks`.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.213 - MULTI-NEST native menu flow

## v1.12.213
- MULTI-NEST native dziala teraz krokowo: JSX zaznacza jeden klip, panel klika w Premiere `Clip > Nest`, zatwierdza dialog i wraca po kolejny klip.
- Poprawka omija problem, w ktorym `app.findMenuCommandId("Nest")` nie zwracal komendy Nest w tej instalacji Premiere.
- Logi pokazuja teraz etapy `MULTI-NEST native menu START`, `Panel ma teraz kliknac Clip > Nest` oraz wynik `Native menu OK/FAIL`.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.212 - MULTI-NEST native rewrite

## v1.12.212
- MULTI-NEST zostal napisany od zera: nie uzywa juz `createSubsequence` ani recznego `overwriteClip`.
- Nowy tryb dziala jak seria natywnych operacji Premiere: wykrywa zaznaczone TrackItemy, zaznacza pojedynczo tylko jeden klip i uruchamia natywna komende `Nest`.
- Zaznaczone video jest nestowane jako video-only, zaznaczone audio jako audio-only; modul nie dobiera sam przeciwleglych audio/video z timeline.
- Panel podczas operacji automatycznie zatwierdza natywne okno nazwy NEST-a Enterem, a potem zmienia nazwy utworzonych sekwencji na `Mutli-NEST 1`, `Mutli-NEST 2` itd.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.211 - MULTI-NEST strict insert cleanup

## v1.12.211
- MULTI-NEST video-only/audio-only ma teraz dodatkowe czyszczenie po insercie oparte o snapshot timeline przed/po, a nie tylko o nazwe `Mutli-NEST`.
- Poprawka celuje w przypadek, w ktorym Premiere po `videoTrack.overwriteClip` dorzucal silent audio na wiele sciezek A1-A13 mimo braku audio w zaznaczeniu.
- Logi MULTI-NEST pokazuja teraz `strict baseline`, `strict cleanup po overwrite` i `strict cleanup po restore`, z liczba usunietych nowych TrackItemow.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.210 - MULTI-NEST strict selected-only

## v1.12.210
- MULTI-NEST tworzy teraz osobny NEST dla kazdego zaznaczonego TrackItemu: video i audio nie sa juz laczone w jedna grupe nawet przy identycznym oknie czasowym.
- Video-only MULTI-NEST zostawia tylko wybrane video, usuwa obce video/audio z nowej subsekwencji i usuwa przypadkowo wstawiony audio-counterpart z glownej sekwencji.
- Audio-only MULTI-NEST zostawia tylko wybrane audio, nie rusza video poza zaznaczeniem i usuwa przypadkowo wstawiony video-counterpart z glownej sekwencji.
- Poprawka dotyczy przypadku, w ktorym Premiere dodawal puste/ciche sciezki audio po zrobieniu MULTI-NEST na samych klipach video.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.209 - External Extension Premiere Composer Files keyword

## v1.12.209
- Do domyslnych slow kluczowych zakladki `Segregowanie plikow zewnetrznych wtyczek` dodano `Premiere Composer Files`.
- Organizer bedzie teraz przenosil do BIN-u `External Extension` takze pliki/itemy oraz cale BIN-y pasujace do `Premiere Composer Files`.
- Zachowano no-op scan fix z v1.12.208, czyli skan nie wykonuje `moveBin`, jesli nie ma nic nowego do przeniesienia.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.207 - External Extension bins move

## v1.12.207
- Segregowanie plikow zewnetrznych wtyczek przenosi teraz nie tylko pliki/itemy, ale tez cale BIN-y o nazwach pasujacych do slow kluczowych: `Atom`, `Motion Graphics Template Media`, `FireCut`, `Premiere Composer Files`.
- Trafienia binow sa przenoszone do glownego BIN-u `External Extension` i oznaczane w logu jako `[BIN] ...`.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.207 - External Extension organizer

## v1.12.207
- Dodano w module **Segregowanie plików w Projekcie** pomarańczową pod-zakładkę **Segregowanie plików zewnętrznych wtyczek**.
- Nowa kategoria tworzy/przenosi elementy do BIN-u **External Extension**.
- Domyślne słowa kluczowe: **Atom**, **Motion Graphics Template Media**, **FireCut**, **Premiere Composer Files**.
- Organizer obsługuje teraz trzecią kategorię obok **NEST** i **AE Dynamic Relink**.

## v1.12.205

- MULTI-NEST video-only/audio-only ma twardsze zabezpieczenie przeciwleglych trackow podczas wstawiania NEST-a.
- Przy video-only na czas wstawiania blokowane sa audio tracki, zeby Premiere nie kasowal linked audio i nie robil dziur na A1.
- Przy audio-only na czas wstawiania blokowane sa video tracki, zeby Premiere nie kasowal linked video i nie robil dziur na V1.
- Po wstawieniu blokady trackow sa przywracane do poprzedniego stanu.

## v1.12.203
- MULTI-NEST video-only/audio-only insert uzywa teraz najpierw `videoTrack.overwriteClip` albo `audioTrack.overwriteClip`, zamiast `sequence.overwriteClip`, bo Premiere potrafil mimo targetowania wstawic linked A+V i nadpisac oryginalne counterpart clips.
- Video-only powinien tworzyc NEST tylko na video i nie robic dziur w A1.
- Audio-only powinien tworzyc NEST tylko na audio i nie robic dziur w V1.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.202 - MULTI-NEST A/V strict separation

## v1.12.202
- MULTI-NEST: po wstawieniu NEST-a usuwa z glownej sekwencji niechciany counterpart, ktory Premiere potrafi automatycznie dodac mimo targetowania.
- Video-only MULTI-NEST usuwa ewentualny pusty/nadmiarowy audio NEST z A-trackow.
- Audio-only MULTI-NEST usuwa ewentualny video NEST z V-trackow, zostawiajac video na glownej sekwencji bez ruszania.
- ZIP ma nazwe z wersja, a w srodku folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.202 - MULTI-NEST audio-only fix

## v1.12.202
- MULTI-NEST audio-only: gdy zaznaczone jest tylko audio, stworzony NEST jest czyszczony z video wewnatrz subsekwencji, a video w sekwencji glownej zostaje bez ruszania.
- Audio-only cleanup usuwa tez obce audio z nowej subsekwencji, zostawiajac zaznaczone audio po nazwie/nodeId/dlugosci klipu.
- Zachowano nazwy bez nawiasow: `Mutli-NEST 1`, `Mutli-NEST 2` itd. oraz szybki indeks timeline z v1.12.199.
- ZIP ma nazwe z wersja, ale po rozpakowaniu zawiera folder `Verni_AiO_Extension`.

# Verni_AiO_Extension v1.12.198 - MULTI-NEST order, undo and naming

## v1.12.198
- Zmieniono kolejnosc przyciskow w gornym pasku: UN NEST, MULTI-NEST, cofniecie, MEDIA OFFLINE.
- Przycisk cofania cofa teraz ostatnio uzyty modul: UN NEST albo MULTI-NEST, w zaleznosci od ostatniej operacji.
- MULTI-NEST zapisuje payload cofania historii Premiere i ma funkcje AEDRNO.undoLastMultiNestByHistory.
- NEST-y tworzone przez MULTI-NEST nazywaja sie teraz `Mutli-NEST (1)`, `Mutli-NEST (2)` itd.

## v1.12.197
- MULTI-NEST: naprawiono przypadek, w ktorym `seq.getSelection()` zwracalo 2 elementy, ale nie byly one identycznymi obiektami jak `track.clips[x]`, przez co moduł odrzucal zaznaczenie.
- Dodano dopasowanie zaznaczonych TrackItemow po start/end + name/nodeId, a nie tylko po referencji obiektu.
- Dodano czytelniejsze logi: ile elementow zwrocilo `seq.getSelection()` i ile realnie dopasowano do trackow.

# Verni_AiO_Extension v1.12.196 - MULTI-NEST selected-state fix

## v1.12.196
- Naprawiono MULTI-NEST: fallback detekcji zaznaczenia nie uznaje juz kazdego TrackItemu z metoda `isSelected` za zaznaczony.
- Ograniczono czyszczenie zaznaczenia do znanych zaznaczonych klipow, zamiast skanowac cala sekwencje przy kazdym NEST-cie.
- ZIP ma nazwe z wersja, ale po rozpakowaniu zawiera folder `Verni_AiO_Extension`.

## v1.12.195
- Naprawiono MULTI-NEST: wykrywanie zaznaczenia na timeline obsluguje teraz kolekcje Premiere z `numItems`, nie tylko `length`.
- Dodano fallback skanu TrackItemow po stanie selected, gdy klikniecie panelu CEP powoduje pusta odpowiedz `seq.getSelection()`.
- Dodano logi diagnostyczne: ile elementow zwrocilo `seq.getSelection()` i ile znalazl fallback.

## v1.12.193

- Naprawiono regresje: przycisk MULTI-NEST zniknal z gornego paska po loader fixie.
- Przywrocono element `multiNestBtn` w `index.html`, obok MEDIA OFFLINE.
- Zostawiono loader fix z v1.12.192 dla `AEDRNO.multiNestSelectedClips`.

## v1.12.192
- Naprawiono brak funkcji `AEDRNO.multiNestSelectedClips` po kliknieciu MULTI-NEST.
- Dodano top-level direct loader dla `jsx/modules/multi_nest.jsx`, analogicznie do MEDIA OFFLINE, z diagnostyka loadera w logach.
- MULTI-NEST przed uruchomieniem wymusza zaladowanie `host.jsx` i bezposrednio `multi_nest.jsx`, zeby funkcja zostala globalnie dostepna w ExtendScript.

# Verni_AiO_Extension v1.12.190 - UN NEST multicam hard guard + cleaner debug

## v1.12.190
- UN NEST: dodano twardszy bezpiecznik przed usuwaniem sekwencji z Project Panelu, także dla nazw z literówką typu `MUTLICAM`.
- UN NEST: przed delete sprawdzane są nazwy sekwencji, ProjectItem, klipu oraz payloadu; jeśli wskazują multicam/mutlicam, sekwencja zostaje w projekcie.
- UN NEST: debug nie wypisuje już ogromnego payloadu `prePasteSnapshot` z setkami wpisów WAV/TrackItem w linii `evalScript start`. Log pokazuje krótkie podsumowanie payloadu.
- UN NEST: pasek postępu pokazuje realne etapy flow copy/paste zamiast pozostawać na 0% do końca.

- UN NEST: dodano dodatkowe zabezpieczenie przed usuwaniem sekwencji NEST z Project Panelu, gdy zaznaczony NEST jest multicamem / multicam source sequence.
- Wykrywanie multicam sprawdza teraz więcej wariantów API/properties TrackItem/ProjectItem/Sequence oraz bezpieczny fallback po nazwie multicam/multi-camera.
- Zwykłe NEST-y bez multicam nadal są usuwane z Project Panelu po udanym UN NEST.


## v1.12.187
- Poprawiono pozycjonowanie czasu na przycisku STOPER: tekst jest teraz centrowany przez pelnoszeroki overlay (`left:0; right:0; width:100%`), bez przesuniecia przez `translateX(-50%)` i bez minimalnej szerokosci.


## v1.12.187
- Zmniejszono wszystkie przyciski graficzne o ok. 20% przez CSS, bez tworzenia dodatkowych wersji PNG.
- Wycentrowano tekst timera na przycisku STOPER.
- Folder icon/ pozostaje uporzadkowany: tylko aktualne PNG przyciskow.

## v1.12.184
- Podmieniono komplet grafik przyciskow w `icon/` na nowe PNG uzytkownika.
- Usunieto stare/duplikowane PNG przyciskow z `icon/`, zostawiajac tylko aktualne: MEDIA_OFFLINE, REVERSE, SHUTTER, STOPER, TRANSFORM, UNNEST.
- Naprawiono splaszczony przycisk cofania UN NEST przez uzycie wykadrowanej wersji `REVERSE.png` i zachowanie proporcji obrazu.

## v1.12.183
- Uporzadkowano assety przyciskow do folderu `icon/`.
- Podmieniono glowne PNG: MEDIA_OFFLINE, REVERSE, SHUTTER, STOPER, TRANSFORM, UNNEST.
- Shutter otwiera modal z wpisaniem wartosci 0-360 zamiast inputu na przycisku.
- Timer projektu jest tekstem po prawej stronie przycisku STOPER i nie jest klikalny.

# Verni_AiO_Extension v1.12.182 - Media Offline scan loop fix

## v1.12.182
- MEDIA OFFLINE: naprawiono skanowanie, ktore wchodzilo w macOS User Library / Trial / revlinks i przez petle/symlinki dobijalo do limitu folderow bez znalezienia pliku.
- Skan CEP/Node przechodzi teraz BFS po priorytetowych lokalizacjach: stary folder offline media, folder nadrzedny, Desktop, Downloads, Documents, Movies/Videos, Pictures, Music, home oraz dyski zewnetrzne.
- Dodano pomijanie symlinkow, realpath visited-set oraz pomijanie /Users/*/Library, cache, hidden/system folders.
- Pasek MEDIA OFFLINE nie pompuje juz procentu za liczbe przeskanowanych folderow; procent rosnie tylko po realnie znalezionych brakujacych nazwach i po zakonczonych etapach.


## v1.12.181
- Naprawiono krytyczny problem loadera MEDIA OFFLINE: modul mogl raportowac `Loader: MEDIA OFFLINE functions OK`, ale funkcje znikaly przy kolejnym `evalScript`, bo `$.evalFile()` byl odpalany wewnatrz wrappera funkcji ExtendScript. Loader i globalny safe eval dzialaja teraz top-level, dzieki czemu `AEDRNO.getOfflineMediaListForCEP` i `AEDRNO.relinkOfflineMediaFromMap` zostaja w globalnym namespace.
- Zachowano minimalizowanie overlayu postepu i podglad aktualnie skanowanego folderu dla MEDIA OFFLINE.

## v1.12.180

- Dodano maly przycisk minimalizacji w prawym gornym rogu overlayu postepu, zeby podczas trwania akcji dalo sie odczytac i skopiowac logi.
- Po minimalizacji pasek postepu pokazuje sie jako maly panel u gory wtyczki i nie blokuje reszty UI.
- Dla MEDIA OFFLINE dodano pod paskiem postepu podglad aktualnie skanowanego folderu oraz listy szukanych nazw plikow.
- MEDIA OFFLINE najpierw pobiera z Premiere liste brakujacych/offline mediow, a potem skanuje komputer tylko pod katem dokladnych nazw brakujacych plikow.
- Dodano relinkowanie po mapie znalezionych kandydatow i dodatkowe logi diagnostyczne skanowania.

## v1.12.179

- Przywrócono stabilną bazę działania panelu z v1.12.177 po regresji z v1.12.178.
- Cofnięto eksperymentalne skanowanie MEDIA OFFLINE po stronie CEP/Node, które mogło zatrzymywać inicjalizację panelu.
- Zostawiono przycisk MEDIA OFFLINE i loader fix.
- Poprawiono globalny pasek postępu: usunięto sztuczne automatyczne dobijanie 0-92%. Pasek pokazuje teraz tylko etapy ustawiane przez moduły i kończy na 100% po odpowiedzi Premiere.

- Naprawiono regresje z v1.12.176: przycisk MEDIA OFFLINE zniknal z gornego paska, bo w `index.html` zabraklo elementu `mediaOfflineBtn`.
- Przywrocono przycisk z grafika `media_offline_button.png`.
- Zachowano loader fix z v1.12.176: wymuszone ladowanie `host.jsx` i `media_offline_relink.jsx` przed wywolaniem `AEDRNO.relinkOfflineMediaQuick`.

- Naprawiono problem: `AEDRNO.relinkOfflineMediaQuick` nie bylo widoczne po stronie ExtendScript.
- Przycisk MEDIA OFFLINE wymusza teraz przeladowanie `host.jsx` oraz bezposrednie doladowanie `jsx/modules/media_offline_relink.jsx` przed startem relinku.
- Dodano diagnostyke loadera do logow: `Loader: host.jsx reload OK`, `Loader: media_offline_relink.jsx direct load OK`, `MODULE LOAD ERRORS`, `FATAL`.
- Dzieki temu kolejny debug pokaze dokladna przyczyne, jezeli Premiere/CEP nadal nie zaladuje modulu.

# Verni_AiO_Extension v1.12.174 - Transform button updated PNG

- Podmieniono przycisk Transform na najnowszy przesłany plik PNG.
- Przygotowano osobny, ostry asset pod docelowy rozmiar w panelu.
- Zachowano poprawkę hovera opartą o obrazek `<img>`, żeby CEP nie nakładał szarego natywnego przycisku.

# Verni_AiO_Extension v1.12.174 - Transform button from PNG reference

- Wdrożono nowy przycisk Transform na podstawie dostarczonej grafiki PNG.
- Zmniejszono i dopasowano układ dolnego paska Transform.
- Odświeżono wygląd kontrolki Shutter, aby lepiej pasowała do nowego przycisku.

# Verni_AiO_Extension v1.12.174 - Compact Transform Glass Controls

- Zmieniono dolny przycisk Transform na kompaktowy glass pill o stałej szerokości.
- Ujednolicono kontrolkę Shutter z tym samym jasnym, szklanym stylem.
- Funkcjonalność bez zmian.

# Verni_AiO_Extension v1.12.174 - Transform Glass Button

- Przycisk Transform przeprojektowany jako jasny, szklany pill zgodnie z przesłanym wzorem.
- Zmieniono ikonę na minimalistyczny romb.
- Funkcjonalność bez zmian.

# Verni_AiO_Extension v1.12.174 - Transform Button iOS Redesign

- Przeprojektowano dolny przycisk Transform w nowocześniejszym stylu inspirowanym iOS.
- Usunięto napis Motion → Transform z przycisku.
- Funkcjonalność bez zmian.

# Verni_AiO_Extension v1.12.174 - Auto-Sync Single Startup Enable

- Auto-Sync po sprawdzeniu JSON-a jest włączany tylko raz.
- Automatyczne włączenie następuje dopiero na końcu wczytywania ustawień projektu.
- Usunięto zdublowany komunikat logu o automatycznym włączeniu Auto-Sync.

# Verni_AiO_Extension v1.12.174 - Quick Tools Scroll Clip Fix

- Poprawiono układ górnych przycisków UN NEST / cofnięcia / timera.
- Środkowa przewijana zawartość nie wjeżdża już pod górne przyciski podczas scrollowania.
- Górny pasek narzędzi jest teraz częścią układu panelu, a scroll zaczyna się dopiero pod nim.

# Verni_AiO_Extension v1.12.174 - Auto-Sync Auto Enable After JSON Check

- Auto-Sync nadal startuje jako wyłączony na czas kontroli JSON-a projektu.
- Po poprawnym sprawdzeniu JSON-a i ewentualnej naprawie ścieżek/liter dysków Auto-Sync włącza się automatycznie.
- Jeśli brakuje dysku lub folderu, Auto-Sync zostaje wyłączony i zablokowany do ręcznego wskazania ścieżki.

# Verni_AiO_Extension v1.12.174 - Auto-Sync Startup Gate

- Auto-Sync startuje zawsze jako wyłączony przy otwarciu panelu/projektu.
- Przy starcie wtyczka czyta JSON projektu, próbuje naprawić litery dysków/ścieżki po nazwie woluminu i zapisuje poprawki do JSON-a.
- Przełącznik Auto-Sync jest blokowany do czasu zakończenia sprawdzania ścieżek.
- Jeśli dysk/folder nie zostanie znaleziony, Auto-Sync zostaje wyłączony i użytkownik musi ręcznie wskazać nową ścieżkę.

# Verni_AiO_Extension v1.12.174 - Auto-Sync Project JSON Fix

- Naprawiono błąd ładowania modułu Auto-Sync/Timer po filtrze metadanych systemowych.
- Auto-Sync nie korzysta już z fallbacku localStorage dla folderów projektu.
- Foldery Auto-Sync są zapisywane i odczytywane wyłącznie z pliku JSON obok pliku .prproj.
- Konfiguracja folderów zapisuje informacje przenośne oraz ścieżki Windows/macOS.

# Verni_AiO_Extension v1.12.174 - Auto-Sync Metadata Skip

- Auto-Sync pomija teraz ukryte/metadanowe pliki systemowe, m.in. ._*, .DS_Store, Thumbs.db, desktop.ini oraz foldery typu __MACOSX.
- Zapobiega to błędom importu w Premiere przy pracy między macOS i Windows.

# Verni_AiO_Extension v1.12.174 - Auto-Sync Cross-Platform Volume Relink

- Auto-Sync potrafi teraz automatycznie przepiąć ścieżkę z macOS `/Volumes/Nazwa Dysku/...` na Windowsową literę dysku o tej samej nazwie woluminu.
- Przykład: `/Volumes/WK DZIK/PACZKA MONTAZOWA/SFX` -> `E:/PACZKA MONTAZOWA/SFX`, jeżeli wolumin `WK DZIK` jest aktualnie pod literą `E:`.
- Dodałem cache odczytu dysków Windows, żeby Auto-Sync nie odpalał sprawdzania woluminów zbyt często.

# Verni_AiO_Extension v1.12.174 - Transform UI iOS Style Refresh

- Sekcja Transform została przeprojektowana wizualnie w stylu inspirowanym najnowszym iOS.
- Odświeżono wygląd głównego przycisku oraz pola Shutter Angle.
- Funkcjonalność bez zmian, zmodyfikowano wyłącznie UI.

# Verni_AiO_Extension v1.12.174 - Transform UI Apple Style

- Przeprojektowano dolny pasek Transform w nowoczesnym stylu inspirowanym Apple.
- Odświeżono wygląd głównego przycisku Transform oraz pola Shutter Angle.
- Podbito wersję do v1.12.174.

# Verni_AiO_Extension v1.12.144 - Transform Motion Reset Fix

- Poprawiono reset Motion po przeniesieniu keyframe’ów do efektu Transform.
- Position w Motion jest teraz zerowane do wartości znormalizowanej 0.5,0.5, żeby nie uciekało do 32767,0 / 32767,0.
- Motion po transferze jest czyszczony: Position, Scale, Rotation i Anchor Point.
- Podbito wersję do v1.12.144.

# Verni_AiO_Extension v1.12.144 - Transform Tools Bottom Bar

- Podbito wersję do v1.12.144.
- Dodano stały dolny pasek Transform pod główną wtyczką.
- Dodano przycisk przenoszący ustawienia/keyframe’y z Motion do efektu Transform na zaznaczonych klipach.
- Dodano pole Shutter Angle 0-360, którego wartość jest ustawiana w efekcie Transform podczas transferu.

# Verni_AiO_Extension v1.12.144 - Removed New Sequence to NEST Option

- Podbito wersję do v1.12.144.
- Zmniejszono przełączniki iOS na zakładkach, żeby nagłówki wszystkich zakładek miały tę samą wysokość.

## v1.12.144
- Usunięto funkcję przenoszenia każdej nowo utworzonej sekwencji po starcie wtyczki do BIN-u NEST.
- Usunięto tę opcję z UI i z zapisu ustawień.
- Segregowanie NEST działa teraz tylko według słów kluczowych / rozpoznania nazw NEST, bez automatycznego łapania każdej nowej sekwencji.
- Usunięto podsekcję „Ustawienia ogólne” z modułu Segregowanie plików w Projekcie.
- Interwał Auto-Check został ustawiony na stałe na 10 sekund i nie jest już edytowalny z poziomu UI.
- Interwał Auto-Sync został ustawiony na stałe na 15 sekund. Synchronizacja folderów pozostaje sekwencyjna, folder po folderze, bez równoległego uruchamiania.

# Verni_AiO_Extension v1.12.138 - iOS Toggle Controls

- Podbito wersję do v1.12.138.
- Dodano przełączniki iOS na zakładkach Segregowania i Auto-Sync.
- Usunięto ręczne przyciski Auto-Check oraz Auto-Sync zgodnie z nową logiką automatyczną.
- Poprawiono kliknięcie pola Auto-Sync: po kliknięciu „Anuluj” w eksploratorze plików nie otwiera się już drugi fallbackowy dialog wyboru folderu.
- Analogicznie zabezpieczono wybór nowej lokalizacji zaginionego folderu Auto-Sync.

# Verni_AiO_Extension v1.12.136 - AutoSync Click Folder Picker

- Podbito wersję do v1.12.136.
- W Auto-Sync można teraz kliknąć strefę dodawania folderu, aby otworzyć eksplorator plików i wybrać folder.
- Drag & Drop folderów działa jak dotychczas.
- Zmieniono tekst pola na: "Kliknij, albo przeciągnij folder tutaj!".

# Verni_AiO_Extension v1.12.135 - Header Title Removed

- Usunięto widoczny napis `Verni_AiO_Extension` ze środka panelu.
- Zachowano pionowy odstęp nagłówka, żeby zakładki nie podjeżdżały pod przyciski UN NEST / cofania / timer.
- Podbito wersję do v1.12.135.

# Verni_AiO_Extension v1.12.134 - Startup Loading Overlay

- Po uruchomieniu panel pokazuje przyciemnienie i pasek: "Trwa ładowanie wtyczki".
- Overlay znika dopiero po wczytaniu projektowego pliku *_verni_settings.json albo po przygotowaniu fallbacku dla niezapisanego projektu.
- Auto-Sync/Timer startują dopiero po gotowości ustawień projektu.

# Verni_AiO_Extension v1.12.134 - UN NEST Speed Polish - UN NEST Local Video Protect

- Baza: v1.12.134.
- Zmieniono zabezpieczenie video przy UN NEST: nie dodaje juz tracka w srodku timeline i nie podnosi calej osi czasu.
- Teraz zaznacza tylko klipy video, ktore nachodza czasowo na okno rozpakowywanego NEST-a, i przesuwa tylko je wyzej natywnym skrótem Premiere.
- Jesli nie uda sie wykonac lokalnego przesuniecia, wtyczka przerywa przed Paste, zeby nie nadpisac materialu.

# Verni_AiO_Extension v1.12.134 - UN NEST Speed Tuning

- Baza: działająca wersja v1.12.127.
- Przyspieszono natywne skróty UN NEST na macOS przez krótsze pauzy AppleScript.
- Na Windows dodano szybszy mechanizm cscript/VBScript dla Ctrl+C / Ctrl+V / Ctrl+W z fallbackiem do PowerShell.
- Dodano debug pomiarów czasu kroków UN NEST: Copy, Prepare Paste, Paste, Finalize i Close.
- Nie zmieniono głównej logiki UN NEST ani sposobu działania synchronizacji Timecode.

# Verni_AiO_Extension v1.12.127 - Select Labels and Scrollbar Style

- Baza: działająca wersja v1.12.126.
- W synchronizacji podfolderów zmieniono etykiety z `Włącz` / `Wyłącz` na `Włączone` / `Wyłączone`.
- Dopasowano scrollbar globalnych dropdownów do stylu głównego panelu: ciemne tło i gradientowy uchwyt zamiast białego tła.

# Verni_AiO_Extension v1.12.126 - Select Overlay Smart Direction Fix

- Baza: działająca wersja v1.12.125.
- Poprawiono kierunek otwierania globalnych selectów: lista otwiera się w dół tylko gdy pod selectem mieści się co najmniej 5 pozycji; przy 4 lub mniej otwiera się do góry.
- Naprawiono selecty Auto-Sync typu Włącz/Wyłącz podfoldery, żeby przy małej ilości miejsca nie pojawiały się na środku panelu.
- Zachowano kompaktową szerokość i czcionkę z v1.12.125.

# Verni_AiO_Extension v1.12.125 - Global Select Overlay Polish

- Baza: działająca wersja v1.12.124.
- Dopieszczono globalny overlay dla wszystkich rozwijanych list w panelu CEP.
- Dropdown ma teraz szerokość dokładnie jak zamknięty select, mniejszą czcionkę i kompaktowe opcje.
- Drugi klik w ten sam select zamyka listę.
- Scroll myszką wewnątrz otwartej listy nie zamyka jej automatycznie.
- Poprawka dotyczy wszystkich selectów: Timecode, Split Screen, Auto-Sync kolory i podfoldery.

# Verni_AiO_Extension v1.12.123 - Timecode Video Keeps Camera Audio

- Baza: działająca wersja v1.12.121.
- Synchronizacja po Timecode w trybie Tylko wideo pomija pliki audio-only/WAV już na etapie planowania.
- Synchronizacja po Timecode w trybie Tylko audio pomija pliki video/video+audio już na starcie, zamiast wstawiać video i usuwać je po fakcie.
- Tryb Both bez zmian: ZOOM/WAV idzie blokowo na górę, audio z kamer pod spodem.

# Verni_AiO_Extension v1.12.121 - UN NEST Video Only bez spamowania historii blokadami

- Baza: działająca wersja v1.12.120.
- UN NEST nadal pomija audio z NEST-ów video/audio-video.
- Usunięto tymczasowe blokowanie/odblokowywanie audio tracków podczas paste, bo zaśmiecało historię Premiere.
- Zabezpieczenie opiera się na targetowaniu video-only oraz awaryjnym usunięciu przypadkowo wklejonego nowego audio ze snapshotu.

# Verni_AiO_Extension v1.12.121 - UN NEST Video Only for A/V Nests

- Baza: działająca wersja v1.12.119.
- UN NEST: gdy NEST jest video albo audio-video, kopiowane są tylko ścieżki VIDEO z sekwencji źródłowej. Audio z takiego NEST-a jest pomijane, żeby nie nadpisywać zsynchronizowanego audio na timeline.
- UN NEST: gdy zaznaczony NEST jest audio-only, audio nadal jest kopiowane normalnie.
- Dodano targetowanie VIDEO-only / AUDIO-only przed Ctrl+C i Ctrl+V.
- Przy video/audio-video NEST-ach wtyczka dodatkowo blokuje audio tracki głównej sekwencji na czas Ctrl+V i usuwa ewentualne nowe audio z paste, jeśli Premiere mimo wszystko je wklei.
- Pozostałe funkcje bez zmian względem v1.12.119.

# Verni_AiO_Extension v1.12.121 - UN NEST macOS Premiere Process Shortcut Fix

- Baza: działająca wersja v1.12.118.
- Poprawiono macOS fallback klawiaturowy UN NEST: panel nie szuka już aplikacji po sztywnej nazwie `Adobe Premiere Pro`.
- Skróty Cmd+C / Cmd+V / Cmd+W są teraz wysyłane przez System Events do procesu Premiere znalezionego po bundle id `com.adobe.PremierePro` albo po nazwie zawierającej `Premiere`.
- Pozostałe funkcje bez zmian względem v1.12.118.

# Verni_AiO_Extension v1.12.121 - UN NEST macOS Keyboard Shortcut Fix

- Baza: działająca wersja v1.12.117.
- Naprawiono Native Copy/Paste w UN NEST na macOS: panel używa teraz Cmd+C, Cmd+V i Cmd+W przez osascript/System Events zamiast Windowsowego powershell/Ctrl.
- Windows nadal używa Ctrl+C, Ctrl+V i Ctrl+W przez PowerShell.
- Pozostałe funkcje bez zmian względem v1.12.117.

# Verni_AiO_Extension v1.12.121 - Debug Background Timer Logs

- Baza: dzialajaca wersja v1.12.116.
- Toggle debug zmieniony na `Logi AutoSync/Organizer/Timer`.
- Rutynowe logi `Project Timer` / `projectTimerIdentity` sa teraz ukryte, gdy ten toggle jest wylaczony.
- Po wlaczeniu toggle nadal mozna zobaczyc logi timerowe do diagnostyki.


- Baza: dzialajaca wersja v1.12.115.
- Dodano zielone separatory START/KONIEC dla recznie uruchamianych akcji: UN NEST, Timecode Sync, Split Screen, Organizer oraz AutoSync teraz.
- Dodano niebieskie separatory dla automatycznych logow Organizer/AutoSync, gdy wlaczony jest toggle Logi AutoSync/Organizer.
- Ograniczono spam debug z automatycznego Auto-Check/AutoSync: gdy toggle Logi AutoSync/Organizer jest wylaczony, rutynowe evalScript start/koniec nie zasypuja logow w Debug Mode.

# Verni_AiO_Extension v1.12.115 - Timecode Standard Audio Tracks Fix

- Baza: działająca wersja v1.12.114 z bin selection i dynamicznym routingiem audio.
- Poprawiono dodawanie brakujących ścieżek audio przez QE DOM: wtyczka używa teraz pełnej sygnatury z `audioTrackType=1` (Standard).
- Celem jest, żeby ścieżki audio dodawane przez synchronizację zachowywały się jak zwykłe ręcznie dodane/wrzucone ścieżki, bez dziwnych oznaczeń/routingu typu `2` przy track headerze.
- Routing ZOOM 4ch/8ch oraz synchronizacja przez zaznaczone biny zostają zachowane.

# Verni_AiO_Extension v1.12.115 - Timecode Bin Selection Sync

- Baza: działająca wersja v1.12.115 z dynamicznym wykrywaniem kanałów audio.
- Synchronizacja po Timecode obsługuje teraz zaznaczone biny w Project panelu, np. `SUR/CAM 1`, `SUR/CAM 2`, `AUDIO 1`, `AUDIO 2`.
- Po zaznaczeniu binów wtyczka rekurencyjnie zbiera media z ich środka i podbinów, usuwa duplikaty, a potem synchronizuje je tak jak ręcznie zaznaczone klipy.
- Nadal działa dotychczasowy tryb zaznaczania konkretnych plików.
- Routing audio z v1.12.115 zostaje zachowany: wielokanałowe WAV-y ZOOM rezerwują bezkolizyjne bloki A-tracków na podstawie liczby kanałów.

# Verni_AiO_Extension v1.12.115 - Timecode Dynamic Audio Channel Routing

- Baza: stabilna wersja v1.12.110.
- Poprawiono synchronizację wielu kamer z wielokanałowym audio ZOOM.
- Osobne pliki audio-only rezerwują pełny blok ścieżek, domyślnie 8 kanałów, więc drugi ZOOM wchodzi na A9-A16 zamiast nadpisywać A2-A9.
- Audio z kamer jest planowane dopiero pod blokiem zewnętrznego audio, np. po dwóch ZOOM-ach 8ch zaczyna się od A17.
- Planner bierze pod uwagę już zajęte ścieżki w aktywnej sekwencji, żeby nie wstawiać klipów na istniejący materiał w tym samym czasie.

# Verni_AiO_Extension v1.12.110 - Global Progress Overlay

- Baza: stabilna wersja v1.12.109 z działającym i wyczyszczonym UN NEST.
- Dodano globalne przyciemnienie panelu i pasek postępu 0-100% dla dużych akcji uruchamianych z panelu.
- Podpięto overlay pod: Skanuj teraz, Synchronizuj, Dzielenie ekranu, Synchronizuj teraz Auto-Sync, UN NEST i Cofnij UN NEST.
- Dodano `window.VerniProgress`, żeby przyszłe funkcje można było łatwo owinąć tym samym overlayem.
- Nie zmieniano logiki JSX/UN NEST po stronie Premiere.

# Verni_AiO_Extension v1.12.109 - UN NEST Dead Code Cleanup

- Baza: stabilna wersja v1.12.108 z działającym flow UN NEST.
- Wyczyśczono legacy/manualne cofanie UN NEST, którego panel już nie używa — obecny przycisk Undo dalej korzysta z `AEDRNO.undoLastUnNestByHistory()`.
- Usunięto nieużywane helpery starego manualnego restore: ręczne usuwanie rozpakowanych klipów, audio lock snapshot, ręczne przywracanie multicam/labeli i zdublowaną definicję `_unComponentCount`.
- Zachowano aktywne flow Native Copy/Paste: przygotowanie Ctrl+C, przygotowanie Ctrl+V, finalize, zamykanie zakładki źródłowego NEST-a i History Undo.
- Nie ruszano sprawdzonego helpera `_unSelectVisibleNestedItemsForNativeCopy()`, bo wcześniejszy test pokazał, że jego usunięcie może wpływać na UN NEST mimo braku oczywistego statycznego wywołania.
- Ujednolicono wersję panelu i manifestu do `1.12.109`.

# Verni_AiO_Extension v1.12.71 - Safe Log Toggle and Drop Guard

- Baza: stabilna wersja 1.12.67.
- Dodano przełącznik logów AutoSync/Organizer.
- Dodano globalną blokadę przypadkowego dropu poza polem drag & drop.
- Logika synchronizacji, UN NEST, Auto-Sync i Split Screen bez zmian.

- Baza: działająca wersja v1.12.66.
- Dodano normalizację tekstu logów do ASCII, żeby uniknąć mojibake z ExtendScript/CEP typu `trafieĹ„`.
- UI wtyczki może nadal używać polskich znaków; normalizacja dotyczy tylko panelu logów.
- Dodano przełącznik **Debug Mode** przy logach.
- Tryb zwykły pokazuje krótkie, czytelne logi użytkowe.
- Tryb Debug dodaje szczegóły techniczne: parametry wywołań, czas `evalScript`, długość odpowiedzi i kontekst modułu.
- Dodano prefixy modułów w logach: `Organizer`, `Timecode`, `SplitScreen`, `AutoSync`, `UN NEST`, `Timer`, `System`.
- Nie zmieniano logiki synchronizacji po timecode, UN NEST, Auto-Sync ani Split Screen.

# Verni_AiO_Extension v1.12.64 - Modular Refactor + Safer Logs

- Baza: stabilna wersja v1.12.63.
- Podzielono `jsx/host.jsx` na moduły w folderze `jsx/modules/`.
- Dodano mały wspólny moduł `utils.jsx` dla bezpiecznego formatowania błędów i prostych helperów.
- Rozszerzono `CSInterface.js` o `SystemPath` i `getSystemPath`, bez zmiany publicznego działania panelu.
- Dodano bezpieczniejszy wrapper logowania wywołań `evalScript` w `main.js`.
- Nie zmieniano logiki synchronizacji po timecode, UN NEST, Auto-Sync ani Split Screen.

# Verni_AiO_Extension v1.12.63 - Minor Cleanup
- Minor cleanup: usunięto nieużywane helpery i martwą funkcję animacji kliknięcia.
- Nie zmieniano działającej logiki synchronizacji po Timecode.

- Baza: oryginalna działająca wersja v1.12.55.
- Usunięto martwe, starsze kopie UN NEST z host.jsx.
- Nie zmieniano działającej logiki synchronizacji po Timecode.
- Usunięto funkcję odświeżania panelu, przycisk, overlay i ikonę refresh.png.

# Verni_AiO_Extension v1.12.55 - Version Badge

- Baza: v1.12.55.
- Dodano mały napis **v.1.12.63** w prawym górnym rogu górnej belki.
- Ten numer służy do szybkiego sprawdzenia, czy Premiere faktycznie załadował aktualną wersję wtyczki.

# Verni_AiO_Extension v1.12.55 - UN NEST Force Host Reload + Video Fix

- Wymuszono przeładowanie `jsx/host.jsx` przed każdym kliknięciem **UN NEST**.
- Dzięki temu Premiere nie powinien już wykonywać starej funkcji UN NEST z cache, np. `v1.12.19`.
- Poprawiono mapowanie video względem pierwszej realnie użytej ścieżki video wewnątrz NEST-a.
- Przykład: NEST leży na V2, a w środku klip jest na NEST V2 → po UN NEST wraca na V2, nie na V3.
- Log powinien teraz zaczynać się od `=== UN NEST v1.12.55 ===`.

# Verni_AiO_Extension v1.12.54 - UN NEST Video Track Offset Fix

- Poprawiono mapowanie ścieżek video przy UN NEST.
- Video jest teraz mapowane względem pierwszej realnie użytej ścieżki video wewnątrz NEST-a.
- Przykład: jeżeli NEST leży na V2, a w środku Premiere trzyma klip na NEST V2, po UN NEST klip wróci na V2, nie na V3.
- Log UN NEST pokazuje teraz pierwszą niepustą ścieżkę video w NEST.

# Verni_AiO_Extension v1.12.53 - Header Hover Outline Safe Fix

- Baza: działająca v1.12.51.
- Cofnięto ryzykowną poprawkę z v1.12.52.
- Dodano obrys hover dla UN NEST i widgetu czasu jako bezpieczny CSS override na końcu pliku.
- Nie ruszano JavaScriptu ani istniejących bloków stylów.

# Verni_AiO_Extension v1.12.51 - Refresh Progress Overlay

- Po kliknięciu przycisku odświeżania panel przyciemnia się overlayem.
- Na środku pojawia się poziomy pasek postępu od 0 do 100%.
- Po dojściu do 100% panel zapisuje stan i przeładowuje wtyczkę z cache-busterem.
- Po ponownym załadowaniu overlay znika, a panel działa już na odświeżonych plikach.

# Verni_AiO_Extension v1.12.50 - Header UN NEST Position Fix

- Poprawiono pozycję przycisku **UN NEST** w headerze.
- UN NEST jest teraz przypięty do lewej strony paska szybkich narzędzi.
- Odświeżanie i timer zostają po prawej stronie.
- Zmieniono układ headera z flex na stabilniejszy grid, żeby elementy nie wpadały pod tytuł.

# Verni_AiO_Extension v1.12.49 - Header Refresh Button Stable Fix

- Baza: stabilna v1.12.44.
- Poprawiono przycisk odświeżania w headerze.
- Przycisk jest teraz w osobnym kontenerze po prawej stronie, po lewej od licznika czasu.
- Licznik czasu i ikona stopera zostają jednym osobnym widgetem.
- Przycisk nie nachodzi na środek panelu i nie powinien blokować UN NEST ani innych funkcji.
- Kliknięcie zapisuje stan i przeładowuje panel z cache-busterem.

# Verni_AiO_Extension v1.12.44 - AutoSync Compact Color Align

- W kompaktowym widoku Auto-Sync przesunięto kwadracik podglądu koloru.
- Dropdown **Kolor** zaczyna się teraz równo pod dropdownem **Synchronizacja podfolderów**.

# Verni_AiO_Extension v1.12.43 - AutoSync Subfolders Label Break

- W kompaktowym widoku Auto-Sync etykieta **Synchronizacja podfolderów** jest teraz łamana na dwie linie:
  - Synchronizacja
  - podfolderów

# Verni_AiO_Extension v1.12.42 - AutoSync Compact Color Width Fix

- Poprawiono szerokość listy **Kolor** w wąskim/kompaktowym widoku Auto-Sync.
- Pole wyboru koloru nie rozciąga się już nienaturalnie na całą szerokość karty.
- Reszta działania i układ szerokiej tabeli bez zmian.

# Verni_AiO_Extension v1.12.41 - Button Animation Safe Fix

- Cofnięto problematyczny JavaScriptowy handler animacji z v1.12.40, który mógł blokować cały panel CEP.
- Animacja kliknięcia jest teraz zrobiona bezpiecznie przez CSS `:active`.
- Wtyczka powinna znowu normalnie uruchamiać timer, zakładki, UN NEST i Auto-Sync.
- Przyciski nadal lekko zmniejszają się podczas wciskania.

# Verni_AiO_Extension v1.12.39 - Button Click Animation

- Dodano lekką animację kliknięcia przycisków w całej wtyczce.
- Po kliknięciu przycisk delikatnie się zmniejsza i wraca do swojego rozmiaru.
- Animacja działa m.in. dla:
  - Synchronizuj teraz,
  - PAUZA/PLAY,
  - czerwonego X,
  - folder relink,
  - UN NEST,
  - pozostałych standardowych przycisków panelu.

# Verni_AiO_Extension v1.12.38 - AutoSync Compact Labels

- Poprawiono bardzo wąski układ listy Auto-Sync.
- Przy mocnym zwężeniu każdy folder pokazuje się jako czytelna karta od góry do dołu.
- Dodano opisy pól w układzie kompaktowym: **Nazwa folderu**, **Link**, **Ścieżka folderu systemowego**, **Synchronizacja podfolderów**, **Kolor**, **Status**, **Akcje**.
- Szeroki układ pozostaje bez zmian jako jedna podłużna tabela.

# Verni_AiO_Extension v1.12.37 - AutoSync Responsive Layout

- Poprawiono responsywność listy folderów Auto-Sync.
- Przy zwężaniu panelu przyciski PAUZA/PLAY i X nie powinny już uciekać poza prawą krawędź.
- Dla węższych okien tabela przechodzi w kompaktowy układ kart, dzięki czemu wszystkie opcje pozostają widoczne.

# Verni_AiO_Extension v1.12.36 - AutoSync Subfolders Width Fix

- Zwężono kolumnę **Synchronizacja podfolderów** w tabeli Auto-Sync.
- Lista **Włącz/Wyłącz** ma teraz szerokość podobną do kolumny **Kolor**.

# Verni_AiO_Extension v1.12.35 - AutoSync Status Label

- Zwężono kolumnę **Kolor** w tabeli Auto-Sync.
- Dodano status folderu między wyborem koloru a przyciskami PAUZA/PLAY oraz X.
- Status pokazuje:
  - **Auto-Sync aktywny** na zielono,
  - **Auto-Sync zatrzymany** na żółto.

# Verni_AiO_Extension v1.12.34 - CrossPlatform NoCMD

- Usunięto uruchamianie CMD / plików .bat przy sprawdzaniu nazw dysków na Windows.
- Wtyczka nie powinna już powodować migania okna CMD.
- macOS nadal obsługuje ścieżki po `/Volumes/NazwaDysku/...`.
- Windows działa bezpiecznie po zapisanej literze dysku; bez uruchamiania zewnętrznych komend.

# Verni_AiO_Extension v1.12.33 - Cross Platform Volume Paths

- Dodano obsługę przenoszenia projektów między Windows i macOS w Auto-Sync.
- Foldery Auto-Sync zapisują teraz oprócz pełnej ścieżki także nazwę dysku/woluminu i ścieżkę względną wewnątrz tego dysku.
- Jeżeli ścieżka z Windows typu `D:/SFX` nie istnieje na macOS, wtyczka próbuje odnaleźć ten sam folder po nazwie woluminu, np. `/Volumes/SAMSUNG T7/SFX`.
- Analogicznie na Windows wtyczka próbuje odnaleźć dysk po etykiecie woluminu zamiast polegać wyłącznie na literze dysku.
- Plik ustawień projektu nadal jest tworzony obok `.prproj`, ale identyfikacja projektu zawiera teraz informacje o woluminie.

# Verni_AiO_Extension v1.12.32 - AutoSync Pause Size Tiny Fix

- Minimalnie zmniejszono znak pauzy w żółtym przycisku, żeby był wizualnie dopasowany wysokością do czerwonego X.

# Verni_AiO_Extension v1.12.31 - AutoSync Remove X Size Fix

- Powiększono i wycentrowano znak **X** w czerwonym przycisku usuwania folderu Auto-Sync.
- Rozmiar X jest teraz wizualnie dopasowany do znaków PLAY/PAUZA.

# Verni_AiO_Extension v1.12.30 - AutoSync Pause Icon Fix

- Poprawiono wygląd żółtego przycisku pauzy przy folderach Auto-Sync.
- Usunięto kolorowy/niebieski symbol emoji.
- Pauza jest teraz rysowana jako biały znak na środku żółtego przycisku.

# Verni_AiO_Extension v1.12.29 - AutoSync UI Color Order

- Zbliżono przyciski PAUZA/PLAY i czerwony X przy folderach Auto-Sync.
- Zmieniono symbol pauzy na czytelny znak **⏸**.
- Nowe foldery Auto-Sync dostają kolory automatycznie według kolejności listy: pierwszy **Violet**, drugi **Iris**, kolejny następny kolor itd.

# Verni_AiO_Extension v1.12.28 - AutoSync Per Folder Pause

- Globalna opcja **Automatyczna Synchronizacja (5 sekund)** reaguje teraz tylko na kliknięcie w sam kwadracik checkboxa.
- Dodano indywidualny przycisk **PAUZA/PLAY** przy każdym folderze Auto-Sync.
- Żółta pauza zatrzymuje automatyczną synchronizację tylko dla danego folderu.
- Zielony play wznawia synchronizację tylko dla danego folderu.
- Stan pauzy zapisuje się w pliku ustawień projektu.

# Verni_AiO_Extension v1.12.27 - AutoSync Relink Media Fix

- Poprawiono ponowne wskazanie folderu Auto-Sync.
- Wtyczka próbuje teraz najpierw podmienić ścieżkę istniejących mediów offline na nową lokalizację.
- Jeżeli relink się uda, nie importuje duplikatu.
- Jeżeli relink się nie uda, importuje brakujący plik z nowej lokalizacji.

# Verni_AiO_Extension v1.12.26 - AutoSync Relink No Duplicates

- Poprawiono ponowne wskazywanie folderu Auto-Sync.
- Po podaniu nowej ścieżki wtyczka czyści stare wpisy pasujące do plików z tego folderu w danym BIN-ie, aby nie zostawiać offline duplikatów.
- Nowe pliki importują się do tego samego BIN-u bez podwajania pozycji w Project Panelu.

# Verni_AiO_Extension v1.12.25 - AutoSync Link Picker Fix

- Wycentrowano status linku folderu pod nagłówkiem **Link**.
- Poprawiono ikonę ponownego wskazania folderu przy czerwonym X: kliknięcie otwiera systemowe okno wyboru folderu.
- Po wskazaniu nowej ścieżki status wraca na zielony ptaszek i Auto-Sync działa dalej.

# Verni_AiO_Extension v1.12.22 - Rename to Verni_AiO_Extension


## v1.12.21 — UN NEST Video Empty Audio Track Cleanup

## v1.12.21 — UN NEST Audio Track Offset Fix

- Poprawiono mapowanie audio przy UN NEST audio-only.
- Pierwsza realnie użyta ścieżka audio wewnątrz NEST-a wraca teraz na ścieżkę, na której leżał NEST w głównej sekwencji.
- Przykład: jeśli NEST leżał na A3, a w środku klip był na NEST A2, po UN NEST wróci na A3, nie na A4.
- Pozostawiono czyszczenie pustych automatycznie tworzonych ścieżek video/audio z poprzednich wersji.

- przy UN NEST video, jeśli Premiere automatycznie utworzy pustą ścieżkę audio po dorzuceniu linkowanego audio, wtyczka próbuje usunąć tę pustą nową ścieżkę;
- istniejące ścieżki audio nie są usuwane;
- analogiczne zachowanie jak wcześniejszy cleanup pustych ścieżek video przy UN NEST audio-only.

## v1.12.8


## Zmiany v1.12.8

- Poprawiono układ kolumn w tabeli Auto-Sync, żeby **Synchronizacja podfolderów** i **Kolor** miały wyraźny, równy odstęp.
- Zmieniono działanie opcji **Synchronizacja podfolderów: Wyłącz**: wtyczka nadal skanuje pliki znajdujące się w podfolderach, ale importuje je płasko do głównego BIN-u, bez tworzenia BIN-u w BIN-ie.
- Opcja **Włącz** bez zmian odtwarza strukturę folderów jako BIN-y wewnątrz głównego BIN-u.

- poprawiono działanie osobnego efektu Transform w Dzielenie ekranu,
- efekt Transform jest teraz dodawany, ale jego Position / Anchor Point / Scale zostają w domyślnych wartościach Premiere,
- podział ekranu nadal ustawia Motion + Crop, a Transform służy do ręcznego przesuwania obrazu wewnątrz wycięcia,
- poprawka usuwa problem wartości 32767,0 w Transformie.



## Zmiany v1.12.5

- Wyrównano odstępy kolumn w tabeli Auto-Sync, żeby opcje nie nachodziły na siebie wizualnie.
- Naprawiono nazwy BIN-ów tworzonych z podfolderów: `%20` jest teraz zamieniane na normalną spację.

## Auto-Sync folderów systemowych - v1.12.5

- Dodano opcję **Synchronizacja podfolderów** dla każdego dodanego folderu.
- Opcja ma dwa ustawienia: **Włącz** oraz **Wyłącz**.
- Gdy opcja jest włączona, wtyczka importuje pliki z podfolderów i odtwarza strukturę folderów jako BIN-y wewnątrz głównego BIN-u.
- Przykład: folder systemowy `SFX/Whoosh/whoosh.wav` zostanie odtworzony w projekcie jako `SFX > Whoosh > whoosh.wav`.
- Gdy opcja jest wyłączona, wtyczka nadal skanuje pliki z podfolderów, ale importuje je płasko do głównego BIN-u bez tworzenia dodatkowych BIN-ów.

Wersja bazuje na paczce v1.10_TCFix i dodaje nową główną zakładkę **Dzielenie ekranu**.

## Zmiany w UI

- Główna zakładka **Segregowanie plików Dynamic Relink AE oraz sekwencji NEST** została zmieniona na **Segregowanie plików w Projekcie**.
- Główna zakładka **Synchronizacja po Timecode** została zmieniona na **Synchronizacja Wielu Kamer**.
- Pod-zakładka **Segregowanie sekwencji** została zmieniona na **Segregowanie sekwencji NEST**.
- Dodano główną fioletową zakładkę **Dzielenie ekranu**.

## Dzielenie ekranu

Workflow:

1. Zaznacz klipy video bezpośrednio na timeline, np. klipy na V1, V2, V3, V4.
2. W panelu rozwiń **Dzielenie ekranu**.
3. Ustaw **X / liczba kolumn** i **Y / liczba wierszy**.
   - Przykład: X = 4, Y = 1 tworzy cztery pionowe pola.
   - Przykład: X = 2, Y = 2 tworzy klasyczny grid 2x2.
4. Opcjonalnie ustaw odstęp poziomy/pionowy.
5. Kliknij **Zastosuj dzielenie ekranu**.

Funkcja ustawia dla zaznaczonych klipów:

- pozycję w Motion,
- skalę w Motion,
- efekt Crop / Kadrowanie,
- wartości cropu tak, żeby klipy wypełniały swoje pola w siatce.

Domyślny tryb **Wypełnij pola / crop** działa jak automatyczne kadrowanie pod wybrane pola. Tryb **Pokaż całe video / bez cropu** dopasowuje cały obraz do pola bez przycinania.

## Pozostałe moduły

Zachowane są moduły:

- Auto-Check i segregowanie plików w Project Panelu,
- segregowanie sekwencji NEST,
- synchronizacja wielu kamer / plików po Timecode z poprawkami routingu audio z v1.10_TCFix.

## Instalacja

Skopiuj folder `Verni_AiO_Extension` do folderu rozszerzeń CEP, np. Windows:

`C:\Users\TWOJ_USER\AppData\Roaming\Adobe\CEP\extensions\Verni_AiO_Extension`

albo systemowo:

`C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\Verni_AiO_Extension`

Panel znajdziesz w Premiere pod nazwą **Verni_AiO_Extension**.


## v1.12.3

- Dodano drugi przycisk **Zastosuj dzielenie ekranu + debugowanie**.
- Tryb debugowania wypisuje szczegółowe informacje o zaznaczonych klipach z timeline, ścieżkach, komponentach Motion/Crop oraz wyniku zastosowania siatki.


## Zmiany v1.12.3

- Dodano podgląd siatki 16:9 w sekcji **Dzielenie ekranu**.
- Podgląd reaguje na wartości X/Y.
- Poprawiono ustawianie Motion Position: pozycja jest liczona względem realnej rozdzielczości aktywnej sekwencji.
- Kadrowanie korzysta z właściwości Crop Left/Top/Right/Bottom dostępnych w komponencie Motion, jeśli Premiere nie zwraca osobnego efektu Crop.


## v1.12.3

- Poprawione dodawanie osobnych efektów Transform i Crop/Kadrowanie przez kilka ścieżek API, w tym QE DOM.
- Transform jest ustawiany neutralnie, żeby później można było przesuwać kadr wewnątrz wycięcia bez ruszania maski Crop.
- Poprawiony układ UI w sekcji Dzielenie ekranu: Tryb kadrowania znajduje się w lewej kolumnie obok podglądu siatki.


## v1.12.3
- Dzielenie ekranu: resolver efektów działa teraz bardziej jak Shortcakes — najpierw pobiera dokładną lokalizowaną nazwę efektu z `qe.project.getVideoEffectList()`, a dopiero potem dodaje Transform/Crop przez QE.
- Preferuje nazwy z listy Premiere, np. `Transform` i `Crop`, zamiast technicznych nazw `AE.ADBE Geometry2`, które u niektórych użytkowników zwracały obiekt, ale nie pojawiały się jako efekt na klipie.


## Nowość v1.12.3 — Auto-Sync folderów systemowych

Dodano główną zakładkę **Auto-Sync plików pomiędzy BIN'em, a folderem systemowym**.

Jak działa:
1. Przeciągnij folder z Eksploratora plików w pole Drag & Drop.
2. Wtyczka tworzy w projekcie BIN o nazwie folderu.
3. Co 5 sekund sprawdza folder systemowy.
4. Nowe pliki z dysku są automatycznie importowane do właściwego BIN'u.
5. Przy każdym folderze możesz ustawić kolor etykiety albo usunąć synchronizację czerwonym przyciskiem X.

Obsługiwane są typowe formaty video, audio, grafiki i dokumentów używane w Premiere Pro.


## v1.12.3
- Dodano podpis „Drag & Drop” pod polem przeciągania folderu.
- Dodano okno potwierdzenia usunięcia folderu z automatycznej synchronizacji.


## v1.12.8 — UN NEST

- Dodano szybki przycisk z ikoną łopaty pod nagłówkiem panelu.
- Po zaznaczeniu sekwencji NEST na timeline przycisk próbuje rozpakować zawartość zagnieżdżonej sekwencji na aktywną sekwencję.
- Funkcja próbuje przenieść materiały z V1/V2/V3 itd. z NEST-a na odpowiadające ścieżki głównej sekwencji.
- Po rozpakowaniu próbuje usunąć zaznaczony klip NEST z timeline oraz, jeśli Premiere API pozwoli, usunąć projektową sekwencję NEST z Project Panelu.

Uwaga: Premiere Pro nie ma natywnego publicznego polecenia „Un-Nest”, więc funkcja działa jako automatyzacja przez CEP/ExtendScript i może wymagać testów na różnych typach NEST-ów.
## v1.12.12 — UN NEST UI Align

- Wyrównano przycisk UN NEST w nagłówku panelu.
- Dodano napis **UN NEST** po prawej stronie ikonki łopaty.
- Usunięto wizualne wrażenie czerwonej ramki — przycisk pozostaje przezroczysty, z podświetleniem tylko po najechaniu.



## v1.12.12 — UN NEST Project Delete Fix

- UN NEST po rozpakowaniu próbuje teraz usuwać dokładnie tę sekwencję NEST z Project Panelu metodą `app.project.deleteSequence(...)`.
- Dotyczy tylko sekwencji, która była zaznaczona i rozpakowywana z timeline, np. `Nested Sequence 04`.
- Dotychczasowe UI i pozostałe funkcje bez zmian.


## v1.12.12 — UN NEST Video-Only Audio Cleanup

- Poprawiono UN NEST dla NEST-ów z samym video.
- Jeśli Premiere automatycznie dorzuci linkowane audio podczas przywracania klipów video, wtyczka usuwa to automatycznie dodane audio.
- Jeśli w NEST faktycznie były klipy audio, nadal są przywracane z torów audio NEST-a.


## v1.12.12 — UN NEST Video-Only Audio Cleanup

- Poprawiono UN NEST dla NEST-ów z samym video.
- Jeśli Premiere automatycznie dorzuci linkowane audio podczas przywracania klipów video, wtyczka usuwa to automatycznie dodane audio.
- Jeśli w NEST faktycznie były klipy audio, nadal są przywracane z torów audio NEST-a.


## v1.12.21 — UN NEST Safe Audio Lock
- Podczas rozpakowywania klipów video UN NEST blokuje ścieżki audio tylko na czas inserta video.
- Dzięki temu Premiere nie powinien nadpisywać istniejącego audio na A1/A2/A3 automatycznie dorzucanym audio z pliku video.
- Po insercie blokady audio są przywracane do poprzedniego stanu.


## v1.12.21 — UN NEST Audio Track Preserve Fix
- Audio-only UN NEST odtwarza audio względem ścieżki, na której leżał NEST na głównej sekwencji, zamiast zawsze wrzucać na A2.
- Usunięto video-kotwicę z audio-only inserta, żeby Premiere nie tworzył dodatkowych ścieżek video przy rozpakowywaniu samego audio.


## v1.12.21
- Dodano stoper w headerze po prawej stronie panelu.
- Licznik pokazuje czas pracy od załadowania panelu przy otwartym projekcie w formacie godzina:minuta:sekunda.


## v1.12.21 — Project Timer Persist

- Licznik czasu pracy jest zapisywany osobno dla każdego projektu Premiere.
- Czas nie resetuje się po zamknięciu i ponownym otwarciu projektu.
- Dane są zapisywane w pliku `project_timer_store.json` w folderze rozszerzenia, z kopią awaryjną w localStorage panelu.
- Lista zapisanych projektów jest ograniczona do 200 pozycji; po przekroczeniu limitu usuwany jest najstarszy zapis.

## v1.12.24 — ustawienia per projekt

- Każdy zapisany projekt Premiere ma teraz własny plik ustawień obok pliku `.prproj`.
- Nazwa pliku ustawień ma format: `(nazwa projektu)_verni_settings.json`.
- W tym pliku zapisywane są:
  - czas pracy przy danym projekcie,
  - foldery dodane do Auto-Sync,
  - stan przełącznika Automatyczna Synchronizacja,
  - ustawienia folderów Auto-Sync, takie jak kolor i synchronizacja podfolderów.
- Po otwarciu innego projektu wtyczka wczytuje tylko plik ustawień tego konkretnego projektu.
- Nowy projekt zaczyna z pustymi ustawieniami Auto-Sync i licznikiem od zera.


## v1.12.24 — Link folderu Auto-Sync

- Dodano kolumnę **Link** pomiędzy nazwą folderu i ścieżką.
- Zielony ptaszek oznacza poprawnie podlinkowany folder.
- Czerwony X oznacza brak folderu pod zapisaną ścieżką.
- Wtyczka sprawdza linki folderów co 10 sekund.
- Po zgubieniu folderu pojawia się komunikat z przyciskiem OK.
- Przy czerwonym X pojawia się przycisk folderu do wskazania nowej ścieżki.
