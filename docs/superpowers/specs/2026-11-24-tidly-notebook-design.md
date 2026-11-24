# Tidly Notebook — Tek Sayfa Gelişmiş Kişisel Wiki Tasarım Belgesi

> **Durum:** Onaylandı  
> **Tarih:** 2026-11-24

## 1. Amaç
TiddlyWiki5'ten ilham alan, sunucu veya kurulum gerektirmeyen, tek bir `.html` dosyası içinde çevrimdışı çalışan, mobil uyumlu ve kullanıcıların kendi iş akışlarına göre şekillendirebildiği kişisel bilgi tabanı (**Tidly Notebook**) üretmek.

## 2. Hedefler, Kapsam Dışı ve Anti-Hedefler

### Hedefler
- **%100 Tek Dosya ve Çevrimdışı:** Derlenen `dist/tidly-notebook.html` sıfır dış bağımlılık (harici CDN, font veya script yok) ile açılır; tüm notlar, ayarlar ve kullanıcı özelleştirmeleri bu tek `.html` dosyasına gömülerek kaydedilir.
- **TiddlyWiki5 Düzeyinde Veri ve Bağlantı Gücü:**
  - Tiddler (kart) modeli: başlık, metin, etiketler, tür, tarihler ve sınırsız **özel anahtar-değer alanı**.
  - Hibrit **Markdown + WikiText**: `[[Bağlantı]]`, `[[Görünen Ad|Hedef]]`, `{{İç İçe Gömme}}`, `{{Kart!!alan}}`, tıklanabilir görev kutuları (`- [ ]`), tablolar, uyarı blokları ve kod blokları.
  - **Dinamik Filtre Dili:** `[tag[Proje]!field:durum[bitti]sort[modified]]` tarzı zincirlenebilir sorgular; kart içinde canlı listeler (`<<list>>`, `<<count>>`, `<<toc>>`, `<<fields>>`) ve kullanıcı tanımlı makrolar (`\define`).
  - **Sistem Kartlarıyla Canlı Özelleştirme (`$:/...`):** Özel CSS (`$:/tags/Stylesheet`), özel yan panel sekmeleri (`$:/tags/SideBar`), yeni kart şablonları (`$:/tags/Template`), özel makrolar (`$:/tags/Macro`), 4 hazır tema + canlı renk paleti düzenleyici, 3 çalışma düzeni (Hikâye Akışı, Odak, Çift Sütun).
  - **Etkileşimli Bağlantı Grafiği:** Global ve yerel (aktif kart çevresi) ağ görünümü.
  - **İsteğe Bağlı Parola Şifreleme:** Tarayıcı içi `AES-256-GCM` + `PBKDF2`.
  - **Veri Taşınabilirliği:** `.html` (Tidly Notebook + şifresiz TiddlyWiki5 `.html` içe aktarma), `.json`, `.tid` (TiddlyWiki5 uyumlu) ve `.md` (frontmatter destekli) içe/dışa aktarım.
- **Birinci Sınıf Mobil Deneyim:** Alt başparmak gezinme çubuğu, kayan yan çekmece, ≥44×44px dokunma alanları, mobil editörde Yaz/Önizle geçişi + yapışkan biçimlendirme çubuğu, dokunmatik grafik ve yerel otomatik yedekleme ile sıfır veri kaybı.

### Kapsam Dışı
- Çok kullanıcılı gerçek zamanlı ortak düzenleme veya bulut sunucu/hesap sistemi.
- TiddlyWiki5'in JavaScript eklenti API'si (`$tw`) ile birebir eklenti uyumluluğu (bunun yerine `.tid`/`.json`/şifresiz `.html` veri uyumluluğu sağlanır).
- Notion-tarzı karmaşık blok WYSIWYG editörü.

### Anti-Hedefler (Kesinlikle Olmaması Gerekenler)
- İçinde `</script>` veya özel HTML geçen notların `.html` dosyasını bozması.
- Arka arkaya kaydetmelerde geçici DOM veya tarayıcı eklenti çöplerinin dosyaya sızması.
- İçe aktarılan notlardan XSS (`<script>`, `onerror=`, `javascript:`) çalışması.
- Döngüsel `{{A}} -> {{B}} -> {{A}}` gömmelerinin tarayıcıyı kilitlemesi.
- Şifreli bir wiki'nin yerel yedeklerde açık metin (plaintext) bırakması.
- Mobilde yatay taşma, küçük/üst üste binen düğmeler veya sayfa yenilenince veri kaybı.

## 3. Seçilen Mimari
Modüler kaynak kod (`src/core`, `src/storage`, `src/ui`, `src/styles`, `src/seed`) → Node 22 ile sıfır harici bağımlılıklı tek dosya derleyici (`build.mjs`) → `dist/tidly-notebook.html`.

## 4. Temel Teknik Tasarım

