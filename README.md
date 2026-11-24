# Tidly Notebook

TiddlyWiki5'ten ilham alan; sıfır sunucu, sıfır bağımlılık, mobil uyumlu ve kendini tek bir `.html` dosyasına kaydedebilen kişisel ve mesleki bilgi tabanı.

- **Canlı Portal ve İndirme Sayfası:** https://merakediyoruzcom.github.io/tidly-notebook/

---

## Tek-Dosya Sürümler (`dist/`)

Her sürüm tek bir bağımsız `.html` dosyasıdır. Tarayıcıda doğrudan açabilir veya bilgisayarınıza/telefonunuza indirip internetsiz kullanabilirsiniz:

| Sürüm | Canlı Bağlantı | Öne Çıkan Araçlar |
|---|---|---|
| **Genel / Standart** | [tidly-notebook.html](https://merakediyoruzcom.github.io/tidly-notebook/tidly-notebook.html) | Kart akışı, `[[Bağlantı]]`, `{{Gömme}}`, filtre dili, bağlantı grafiği, Mod Merkezi |
| **Öğretmen** | [tidly-ogretmen.html](https://merakediyoruzcom.github.io/tidly-notebook/tidly-ogretmen.html) | Ders planı/ödev/gözlem şablonları, kart ekleri (PDF/Word/Slayt), `<<gradebook>>`, CSV içe/dışa aktarım |
| **Doktor** | [tidly-doktor.html](https://merakediyoruzcom.github.io/tidly-notebook/tidly-doktor.html) | SOAP vaka şablonları, klinik protokoller, `<<calc>>` (VKİ & kilo bazlı doz), KVKK gizlilik rehberi |
| **Aşçı** | [tidly-asci.html](https://merakediyoruzcom.github.io/tidly-notebook/tidly-asci.html) | `<<recipe>>` porsiyon ölçekleyici, tek tıkla Alışveriş Listesi, `<<timer>>` pişirme sayaçları |
| **Öğrenci** | [tidly-ogrenci.html](https://merakediyoruzcom.github.io/tidly-notebook/tidly-ogrenci.html) | Cornell ders notları, sınav tekrar şablonları, Pomodoro sayacı |

---

## Temel Özellikler

- **Gerçek Tek Dosya Taşınabilirlik:** Tüm notlar, şablonlar, özel alanlar, ekli dosyalar ve temalar tek `.html` içinde saklanır; destekleyen masaüstü tarayıcılarda aynı dosya üzerine yazar (`Ctrl+S`), diğer tarayıcılarda güncel `.html` dosyasını indirir ve IndexedDB üzerinde otomatik yedek tutar.
- **Tiddler Veri Modeli ve Filtre Dili:** Sınırsız özel alan, `$:/` sistem ve gölge kartları, `[tag[Proje]!field:durum[tamamlandi]sort[modified]]` filtre dili, Türkçe yerel (`tr`) arama ve sıralama.
- **Canlı Özelleştirme:** `$:/tags/Stylesheet` (özel CSS), `$:/tags/SideBar` (özel yan sekmeler), `$:/tags/Template` (hazır şablonlar), `$:/tags/Macro` (`\define` kullanıcı makroları), 6 WCAG AA renk paleti + canlı renk düzenleyici.
- **Güvenli Kart Ekleri ve Şifreleme:** Kartlara PDF, Word, Excel, PowerPoint, görsel, ses ve CSV ekleme (dosya başı maks. 5 MB, `.html`/`.svg`/`.js` engelli); isteğe bağlı `PBKDF2-SHA256` + `AES-256-GCM` parola şifreleme.
- **Mobil Öncelikli ve Bağlantı Grafiği:** Alt başparmak gezinme çubuğu, kayan çekmece, Yaz/Önizle editörü, dokunmatik yakınlaştırmalı Canvas ağ grafiği.

## Kısayollar

- `Ctrl+K` — Hızlı Arama ve Komut Paleti
- `Ctrl+S` — HTML Dosyasını Kaydet
- `Alt+N` — Yeni Kart Oluştur
- `Ctrl+Enter` — Düzenlenen Kartı Kaydet

## Geliştirme ve Derleme

Node.js 22+ gerektirir; harici `npm` bağımlılığı yoktur:

```bash
npm run build   # dist/ altına tüm tek-dosya HTML sürümlerini ve portalı üretir
npm test        # Tüm otomatik test paketini (node:test) çalıştırır
npm run dev     # http://127.0.0.1:4173 üzerinde yerel önizleme sunucusu açar
```

## Lisans

[MIT](LICENSE)
