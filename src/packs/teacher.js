import { twTimestamp } from '../core/utils.js';

export const TEACHER_PACK = {
  id: 'teacher',
  filename: 'tidly-ogretmen.html',
  siteTitle: 'Tidly Öğretmen Defteri',
  siteSubtitle: 'Ders içerikleri, ödev takibi, materyaller ve not çizelgesi',
  palette: 'classroom',
  defaultTiddlers: '[[Öğretmen Panosu]] [[10-A Matematik Not Çizelgesi]]',
  landingCard: 'Öğretmen Panosu',
  nameTr: 'Öğretmen',
  nameEn: 'Teacher',
  descTr: 'Ders planları, PDF/Word ders materyali ekleme, ödev takibi ve otomatik ortalamalı not çizelgesi.',
  descEn: 'Lesson plans, PDF/doc material attachments, homework tracking, and auto-computed gradebook.',
  badgeTr: 'Sınıf & Ders',
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
        'Öğretmen Panosu',
        [
          '# Öğretmen Çalışma Panosu',
          '',
          'Ders notlarını, öğrenci ödevlerini, PDF/sunum/görsel materyallerini ve sınav çizelgelerini internetsiz tek bir `.html` dosyasında yönet.',
          '',
          '## Hızlı Eylemler',
          '<<new-card label="Yeni Ders Planı" template="Şablon: Ders Planı" tags="Ders">> <<new-card label="Yeni Ödev Ver" template="Şablon: Ödev" tags="Ödev">> <<new-card label="Yeni Not Çizelgesi" template="Şablon: Not Çizelgesi" tags="Not Çizelgesi">>',
          '',
          '## Bu Haftanın Ödevleri',
          '<<list filter="[tag[Ödev]!field:durum[kapandi]sort[title]]" empty="Açık ödev kaydı yok.">>',
          '',
          '## Aktif Dersler ve Materyaller',
          '<<list filter="[tag[Ders]!tag[$:/tags/Template]sort[title]]" empty="Henüz ders kartı yok.">>',
          '',
          '> [!İPUCU]',
          '> Herhangi bir ders kartını **Düzenle** moduna alıp PDF, Word (`.docx`), slayt (`.pptx`), görsel veya Excel `.csv` dosyasını doğrudan kartın içine ekleyebilirsin.'
        ].join('\n'),
        ['Pano', 'Öğretmen']
      ),
      make(
        '10-A Matematik Not Çizelgesi',
        [
          '# 10-A Matematik — 1. Dönem Not Çizelgesi',
          '',
          'Excel’den `.csv` dosyası yükleyebilir veya aşağıdaki tablonun altından doğrudan yeni öğrenci notu ekleyebilirsin.',
          '',
          '| Öğrenci | 1. Sınav | 2. Sınav | Performans | Durum Notu |',
          '| --- | --- | --- | --- | --- |',
          '| Ayşe Yılmaz | 85 | 90 | 95 | Katılım yüksek |',
          '| Mehmet Demir | 72,5 | 68 | 75 | Düzenli |',
          '| Zeynep Ak | 92 | 96 | 100 | Proje teslim |',
          '| Can Kaya | 42 | 46 | 50 | Ek çalışma |',
          '',
          '<<gradebook pass="50">>'
        ].join('\n'),
        ['Not Çizelgesi', '10-A', 'Matematik'],
        { sinif: '10-A', ders: 'Matematik', donem: '2026-2027 Güz' }
      ),
      make(
        'Örnek Ders: Fonksiyonlar',
        [
          '# Fonksiyon Kavramı ve Grafik Okuma',
          '',
          '**Sınıf:** {{!!sinif}} · **Süre:** {{!!sure}} · **Kazanım:** {{!!kazanim}}',
          '',
          '## Ders Akışı',
          '- [x] Günlük hayattan eşleşme örnekleri (5 dk)',
          '- [ ] Tanım ve değer kümesi kavramı (15 dk)',
          '- [ ] Tahtada 4 grafik örneği ve öğrencilerin çözümü (15 dk)',
          '- [ ] [[Örnek Ödev: 2. Hafta Çalışma Kâğıdı]] açıklaması (5 dk)',
          '',
          '## Materyaller ve Ekler',
          'Bu kartı düzenlerken **Dosya / Materyal Ekle** düğmesiyle ders föyünü (`.pdf`) veya slaytını (`.pptx`) içine gömebilirsin.',
          '',
          '<<timer minutes="40" label="Ders Süresi">>'
        ].join('\n'),
        ['Ders', 'Matematik', '10-A'],
        { sinif: '10-A', sure: '40 dk', kazanim: 'M.10.2.1.1' }
      ),
      make(
        'Örnek Ödev: 2. Hafta Çalışma Kâğıdı',
        [
          '# 2. Hafta: Doğrusal Fonksiyonlar Ödevi',
          '',
          '**Sınıf:** {{!!sinif}} · **Son Teslim:** {{!!teslim}} · **Durum:** =={{!!durum}}==',
          '',
          '## Görevler',
          '- [ ] 1–10 arası grafik okuma soruları çözülecek',
          '- [ ] Sınıf kontrolü ve ödev puanlarının [[10-A Matematik Not Çizelgesi]] kartına işlenmesi',
          '',
          '<<set-field field="durum" value="teslim-edildi" label="Kontrol Edildi İşaretle">> <<set-field field="durum" value="kapandi" label="Ödevi Kapat">>'
        ].join('\n'),
        ['Ödev', 'Matematik', '10-A'],
        { sinif: '10-A', teslim: '2026-12-01', durum: 'bekliyor' }
      ),
      make(
        'Şablon: Ders Planı',
        [
          '# ${baslik}',
          '',
          '**Tarih:** ${tarih} · **Sınıf:** {{!!sinif}} · **Kazanım:** {{!!kazanim}}',
          '',
          '## Giriş ve Isınma',
          '- ',
          '',
          '## Ana Etkinlik',
          '- [ ] Konu anlatımı',
          '- [ ] Uygulama / soru çözümü',
          '',
          '## Değerlendirme ve Ödev',
          '- ',
          '',
          '<<timer minutes="40" label="Ders Sayacı">>'
        ].join('\n'),
        ['$:/tags/Template', 'Ders'],
        { sinif: '10-A', sure: '40 dk', kazanim: '' }
      ),
      make(
        'Şablon: Ödev',
        [
          '# ${baslik}',
          '',
          '**Veriliş:** ${tarih} · **Sınıf:** {{!!sinif}} · **Teslim:** {{!!teslim}} · **Durum:** {{!!durum}}',
          '',
          '## Açıklama',
          '- ',
          '',
          '## Kontrol Listesi',
          '- [ ] Öğrencilere duyuruldu',
          '- [ ] Ödevler toplandı ve notlandı',
          '',
          '<<set-field field="durum" value="kapandi" label="Ödevi Kapat">>'
        ].join('\n'),
        ['$:/tags/Template', 'Ödev'],
        { sinif: '10-A', teslim: '', durum: 'acik' }
      ),
      make(
        'Şablon: Not Çizelgesi',
        [
          '# ${baslik}',
          '',
          '| Öğrenci | 1. Sınav | 2. Sınav | Performans | Not |',
          '| --- | --- | --- | --- | --- |',
          '| Örnek Öğrenci | 70 | 80 | 85 | |',
          '',
          '<<gradebook pass="50">>'
        ].join('\n'),
        ['$:/tags/Template', 'Not Çizelgesi'],
        { sinif: '', ders: '' }
      ),
      make(
        'Şablon: Öğrenci Gözlem',
        [
          '# ${baslik}',
          '',
          '**Tarih:** ${tarih} · **Sınıf:** {{!!sinif}} · **Veli Görüşmesi:** {{!!veli}}',
          '',
          '## Akademik Gözlem',
          '- ',
          '',
          '## Destek Planı',
          '- [ ] '
        ].join('\n'),
        ['$:/tags/Template', 'Öğrenci'],
        { sinif: '', veli: 'bekliyor' }
      ),
      make(
        'Sekme: Derslerim',
        [
          '### Ders İçerikleri (<<count filter="[tag[Ders]!tag[$:/tags/Template]]">>)',
          '',
          '<<list filter="[tag[Ders]!tag[$:/tags/Template]sort[title]]" empty="Ders kartı yok.">>',
          '',
          '<<new-card label="Yeni Ders Ekle" template="Şablon: Ders Planı" tags="Ders">>'
        ].join('\n'),
        ['$:/tags/SideBar'],
        { caption: 'Dersler' }
      ),
      make(
        'Sekme: Ödev Takibi',
        [
          '### Açık Ödevler (<<count filter="[tag[Ödev]!tag[$:/tags/Template]!field:durum[kapandi]]">>)',
          '',
          '<<list filter="[tag[Ödev]!tag[$:/tags/Template]!field:durum[kapandi]sort[title]]" empty="Açık ödev yok.">>',
          '',
          '### Not Çizelgeleri',
          '<<list filter="[tag[Not Çizelgesi]!tag[$:/tags/Template]sort[title]]" empty="Çizelge yok.">>',
          '',
          '<<new-card label="Yeni Ödev Ekle" template="Şablon: Ödev" tags="Ödev">>'
        ].join('\n'),
        ['$:/tags/SideBar'],
        { caption: 'Ödevler' }
      )
    ];
  }
};
