import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarkdownTable,
  computeGradebookStats,
  appendTableRow,
  extractRecipeIngredients,
  scaleIngredientLine,
  calculateBmi,
  calculateWeightDose
} from '../src/core/widgets.js';
import { TiddlerStore } from '../src/core/store.js';
import { renderWikiText } from '../src/core/parser.js';

test('gradebook computes Turkish decimal commas, ignores blank cells, and appends rows cleanly (Review Focus #3)', () => {
  const md = [
    '# 10-A Matematik',
    '',
    'Dönem notları aşağıdadır.',
    '',
    '| Öğrenci | Sınav 1 | Sınav 2 | Sözlü | Not |',
    '| --- | --- | --- | --- | --- |',
    '| Ayşe Yılmaz | 80 | 90 | | İyi |',
    '| Mehmet Demir | 72,5 | 67,5 | 70 | |',
    '| Can Kaya | 40 | 45 | 50 | Tekrar |',
    '',
    '<<gradebook pass="50">>'
  ].join('\n');

  const table = parseMarkdownTable(md);
  assert.ok(table);
  assert.equal(table.rows.length, 3);

  const stats = computeGradebookStats(table, 50);
  assert.equal(stats.totalCount, 3);
  assert.equal(stats.rows[0].avg, 85);
  assert.equal(stats.rows[0].passed, true);
  assert.equal(stats.rows[1].avg, 70);
  assert.equal(stats.rows[1].passed, true);
  assert.equal(stats.rows[2].avg, 45);
  assert.equal(stats.rows[2].passed, false);
  assert.equal(stats.passCount, 2);
  assert.equal(stats.failCount, 1);
  assert.equal(stats.classAvg, 66.7);
  assert.equal(stats.highest, 85);
  assert.equal(stats.lowest, 45);

  const updated = appendTableRow(md, ['Zeynep Ak', '100', '90', '95', 'Süper']);
  assert.match(updated, /\| Zeynep Ak \| 100 \| 90 \| 95 \| Süper \|/);
  assert.match(updated, /Dönem notları aşağıdadır\./);
  assert.match(updated, /<<gradebook pass="50">>/);
});

test('recipe ingredient extraction and scaling handles integers, fractions, comma decimals, ranges, and text lines (Review Focus #4)', () => {
  const recipeText = [
    '# Mercimek Çorbası',
    '',
    '## Malzemeler',
    '- 200 g kırmızı mercimek',
    '- 1/2 su bardağı ince bulgur',
    '- 1,5 yemek kaşığı tereyağı',
    '- 2-3 diş sarımsak',
    '- Tuz ve kimyon',
    '',
    '## Hazırlanışı',
    '1. Yıka ve haşla.',
    '',
    '<<recipe servings="4">>'
  ].join('\n');

  const ingredients = extractRecipeIngredients(recipeText);
  assert.deepEqual(ingredients, [
    '200 g kırmızı mercimek',
    '1/2 su bardağı ince bulgur',
    '1,5 yemek kaşığı tereyağı',
    '2-3 diş sarımsak',
    'Tuz ve kimyon'
  ]);

  assert.equal(scaleIngredientLine('200 g kırmızı mercimek', 2), '400 g kırmızı mercimek');
  assert.equal(scaleIngredientLine('1/2 su bardağı ince bulgur', 2), '1 su bardağı ince bulgur');
  assert.equal(scaleIngredientLine('1,5 yemek kaşığı tereyağı', 2), '3 yemek kaşığı tereyağı');
  assert.equal(scaleIngredientLine('2-3 diş sarımsak', 0.5), '1-1.5 diş sarımsak');
  assert.equal(scaleIngredientLine('Tuz ve kimyon', 3), 'Tuz ve kimyon');
  assert.equal(scaleIngredientLine('1 1/2 su bardağı su', 2), '3 su bardağı su');
});

test('clinical calculators (BMI and weight-based dose) handle valid and invalid inputs', () => {
  const bmi = calculateBmi(75, 180);
  assert.deepEqual(bmi, { bmi: 23.1, category: 'normal' });
  assert.equal(calculateBmi(0, 180), null);

  const dose = calculateWeightDose(20, 50, 2);
  assert.deepEqual(dose, { dailyMg: 1000, singleDoseMg: 500 });
  assert.equal(calculateWeightDose(-5, 50, 2), null);
});

test('parser renders <<gradebook>>, <<recipe>>, <<timer>>, and <<calc>> safely without XSS', () => {
  const store = new TiddlerStore({
    tiddlers: [
      {
        title: 'Sınıf',
        text: '| Öğrenci | Puan |\n| --- | --- |\n| <script>x</script> | 80 |\n\n<<gradebook pass="60">>'
      },
      {
        title: 'Çorba',
        text: '## Malzemeler\n- 100 g mercimek\n\n<<recipe servings="2">>\n\n<<timer minutes="10" label="Pişir">>'
      },
      {
        title: 'Klinik',
        text: '<<calc type="bmi">>\n\n<<calc type="dose">>'
      }
    ]
  });

  const gbHtml = renderWikiText(store.getText('Sınıf'), store, { currentTiddler: 'Sınıf' });
  assert.match(gbHtml, /data-widget="gradebook"/);
  assert.match(gbHtml, /data-gb-form/);
  assert.equal(/<script>/i.test(gbHtml), false);

  const rcHtml = renderWikiText(store.getText('Çorba'), store, { currentTiddler: 'Çorba' });
  assert.match(rcHtml, /data-widget="recipe"/);
  assert.match(rcHtml, /100 g mercimek/);
  assert.match(rcHtml, /data-widget="timer"/);
  assert.match(rcHtml, /10:00/);

  const clHtml = renderWikiText(store.getText('Klinik'), store, { currentTiddler: 'Klinik' });
  assert.match(clHtml, /data-calc-type="bmi"/);
  assert.match(clHtml, /data-calc-type="dose"/);
});
