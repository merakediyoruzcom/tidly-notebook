import { twTimestamp } from '../core/utils.js';

export const STUDENT_PACK = {
  id: 'student',
  filename: 'tidly-ogrenci.html',
  siteTitle: 'Tidly Öğrenci Defteri',
  siteSubtitle: 'Cornell ders notları, Pomodoro sayacı ve sınav tekrar takibi',
  palette: 'paper',
  defaultTiddlers: '[[Çalışma Panosu]] [[Örnek Ders Notu: Hücre Bölünmesi]]',
  landingCard: 'Çalışma Panosu',
  nameTr: 'Öğrenci',
  nameEn: 'Student',
  descTr: 'Cornell yöntemiyle ders notu şablonu, Pomodoro çalışma sayacı ve konu tekrar takibi.',
  descEn: 'Cornell note-taking templates, Pomodoro focus timer, and exam review tracking.',
  badgeTr: 'Ders & Sınav',
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
        'Çalışma Panosu',
        [
          '# Öğrenci Çalışma Panosu',
          '',
          'Ders notlarını bağlantılandır, eksik konuları işaretle ve doğrudan defterin içinde Pomodoro sayacıyla odaklan.',
          '',
          '<<timer minutes="25" label="Pomodoro Odak">>',
          '',
          '## Hızlı Kartlar',
          '<<new-card label="Cornell Ders Notu" template="Şablon: Cornell Ders Notu" tags="Ders Notu">> <<new-card label="Sınav Tekrarı" template="Şablon: Sınav Tekrar" tags="Sınav">>',
          '',
          '## Tekrar Bekleyen Konular',
          '<<list filter="[tag[Ders Notu]!tag[$:/tags/Template]!field:tekrar[tamam]sort[title]]" empty="Bekleyen konu yok.">>'
        ].join('\n'),
        ['Pano', 'Öğrenci']
      ),
      make(
        'Örnek Ders Notu: Hücre Bölünmesi',
        [
          '# Hücre Bölünmesi: Mitoz ve Mayoz',
          '',
          '**Ders:** {{!!ders}} · **Tekrar Durumu:** =={{!!tekrar}}==',
          '',
          '## Anahtar Kavramlar',
          '- Profaz, Metafaz, Anafaz, Telofaz',
          '- Krossing-over sadece mayoz bölünmede görülür.',
          '',
          '## Detaylı Notlar',
          '- Mitoz sonucu `2n` kromozomlu 2 özdeş hücre oluşur.',
          '- Mayoz sonucu `n` kromozomlu 4 gamet hücresi oluşur.',
          '',
          '## Kısa Özet ve Soru',
          '- [x] Konu özetini çıkar',
          '- [ ] 20 çıkmış soru çöz',
          '',
          '<<set-field field="tekrar" value="tamam" label="Tekrarı Tamamla">>'
        ].join('\n'),
        ['Ders Notu', 'Biyoloji'],
        { ders: 'Biyoloji', tekrar: 'bekliyor' }
      ),
      make(
        'Şablon: Cornell Ders Notu',
        [
          '# ${baslik}',
          '',
          '**Tarih:** ${tarih} · **Ders:** {{!!ders}} · **Tekrar:** {{!!tekrar}}',
          '',
          '## İpuçları ve Sorular',
          '- ',
          '',
          '## Ders Notları',
          '- ',
          '',
          '## Özet',
          '- ',
          '',
          '<<set-field field="tekrar" value="tamam" label="Tekrarı Tamamla">>'
        ].join('\n'),
        ['$:/tags/Template', 'Ders Notu'],
        { ders: 'Genel', tekrar: 'bekliyor' }
      ),
      make(
        'Şablon: Sınav Tekrar',
        [
          '# ${baslik}',
          '',
          '**Hedef Tarih:** {{!!sinav_tarihi}}',
          '',
          '## Konular',
          '- [ ] Konu 1',
          '- [ ] Konu 2',
          '- [ ] Deneme çözümü',
          '',
          '<<timer minutes="45" label="Deneme Süresi">>'
        ].join('\n'),
        ['$:/tags/Template', 'Sınav'],
        { sinav_tarihi: '${tarih}' }
      ),
      make(
        'Şablon: Kitap Özeti',
        [
          '# ${baslik}',
          '',
          '**Yazar:** {{!!yazar}} · **Tarih:** ${tarih}',
          '',
          '## Ana Fikirler',
          '- ',
          '',
          '## Alıntılar',
          '> '
        ].join('\n'),
        ['$:/tags/Template', 'Kitap'],
        { yazar: '' }
      ),
      make(
        'Sekme: Çalışma Takibi',
        [
          '### Tekrar Bekleyenler (<<count filter="[tag[Ders Notu]!tag[$:/tags/Template]!field:tekrar[tamam]]">>)',
          '',
          '<<list filter="[tag[Ders Notu]!tag[$:/tags/Template]!field:tekrar[tamam]sort[title]]" empty="Tüm konular tekrar edildi!">>',
          '',
          '<<new-card label="Yeni Ders Notu" template="Şablon: Cornell Ders Notu" tags="Ders Notu">>'
        ].join('\n'),
        ['$:/tags/SideBar'],
        { caption: 'Çalışma' }
      )
    ];
  }
};
