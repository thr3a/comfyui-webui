import { describe, expect, it } from 'vitest';
import type { Workflow } from './utils';
import { injectPrompts, injectResolution, isWorkflow } from './utils';

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

describe('injectResolution', () => {
  const baseWorkflow = (): Workflow => ({
    '1': {
      class_type: 'EmptyLatentImage',
      inputs: { width: 512, height: 512, batch_size: 1 }
    },
    '2': {
      class_type: 'KSampler',
      inputs: { steps: 20, cfg: 7 }
    }
  });

  it('width と height を上書きする', () => {
    const result = injectResolution(baseWorkflow(), 1024, 768);
    expect(result['1'].inputs.width).toBe(1024);
    expect(result['1'].inputs.height).toBe(768);
  });

  it('width / height を持たないノードは変更しない', () => {
    const result = injectResolution(baseWorkflow(), 1024, 768);
    expect(result['2'].inputs.steps).toBe(20);
    expect(result['2'].inputs.cfg).toBe(7);
  });

  it('batch_size など width/height 以外の値は変更しない', () => {
    const result = injectResolution(baseWorkflow(), 1024, 768);
    expect(result['1'].inputs.batch_size).toBe(1);
  });

  it('width と height を持つノードが複数あれば全て上書きする', () => {
    const wf: Workflow = {
      '1': { class_type: 'A', inputs: { width: 512, height: 512 } },
      '2': { class_type: 'B', inputs: { width: 256, height: 256 } }
    };
    const result = injectResolution(wf, 1280, 720);
    expect(result['1'].inputs.width).toBe(1280);
    expect(result['1'].inputs.height).toBe(720);
    expect(result['2'].inputs.width).toBe(1280);
    expect(result['2'].inputs.height).toBe(720);
  });

  it('文字列の width/height は上書きしない', () => {
    const wf: Workflow = {
      '1': { class_type: 'A', inputs: { width: 'auto', height: 'auto' } }
    };
    const result = injectResolution(wf, 1024, 768);
    expect(result['1'].inputs.width).toBe('auto');
    expect(result['1'].inputs.height).toBe('auto');
  });

  it('元のワークフローを変更しない（immutable）', () => {
    const original = baseWorkflow();
    injectResolution(original, 1024, 768);
    expect(original['1'].inputs.width).toBe(512);
    expect(original['1'].inputs.height).toBe(512);
  });
});
