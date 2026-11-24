import { twTimestamp } from '../core/utils.js';

export const CHEF_PACK = {
  id: 'chef',
  filename: 'tidly-asci.html',
  siteTitle: 'Tidly Mutfak Defteri',
  siteSubtitle: 'Ölçeklenebilir tarifler, pişirme sayaçları ve alışveriş listesi',
  palette: 'sepia',
  defaultTiddlers: '[[Mutfak Panosu]] [[Tarif: Mercimek Çorbası]]',
  landingCard: 'Mutfak Panosu',
  nameTr: 'Aşçı',
  nameEn: 'Chef & Kitchen',
  descTr: 'Porsiyon ölçekleyen akıllı tarifler, tek tıkla alışveriş listesi aktarımı ve mutfak zamanlayıcıları.',
  descEn: 'Live portion-scaling recipes, one-click shopping list export, and kitchen timers.',
  badgeTr: 'Tarif & Mutfak',
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
        'Mutfak Panosu',
        [
          '# Mutfak Çalışma Panosu',
          '',
          'Tariflerini porsiyonlara göre anında ölçekle, mutfak kronometrelerini çalıştır ve seçtiğin malzemeleri tek dokunuşla [[Alışveriş Listesi]] kartına aktar.',
          '',
          '## Hızlı Eylemler',
          '<<new-card label="Yeni Tarif Yaz" template="Şablon: Tarif" tags="Tarif">> <<new-card label="Haftalık Menü" template="Şablon: Haftalık Menü" tags="Menü">>',
          '',
          '## Tariflerim',
          '<<list filter="[tag[Tarif]!tag[$:/tags/Template]sort[title]]" empty="Tarif yok.">>',
          '',
          '## Alışveriş',
          '- [[Alışveriş Listesi]]'
        ].join('\n'),
        ['Pano', 'Mutfak']
      ),
      make(
        'Tarif: Mercimek Çorbası',
        [
          '# Süzme Kırmızı Mercimek Çorbası',
          '',
          '**Kategori:** {{!!kategori}} · **Hazırlık:** {{!!hazirlik}} · **Pişirme:** {{!!pisirme}}',
          '',
          '## Malzemeler',
          '- 200 g kırmızı mercimek',
          '- 1 adet orta boy kuru soğan',
          '- 1 adet havuç',
          '- 1,5 yemek kaşığı tereyağı',
          '- 1/2 su bardağı su (ilk kavurma için) + 1 litre sıcak su',
          '- 2-3 diş sarımsak',
          '- Tuz, kimyon, kırmızı toz biber',
          '',
          '<<recipe servings="4">>',
          '',
          '## Hazırlanışı',
          '1. Soğan, sarımsak ve havucu tereyağında 4 dakika çevirin.',
          '2. Yıkanmış mercimek ve sıcak suyu ekleyip kısık ateşte pişirin.',
          '3. Blender ile pürüzsüzleştirip baharatları ekleyin.',
          '',
          '<<timer minutes="25" label="Çorba Kaynatma">>'
        ].join('\n'),
        ['Tarif', 'Çorba'],
        { kategori: 'Çorba', hazirlik: '10 dk', pisirme: '25 dk' }
      ),
      make(
        'Tarif: Zeytinyağlı Enginar',
        [
          '# Portakallı Zeytinyağlı Enginar',
          '',
          '**Kategori:** {{!!kategori}} · **Hazırlık:** {{!!hazirlik}} · **Pişirme:** {{!!pisirme}}',
          '',
          '## Malzemeler',
          '- 6 adet ayıklanmış çanak enginar',
          '- 150 g bezelye',
          '- 2 adet orta boy havuç',
          '- 1 adet patates',
          '- 1/2 su bardağı sızma zeytinyağı',
          '- 1 adet portakal suyu ve 1 adet limon suyu',
          '- Dereotu ve tuz',
          '',
          '<<recipe servings="6">>',
          '',
          '## Hazırlanışı',
          '1. Küp doğranmış sebzeleri enginar çanaklarına paylaştırın.',
          '2. Zeytinyağı, portakal suyu, limon ve tuzu ekleyip kısık ateşte pişirin.',
          '',
          '<<timer minutes="30" label="Enginar Pişirme">>'
        ].join('\n'),
        ['Tarif', 'Zeytinyağlı'],
        { kategori: 'Zeytinyağlı', hazirlik: '15 dk', pisirme: '30 dk' }
      ),
      make(
        'Alışveriş Listesi',
        [
          '# Mutfak Alışveriş Listesi',
          '',
          'Tarif kartlarındaki **Alışveriş Listesine Ekle** düğmesine bastığında malzemeler ölçeklenmiş miktarlarıyla buraya eklenir.',
          '',
          '## Alınacaklar',
          '- [ ] Kuru nane',
          '- [ ] Sızma zeytinyağı'
        ].join('\n'),
        ['Mutfak', 'Liste']
      ),
      make(
        'Şablon: Tarif',
        [
          '# ${baslik}',
          '',
          '**Kategori:** {{!!kategori}} · **Hazırlık:** {{!!hazirlik}} · **Pişirme:** {{!!pisirme}}',
          '',
          '## Malzemeler',
          '- 200 g ',
          '- 1 yemek kaşığı ',
          '',
          '<<recipe servings="4">>',
          '',
          '## Hazırlanışı',
          '1. ',
          '',
          '<<timer minutes="20" label="Pişirme Süresi">>'
        ].join('\n'),
        ['$:/tags/Template', 'Tarif'],
        { kategori: 'Ana Yemek', hazirlik: '15 dk', pisirme: '20 dk' }
      ),
      make(
        'Şablon: Haftalık Menü',
        [
          '# ${baslik}',
          '',
          '| Gün | Öğle | Akşam | Not |',
          '| --- | --- | --- | --- |',
          '| Pazartesi | [[Tarif: Mercimek Çorbası]] | [[Tarif: Zeytinyağlı Enginar]] | |',
          '| Salı | | | |',
          '| Çarşamba | | | |'
        ].join('\n'),
        ['$:/tags/Template', 'Menü'],
        { hafta: '${tarih}' }
      ),
      make(
        'Şablon: Mutfak Maliyet',
        [
          '# ${baslik}',
          '',
          '| Malzeme | Birim Maliyet | Kullanılan | Not |',
          '| --- | --- | --- | --- |',
          '| Zeytinyağı (lt) | 350 | 0,25 | |',
          '',
          '<<gradebook pass="0">>'
        ].join('\n'),
        ['$:/tags/Template', 'Maliyet']
      ),
      make(
        'Sekme: Tarif Defteri',
        [
          '### Tarifler (<<count filter="[tag[Tarif]!tag[$:/tags/Template]]">>)',
          '',
          '<<list filter="[tag[Tarif]!tag[$:/tags/Template]sort[title]]" empty="Tarif bulunmuyor.">>',
          '',
          '<<new-card label="Yeni Tarif" template="Şablon: Tarif" tags="Tarif">>'
        ].join('\n'),
        ['$:/tags/SideBar'],
        { caption: 'Tarifler' }
      ),
      make(
        'Sekme: Alışveriş',
        [
          '### Alışveriş Listesi',
          '',
          '{{Alışveriş Listesi}}'
        ].join('\n'),
        ['$:/tags/SideBar'],
        { caption: 'Alışveriş' }
      )
    ];
  }
};
