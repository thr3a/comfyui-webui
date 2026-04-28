export type WorkflowNode = {
  class_type: string;
  inputs: Record<string, unknown>;
};

export type Workflow = Record<string, WorkflowNode>;

export const isWorkflow = (json: unknown): json is Workflow => {
  if (typeof json !== 'object' || json === null) return false;
  return Object.values(json as Record<string, unknown>).every(
    (v) => typeof v === 'object' && v !== null && 'class_type' in v && 'inputs' in v
  );
};

export const injectResolution = (workflow: Workflow, width: number, height: number): Workflow => {
  const result: Workflow = structuredClone(workflow);
  for (const node of Object.values(result)) {
    if (typeof node.inputs.width === 'number') {
      node.inputs.width = width;
    }
    if (typeof node.inputs.height === 'number') {
      node.inputs.height = height;
    }
  }
  return result;
};

export type TagScore = {
  tag: string;
  score: number;
};

export type Text2TagsRequest = {
  text: string;
  translate_mode?: 'exact' | 'loose';
};

export type Text2TagsResponse = {
  tags: string[];
  tags_str: string;
  tag_scores: TagScore[];
};

export const callText2Tags = async (req: Text2TagsRequest): Promise<Text2TagsResponse> => {
  const res = await fetch('https://ai-api.turai.work/text2tags/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<Text2TagsResponse>;
};

export const injectPrompts = (workflow: Workflow, prompt: string, negativePrompt: string): Workflow => {
  const result: Workflow = structuredClone(workflow);
  for (const node of Object.values(result)) {
    for (const key of Object.keys(node.inputs)) {
      if (node.inputs[key] === '%prompt%') {
        node.inputs[key] = prompt;
      } else if (node.inputs[key] === '%negative_prompt%') {
        node.inputs[key] = negativePrompt;
      }
    }
  }
  return result;
};
