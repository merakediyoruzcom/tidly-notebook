import { twTimestamp } from '../core/utils.js';

export const DOCTOR_PACK = {
  id: 'doctor',
  filename: 'tidly-doktor.html',
  siteTitle: 'Tidly Klinik Defter',
  siteSubtitle: 'Klinik protokoller, anonim vaka notları ve doz hesaplayıcılar',
  palette: 'clinic',
  defaultTiddlers: '[[Klinik Çalışma Masası]] [[Klinik Hesaplayıcılar]]',
  landingCard: 'Klinik Çalışma Masası',
  nameTr: 'Doktor',
  nameEn: 'Clinician',
  descTr: 'SOAP vaka şablonları, tedavi protokolleri, offline VKİ/doz hesaplayıcı ve parola şifreleme rehberi.',
  descEn: 'SOAP case templates, clinical protocols, offline BMI/dose calculators, and encryption guidance.',
  badgeTr: 'Klinik & Vaka',
  createTiddlers() {
    const ts = twTimestamp();
    const make = (title, text, tags = [], fields = {}) => ({
      title,
      text,
      tags,
      type: 'text/vnd.tidly',
      created: ts,
      modified: ts,
      fields,
      attachments: []
    });

    return [
      make(
        'Klinik Çalışma Masası',
        [
          '# Klinik Çalışma Masası',
          '',
          '> [!UYARI]',
          '> **KVKK ve Gizlilik Hatırlatması:** Hasta ad-soyad veya TC kimlik numarası yerine anonim vaka kodu (ör. `H-2026-041`) kullanın ve hassas çalışma dosyalarını **Ayarlar → Parola Şifreleme (AES-256-GCM)** ile kilitleyin.',
          '',
          '## Hızlı İşlemler',
          '<<new-card label="Yeni Vaka (SOAP)" template="Şablon: Vaka (SOAP)" tags="Vaka">> <<new-card label="Yeni Protokol" template="Şablon: Klinik Protokol" tags="Protokol">>',
          '',
          '## Aktif Vaka Takipleri',
          '<<list filter="[tag[Vaka]!tag[$:/tags/Template]!field:durum[taburcu]sort[title]]" empty="Aktif takip yok.">>',
          '',
          '## Hızlı Erişim',
          '- [[Klinik Hesaplayıcılar]] (VKİ & kilo bazlı doz — tamamen çevrimdışı)',
          '- [[Örnek Protokol: Akut Hipertansiyon Değerlendirme]]'
        ].join('\n'),
        ['Pano', 'Klinik']
      ),
      make(
        'Klinik Hesaplayıcılar',
        [
          '# Çevrimdışı Klinik Hesaplayıcılar',
          '',
          '<<calc type="bmi">>',
          '',
          '<<calc type="dose">>'
        ].join('\n'),
        ['Araç', 'Klinik']
      ),
      make(
        'Örnek Vaka: H-2026-041',
        [
          '# Vaka H-2026-041 (Anonim)',
          '',
          '**Tarih:** 2026-11-24 · **TA:** {{!!ta}} · **Nabız:** {{!!nabiz}} · **Durum:** =={{!!durum}}==',
          '',
          '## S — Subjektif (Yakınma ve Öykü)',
          '- Baş ağrısı ve son 3 günde tansiyon yüksekliği tarifliyor.',
          '',
          '## O — Objektif (Muayene ve Bulgular)',
          '- TA: 165/95 mmHg, Nabız: 82/dk ritmik, Ateş: 36.6 °C',
          '',
          '## A — Değerlendirme (Assessment)',
          '- Kontrolsüz esansiyel hipertansiyon ön tanısı; hedef organ taraması planlandı. Bkz. [[Örnek Protokol: Akut Hipertansiyon Değerlendirme]].',
          '',
          '## P — Plan ve Takip',
          '- [ ] EKG ve temel biyokimya sonuçlarını karta ekle',
          '- [ ] 1 hafta sonra kontrol tansiyon günlüğü değerlendirmesi',
          '',
          '<<set-field field="durum" value="takipte" label="Takipte">> <<set-field field="durum" value="taburcu" label="Takibi Kapat">>'
        ].join('\n'),
        ['Vaka', 'Kardiyoloji'],
        { ta: '165/95', nabiz: '82', durum: 'takipte' }
      ),
      make(
        'Örnek Protokol: Akut Hipertansiyon Değerlendirme',
        [
          '# Protokol: Akut Tansiyon Yüksekliği Değerlendirmesi',
          '',
          '**Bölüm:** {{!!bolum}} · **Son Güncelleme:** 2026-11-24',
          '',
          '## Kırmızı Bayraklar (Acil Yönlendirme)',
          '- Göğüs ağrısı, nörolojik defisit, dispne, akut görme kaybı',
          '',
          '## İlk Basamak Kontrol Listesi',
          '- [ ] Her iki koldan 5 dk dinlenme sonrası tekrar ölçüm',
          '- [ ] İlaç uyumu ve son tuz/NSAİİ alımı sorgusu',
          '- [ ] EKG + kreatinin + elektrolit + idrar tetkiki',
          '',
          '> [!NOT]',
          '> Kendi branşına ait PDF kılavuzları ve algoritmaları bu karta dosya eki olarak yükleyebilirsin.'
        ].join('\n'),
        ['Protokol', 'Kardiyoloji'],
        { bolum: 'Acil / İç Hastalıkları' }
      ),
      make(
        'Şablon: Vaka (SOAP)',
        [
          '# ${baslik}',
          '',
          '**Tarih:** ${tarih} ${saat} · **TA:** {{!!ta}} · **Nabız:** {{!!nabiz}} · **Durum:** {{!!durum}}',
          '',
          '## S — Subjektif',
          '- ',
          '',
          '## O — Objektif',
          '- ',
          '',
          '## A — Değerlendirme',
          '- ',
          '',
          '## P — Plan',
          '- [ ] ',
          '',
          '<<set-field field="durum" value="taburcu" label="Takibi Kapat">>'
        ].join('\n'),
        ['$:/tags/Template', 'Vaka'],
        { ta: '-', nabiz: '-', durum: 'takipte' }
      ),
      make(
        'Şablon: Klinik Protokol',
        [
          '# ${baslik}',
          '',
          '**Bölüm:** {{!!bolum}} · **Tarih:** ${tarih}',
          '',
          '## Endikasyon / Kriterler',
          '- ',
          '',
          '## Uygulama Adımları',
          '- [ ] ',
          '',
          '## Dikkat Edilecekler',
          '- '
        ].join('\n'),
        ['$:/tags/Template', 'Protokol'],
        { bolum: 'Genel' }
      ),
      make(
        'Şablon: İlaç ve Doz',
        [
          '# ${baslik}',
          '',
          '**Etken Madde:** {{!!etken}} · **Grup:** {{!!grup}}',
          '',
          '## Standart Doz',
          '- ',
          '',
          '<<calc type="dose">>',
          '',
          '## Kontrendikasyon ve Etkileşimler',
          '- '
        ].join('\n'),
        ['$:/tags/Template', 'İlaç'],
        { etken: '', grup: '' }
      ),
      make(
        'Sekme: Aktif Takipler',
        [
          '### Aktif Vakalar (<<count filter="[tag[Vaka]!tag[$:/tags/Template]!field:durum[taburcu]]">>)',
          '',
          '<<list filter="[tag[Vaka]!tag[$:/tags/Template]!field:durum[taburcu]sort[title]]" empty="Aktif vaka bulunmuyor.">>',
          '',
          '<<new-card label="Yeni Vaka (SOAP)" template="Şablon: Vaka (SOAP)" tags="Vaka">>'
        ].join('\n'),
        ['$:/tags/SideBar'],
        { caption: 'Takipler' }
      ),
      make(
        'Sekme: Protokoller',
        [
          '### Klinik Protokoller (<<count filter="[tag[Protokol]!tag[$:/tags/Template]]">>)',
          '',
          '<<list filter="[tag[Protokol]!tag[$:/tags/Template]sort[title]]" empty="Protokol kartı yok.">>',
          '',
          '- [[Klinik Hesaplayıcılar]]'
        ].join('\n'),
        ['$:/tags/SideBar'],
        { caption: 'Protokoller' }
      )
    ];
  }
};
