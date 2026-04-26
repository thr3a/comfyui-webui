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
