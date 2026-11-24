import { twTimestamp } from '../core/utils.js';

export const SHADOW_TIDDLERS = [
  { title: '$:/SiteTitle', text: 'Tidly Notebook', type: 'text/plain' },
  { title: '$:/SiteSubtitle', text: 'Tek dosyalık kişisel bilgi tabanın', type: 'text/plain' },
  { title: '$:/DefaultTiddlers', text: '[[Hoş Geldiniz]] [[Hızlı Başlangıç]]', type: 'text/plain' },
  { title: '$:/Palette', text: 'paper', type: 'text/plain' },
  { title: '$:/CustomColors', text: '{}', type: 'application/json' },
  { title: '$:/Font', text: 'editorial', type: 'text/plain' },
  { title: '$:/FontSize', text: '16', type: 'text/plain' },
  { title: '$:/Layout', text: 'river', type: 'text/plain' },
  { title: '$:/Language', text: 'tr', type: 'text/plain' },
  { title: '$:/ActiveMode', text: 'general', type: 'text/plain' }
];

export function createStarterTiddlers() {
  const ts = twTimestamp();
  const make = (title, text, tags = [], fields = {}, type = 'text/vnd.tidly') => ({
    title,
    text,
    tags,
    type,
    created: ts,
    modified: ts,
    fields
  });

  return [
    make(
      'Hoş Geldiniz',
      [
        '# Tidly Notebook’a Hoş Geldin',
        '',
        '**Tidly Notebook**, hiçbir sunucu veya kurulum gerektirmeden tek bir `.html` dosyasının içinde yaşayan, tamamen çevrimdışı çalışan kişisel bilgi tabanındır.',
        '',
        '## Öne Çıkanlar',
        '- **Tek Dosya Taşınabilirlik:** Tüm notların, etiketlerin, özel alanların, temaların ve şablonların doğrudan bu dosyanın içine gömülüdür.',
        '- **Çift Yönlü Bağlantılar:** `[[Kart Adı]]` ile kartları birbirine bağla, alttaki bilgi panelinden geri bağlantıları gör, ağ görünümünde **Grafik** ile incele.',
        '- **Canlı İç İçe Gömme:** `{{Kart Adı}}` veya `{{Kart Adı!!alan}}` yazarak başka bir kartın içeriğini ya da alanını canlı yansıt.',
        '- **Dinamik Filtreler:** `<<list>>`, `<<count>>` ve `<<toc>>` makrolarıyla otomatik güncellenen dizinler kur.',
        '- **Güvenli Kayıt:** Her düzenleme anında tarayıcıda (IndexedDB) yedeklenir; **Kaydet** (`Ctrl+S`) ile güncel `.html` dosyasını saklayabilirsin.',
        '',
        '## Nereden Başlamalı?',
        '1. [[Hızlı Başlangıç]] kartında canlı yazım örneklerini incele.',
        '2. [[Filtre ve Dinamik Listeler]] ile sorgu dilini gör.',
        '3. [[Özelleştirme Rehberi]] ile kendi temalarını, şablonlarını ve yan panel sekmelerini ekle.',
        '',
        '<<new-card label="Yeni Günlük Aç" template="Şablon: Günlük" tags="Günlük">>'
      ].join('\n'),
      ['Rehber', 'Başlangıç']
    ),
    make(
      'Hızlı Başlangıç',
      [
        '# Hızlı Başlangıç ve Sözdizimi',
        '',
        'Bu kart Markdown ve WikiText bileşenlerinin canlı çalışmasını gösterir.',
        '',
        '## 1. Bağlantılar ve Görev Listesi',
        '- [ ] [[Örnek Not]] kartını aç ve özel alanlarını incele',
        '- [x] İlk kartını incelemeye başla',
        '- [ ] Sağ üstten **Grafik** görünümünü veya `Ctrl+K` hızlı aramayı dene',
        '',
        '> [!İPUCU]',
        '> Okuma görünümündeki görev kutularına doğrudan tıklayabilirsin; değişiklik kart metnine otomatik işlenir.',
        '',
        '## 2. Canlı İç İçe Gömme (Transclusion)',
        'Aşağıdaki blok [[Örnek Not]] kartından canlı çekiliyor (`{{Örnek Not}}`):',
        '',
        '{{Örnek Not}}',
        '',
        'Tek bir alanı çekmek için `{{Örnek Not!!durum}}` kullanılır: **{{Örnek Not!!durum}}**.',
        '',
        '## 3. Tablo ve Kod Örneği',
        '| Kısayol | İşlev |',
        '| --- | --- |',
        '| `Ctrl+K` | Hızlı arama ve komut paleti |',
        '| `Ctrl+S` | HTML dosyasını kaydet |',
        '| `Alt+N` | Yeni kart oluştur |',
        '',
        '```text',
        '[[Hedef Kart]] · [[Görünen Metin|Hedef Kart]]',
        '{{İç İçe Gömme}} · {{Kart!!alan}}',
        '<<list filter="[tag[Rehber]sort[title]]">>',
        '```'
      ].join('\n'),
      ['Rehber']
    ),
    make(
      'Örnek Not',
      [
        'Bu kart özel alanlar (`durum`, `oncelik`) ve güvenli eylem makroları taşır.',
        '',
        'Şu anki durum alanı: =={{!!durum}}== | Öncelik: **{{!!oncelik}}**',
        '',
        '<<set-field tiddler="Örnek Not" field="durum" value="tamamlandi" label="Durumu Tamamlandı Yap">> <<set-field tiddler="Örnek Not" field="durum" value="aktif" label="Aktife Çevir">>'
      ].join('\n'),
      ['Rehber', 'Proje'],
      { durum: 'aktif', oncelik: 'yuksek' }
    ),
    make(
      'Filtre ve Dinamik Listeler',
      [
        '# Filtre Dili ve Dinamik Makrolar',
        '',
        'Kartların içindeki listeler elle güncellenmez; filtrelerle kendiliğinden oluşur.',
        '',
        '- Toplam proje kartı: <<count filter="[tag[Proje]]">>',
        '- Tüm rehber kartları:',
        '',
        '<<list filter="[tag[Rehber]sort[title]]">>',
        '',
        '## İçindekiler Ağacı (`<<toc>>`)',
        '<<toc tag="Rehber">>',
        '',
        '## Sık Kullanılan Operatörler',
        '- `[tag[Proje]!field:durum[tamamlandi]sort[modified]]` — Tamamlanmamış projeler',
        '- `[search[anahtar]]` — Türkçe karakter duyarsız tam metin araması',
        '- `[orphans[]]` — Hiç bağlantı almayan kartlar',
        '- `[missing[]]` — Bağlantı verilen ama henüz oluşturulmamış başlıklar',
        '',
        'Kenar çubuğundaki **Filtre** sekmesinden sorguları anında test edebilirsin.'
      ].join('\n'),
      ['Rehber']
    ),
    make(
      'Özelleştirme Rehberi',
      [
        '# Tidly Notebook’u Kendine Göre Şekillendir',
        '',
        'Her özel davranış normal bir sistem etiketiyle çalışır; dışarıdan kod derlemen gerekmez.',
        '',
        '## Özel Etiketler',
        '- `$:/tags/Stylesheet`: İçine saf CSS yazdığın kartlar anında uygulanır (`var(--bg)`, `var(--surface)`, `var(--ink)`, `var(--accent)` değişkenlerini kullanabilirsin).',
        '- `$:/tags/SideBar`: Bu etikete sahip kartlar yan panelde yeni bir sekmeye dönüşür (örnek: [[Özel Sekme: Görevler]]). Sekme adı için `caption` özel alanını kullan.',
        '- `$:/tags/Template`: **Yeni Kart** menüsünde hazır şablon olarak görünür. `${tarih}`, `${saat}` ve `${baslik}` yer tutucuları oluşturma anında doldurulur.',
        '- `$:/tags/Macro`: `\\define ad(param) ... \\end` biçiminde kendi makrolarını tanımlayabilirsin (örnek: [[Örnek Makro]]).',
        '',
        '## Sistem Kartları (`$:/`)',
        '**Sistem** sekmesinden `$:/SiteTitle`, `$:/SiteSubtitle`, `$:/DefaultTiddlers` veya `$:/Palette` kartlarını doğrudan düzenleyip istediğin an varsayılana sıfırlayabilirsin.'
      ].join('\n'),
      ['Rehber']
    ),
    make(
      'Şablon: Günlük',
      [
        '# ${tarih} — ${baslik}',
        '',
        'Saat: ${saat}',
        '',
        '## Bugünün Odağı',
        '- [ ] İlk adım',
        '',
        '## Notlar',
        ''
      ].join('\n'),
      ['$:/tags/Template']
    ),
    make(
      'Şablon: Görev',
      [
        '# ${baslik}',
        '',
        '**Oluşturulma:** ${tarih} · **Durum:** {{!!durum}}',
        '',
        '- [ ] Yapılacak ilk adım',
        '',
        '<<set-field field="durum" value="tamamlandi" label="Tamamlandı Olarak İşaretle">>'
      ].join('\n'),
      ['$:/tags/Template', 'Proje'],
      { durum: 'bekliyor', oncelik: 'orta' }
    ),
    make(
      'Özel Sekme: Görevler',
      [
        '### Açık Projeler (<<count filter="[tag[Proje]!tag[$:/tags/Template]!field:durum[tamamlandi]]">>)',
        '',
        '<<list filter="[tag[Proje]!tag[$:/tags/Template]!field:durum[tamamlandi]sort[title]]" empty="Açık proje kartı bulunmuyor.">>',
        '',
        '<<new-card label="Yeni Görev Kartı" template="Şablon: Görev" tags="Proje">>'
      ].join('\n'),
      ['$:/tags/SideBar'],
      { caption: 'Görevler' }
    ),
    make(
      'Örnek Makro',
      [
        '\\define rozet(etiket, deger)',
        '**$etiket$:** ==$deger$==',
        '\\end'
      ].join('\n'),
      ['$:/tags/Macro']
    )
  ];
}
