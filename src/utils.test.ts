import { describe, expect, it } from 'vitest';
import type { Workflow } from './utils';
import { injectPrompts, isWorkflow } from './utils';

describe('isWorkflow', () => {
  it('有効なワークフローを判定できる', () => {
    const wf = {
      '1': { class_type: 'KSampler', inputs: { steps: 20 } }
    };
    expect(isWorkflow(wf)).toBe(true);
  });

  it('class_type または inputs が欠けている場合は false', () => {
    expect(isWorkflow({ '1': { class_type: 'Foo' } })).toBe(false);
    expect(isWorkflow({ '1': { inputs: {} } })).toBe(false);
  });

  it('null / プリミティブは false', () => {
    expect(isWorkflow(null)).toBe(false);
    expect(isWorkflow('string')).toBe(false);
    expect(isWorkflow(42)).toBe(false);
  });
});

describe('injectPrompts', () => {
  const baseWorkflow = (): Workflow => ({
    '1': {
      class_type: 'CLIPTextEncode',
      inputs: { text: '%prompt%' }
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: { text: '%negative_prompt%' }
    },
    '3': {
      class_type: 'KSampler',
      inputs: { steps: 20, cfg: 7 }
    }
  });

  it('%prompt% をプロンプトで置換する', () => {
    const result = injectPrompts(baseWorkflow(), 'a cat', '');
    expect(result['1'].inputs.text).toBe('a cat');
  });

  it('%negative_prompt% をネガティブプロンプトで置換する', () => {
    const result = injectPrompts(baseWorkflow(), '', 'blurry');
    expect(result['2'].inputs.text).toBe('blurry');
  });

  it('ネガティブプロンプトが空文字の場合は空文字を設定する', () => {
    const result = injectPrompts(baseWorkflow(), 'a dog', '');
    expect(result['2'].inputs.text).toBe('');
  });

  it('%prompt%/%negative_prompt% 以外の値は変更しない', () => {
    const result = injectPrompts(baseWorkflow(), 'a cat', 'blurry');
    expect(result['3'].inputs.steps).toBe(20);
    expect(result['3'].inputs.cfg).toBe(7);
  });

  it('元のワークフローを変更しない（immutable）', () => {
    const original = baseWorkflow();
    injectPrompts(original, 'a cat', 'blurry');
    expect(original['1'].inputs.text).toBe('%prompt%');
    expect(original['2'].inputs.text).toBe('%negative_prompt%');
  });

  it('%prompt% に部分一致する文字列は置換しない', () => {
    const wf: Workflow = {
      '1': { class_type: 'CLIPTextEncode', inputs: { text: 'prefix %prompt% suffix' } }
    };
    const result = injectPrompts(wf, 'a cat', '');
    expect(result['1'].inputs.text).toBe('prefix %prompt% suffix');
  });

  it('%negative_prompt% がない場合でもクラッシュしない', () => {
    const wf: Workflow = {
      '1': { class_type: 'CLIPTextEncode', inputs: { text: '%prompt%' } }
    };
    const result = injectPrompts(wf, 'hello', 'ng');
    expect(result['1'].inputs.text).toBe('hello');
  });

  it('同一キーに複数ノードで %prompt% があれば全て置換する', () => {
    const wf: Workflow = {
      '1': { class_type: 'A', inputs: { text: '%prompt%' } },
      '2': { class_type: 'B', inputs: { text: '%prompt%' } }
    };
    const result = injectPrompts(wf, 'sunset', '');
    expect(result['1'].inputs.text).toBe('sunset');
    expect(result['2'].inputs.text).toBe('sunset');
  });
});
