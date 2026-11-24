import { generateWikiId, twTimestamp } from '../core/utils.js';
import { createStarterTiddlers } from '../seed/starter-tiddlers.js';
import { TEACHER_PACK } from './teacher.js';
import { DOCTOR_PACK } from './doctor.js';
import { CHEF_PACK } from './chef.js';
import { STUDENT_PACK } from './student.js';

export const WORKSPACE_PACKS = [
  {
    id: 'general',
    filename: 'tidly-notebook.html',
    siteTitle: 'Tidly Notebook',
    siteSubtitle: 'Tek dosyalık kişisel bilgi tabanın',
    palette: 'paper',
    defaultTiddlers: '[[Hoş Geldiniz]] [[Hızlı Başlangıç]]',
    landingCard: 'Hoş Geldiniz',
    nameTr: 'Genel / Standart',
    nameEn: 'General / Standard',
    descTr: 'Klasik kişisel wiki: bağlantılar, iç içe gömme, dinamik filtreler ve özgür kart düzeni.',
    descEn: 'Classic personal wiki with links, transclusions, dynamic filters, and freeform cards.',
    badgeTr: 'Varsayılan',
    createTiddlers: createStarterTiddlers
  },
  TEACHER_PACK,
  DOCTOR_PACK,
  CHEF_PACK,
  STUDENT_PACK
];

export function getPackById(packId) {
  return WORKSPACE_PACKS.find((p) => p.id === packId) || WORKSPACE_PACKS[0];
}

export function buildEditionStoreData(packId) {
  const pack = getPackById(packId);
  const ts = twTimestamp();
  const baseTiddlers = pack.createTiddlers();
  const existingTitles = new Set(baseTiddlers.map((t) => t.title));

  const systemTiddlers = [
    { title: '$:/SiteTitle', text: pack.siteTitle, type: 'text/plain' },
    { title: '$:/SiteSubtitle', text: pack.siteSubtitle, type: 'text/plain' },
    { title: '$:/Palette', text: pack.palette, type: 'text/plain' },
    { title: '$:/DefaultTiddlers', text: pack.defaultTiddlers, type: 'text/plain' },
    { title: '$:/ActiveMode', text: pack.id, type: 'text/plain' }
  ];

  const tiddlers = [...baseTiddlers];
  for (const sys of systemTiddlers) {
    if (!existingTitles.has(sys.title)) {
      tiddlers.push({
        title: sys.title,
        text: sys.text,
        tags: [],
        type: sys.type,
        created: ts,
        modified: ts,
        fields: {},
        attachments: []
      });
    }
  }

  return {
    v: 1,
    wikiId: generateWikiId(),
    updatedAt: ts,
    tiddlers
  };
}

export function mergePackIntoStore(store, packId, { applyTheme = true } = {}) {
  const pack = getPackById(packId);
  const cards = pack.createTiddlers();
  const added = [];

  for (const card of cards) {
    if (!store.hasUser(card.title)) {
      store.put(card, { recordUndo: false, touchModified: false });
      added.push(card.title);
    }
  }

  store.put({ title: '$:/ActiveMode', text: pack.id, type: 'text/plain' }, { recordUndo: false });
  if (applyTheme) {
    store.put({ title: '$:/Palette', text: pack.palette, type: 'text/plain' }, { recordUndo: false });
  }
  return added;
}