### 4.1. Veri Modeli ve Sistem Kartları
- Her kart: `{ title, text, tags: string[], type, created, modified, fields: Record<string, string> }`.
- Yeniden adlandırmada açık akış otomatik güncellenir; gelen `[[bağlantılar]]` ve `{{gömmeler}}` güncelleme seçeneği sunulur.
- `$:/` kartları varsayılan sistem/gölge (shadow) kartlarıdır; kullanıcı düzenleyebilir veya tek tıkla varsayılana sıfırlayabilir.
- Oturum içi 50 adımlık geri al/ileri al + silme sonrası geri alma bildirimi.

### 4.2. Kendini Kaydetme, Yerel Yedek ve Şifreleme Sınırı
- **Temiz Serileştirme:** Kaydederken canlı DOM kopyalanmaz; yalnızca kanonik başlık, çekirdek CSS (`#tidly-core-css`), boş `<div id="app">`, güncel JSON deposu (`#tidly-store`, `<`, `>`, `&`, `\u2028`, `\u2029` güvenli Unicode kaçışlı) ve çekirdek JS (`#tidly-core-js`) birleştirilerek deterministik tek `.html` üretilir.
- **3 Katmanlı Kayıt:**
  1. Otomatik Yerel Yedek (IndexedDB, `localStorage` yedekli): `$:/wiki-id` anahtarıyla her değişiklik ~400ms sonra yedeklenir. Yeniden açılışta dosyadan daha yeni yerel yedek varsa üstte ince bildirimle *"Geri yüklendi — Dosyayı Kaydet / Dosya Sürümüne Dön"* sunulur.
  2. Doğrudan Dosya Üzerine Yazma: Masaüstü Chromium'da File System Access API ile `Ctrl+S` doğrudan aynı `.html` üzerine yazar.
  3. Evrensel İndirme ve Mobil Paylaşım: Diğer tarayıcılar ve mobilde güncel `.html` indirilir; destekleyen mobil cihazlarda `navigator.share` ile doğrudan Dosyalar/Drive'a kaydedilir.
- **Şifreleme Güvenlik Sınırı:** Parola etkinse yalnızca kilit ekranı ve yedek kıyaslaması için gereken zarf üstverisi (`wikiId`, `updatedAt`, `lang`, `palette`) açık tutulur; tüm notlar ve diğer `$:/` kartları `PBKDF2-SHA256` (250.000 tur) + `AES-256-GCM` ile şifrelenir. IndexedDB yerel yedekleri de şifreli zarf olarak yazılır.

### 4.3. Ayrıştırıcı, İç İçe Gömme, Makrolar ve Güvenlik
- **Markdown + WikiText:** Başlıklar, vurgu/kalın/italik, kod bloğu (kopyala düğmeli), alıntı, uyarı kutuları (`> [!NOT]`, `> [!İPUCU]`, `> [!UYARI]`), tablolar, etkileşimli `- [ ]` görev kutuları, `[[Kart]]` / `[[Metin|Kart]]` bağlantıları, küçük görselleri base64 data URI olarak gömme.
- **Bağlam Taşıyan İşleme (`ctx`):** Her işleme `currentTiddler`, `vars` ve döngü koruma yığını (`renderStack`, max derinlik 10) taşır:
  - `{{Kart}}`, `{{Kart!!alan}}` ve `{{!!alan}}` canlı işlenir; döngü algılanırsa donmadan güvenli uyarı gösterilir.
  - `<<list filter="..." template="ŞablonKart" empty="...">>` her eşleşen kart için `currentTiddler` bağlamını kurarak şablonu işler.
  - `<<count>>`, `<<toc>>`, `<<fields>>` ve `$:/tags/Macro` içinde `\define ad(p1, p2) ... \end`.
  - Güvenli eylem makroları: `<<new-card>>` ve `<<set-field>>`.
- **Şablon Yer Tutucuları:** `$:/tags/Template` içinde `${tarih}`, `${saat}`, `${baslik}`.
- **Özel CSS (`$:/tags/Stylesheet`):** Saf CSS olarak uygulanır.

### 4.4. Filtre Motoru
- `[op1[arg]op2[arg]]` zincirleri; boşlukla birleşim, `-` ile fark, `+` ile önceki sonuç üzerinde süzme; `!` ile olumsuzlama.
- Operatörler: `all[tiddlers|system|tags|shadows|current]`, `title`, `tag`, `field:ad`, `has`, `prefix`, `suffix`, `search` (Türkçe `tr` yerel duyarsız), `backlinks`, `links`, `orphans`, `missing`, `current`, `sort`, `!sort`, `nsort`, `limit`, `first`, `last`, `reverse`, `count`.

### 4.5. Görsel Kimlik, Düzenler ve Mobil Arayüz
- **Estetik:** *"Sıcak Arşiv Fişi"* — krem kâğıt yüzeyi (`#F3EFE6`/`#FAF8F3`), ceviz mürekkebi (`#1F1C18`), terracotta vurgusu (`#B8432E`); **Kâğıt / Gece / Sepya / Orman** paletleri + canlı renk özelleştirici.
- **Masaüstü / Mobil / Grafik:** Yukarıdaki 3 çalışma düzeni, mobil alt başparmak çubuğu + çekmece + Yaz/Önizle editörü ve Canvas kuvvet-yönelimli ağ grafiği.
