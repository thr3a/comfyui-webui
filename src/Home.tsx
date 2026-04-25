import { Alert, Button, Container, FileInput, Image, Stack, Text, Textarea } from '@mantine/core';
import { useRef, useState } from 'react';

type WorkflowNode = {
  class_type: string;
  inputs: Record<string, unknown>;
};

type Workflow = Record<string, WorkflowNode>;

type ResultItem = {
  filename: string;
  subfolder: string;
  type: string;
};

const isWorkflow = (json: unknown): json is Workflow => {
  if (typeof json !== 'object' || json === null) return false;
  return Object.values(json as Record<string, unknown>).every(
    (v) => typeof v === 'object' && v !== null && 'class_type' in v && 'inputs' in v,
  );
};

// KSamplerのpositiveに繋がっているノードIDを探す
const findPositiveNodeId = (workflow: Workflow): string | null => {
  for (const node of Object.values(workflow)) {
    if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
      const positive = node.inputs.positive;
      if (Array.isArray(positive) && typeof positive[0] === 'string') {
        return positive[0];
      }
    }
  }
  return null;
};

export default function Home() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef(crypto.randomUUID());

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed: unknown = JSON.parse(e.target?.result as string);
        if (!isWorkflow(parsed)) {
          setError('有効なComfyUIワークフローJSONではありません');
          return;
        }
        setWorkflow(parsed);
        setError(null);
      } catch {
        setError('JSONの解析に失敗しました');
      }
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    if (!workflow || !prompt) return;
    setGenerating(true);
    setError(null);
    setImageUrl(null);

    const wf: Workflow = structuredClone(workflow);
    const positiveNodeId = findPositiveNodeId(wf);
    if (positiveNodeId && wf[positiveNodeId]) {
      wf[positiveNodeId].inputs.text = prompt;
    }

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: wf, client_id: clientId.current }),
      });
      const data: { prompt_id?: string; error?: string } = await res.json();
      if (!res.ok || !data.prompt_id) {
        setError(data.error ?? 'プロンプトの送信に失敗しました');
        setGenerating(false);
        return;
      }

      const promptId = data.prompt_id;
      const ws = new WebSocket(`ws://${location.host}/ws?clientId=${clientId.current}`);

      ws.onmessage = (event: MessageEvent<string>) => {
        const msg: { type: string; data: { prompt_id: string; output?: { images?: ResultItem[] }; exception_message?: string } } = JSON.parse(event.data);
        if (msg.type === 'executed' && msg.data.prompt_id === promptId) {
          const images = msg.data.output?.images ?? [];
          if (images.length > 0) {
            const { filename, subfolder, type } = images[0];
            const params = new URLSearchParams({ filename, type });
            if (subfolder) params.set('subfolder', subfolder);
            setImageUrl(`/api/view?${params.toString()}`);
            setGenerating(false);
            ws.close();
          }
        }
        if (msg.type === 'execution_error' && msg.data.prompt_id === promptId) {
          setError(msg.data.exception_message ?? '実行中にエラーが発生しました');
          setGenerating(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError('WebSocket接続エラーが発生しました');
        setGenerating(false);
      };
    } catch {
      setError('リクエストに失敗しました。ComfyUIが起動しているか確認してください。');
      setGenerating(false);
    }
  };

  return (
    <Container maw={800} py="xl">
      <Stack>
        <FileInput
          label="ワークフローJSON"
          description="ComfyUIからエクスポートしたワークフローファイルを選択"
          placeholder="JSONファイルを選択..."
          accept=".json"
          onChange={handleFileChange}
        />
        {workflow && (
          <Text size="sm" c="dimmed">
            読み込み済み: {Object.keys(workflow).length} ノード
          </Text>
        )}
        <Textarea
          label="プロンプト"
          placeholder="生成したい画像の説明を入力"
          minRows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
        />
        <Button
          onClick={handleGenerate}
          loading={generating}
          disabled={!workflow || !prompt}
          size="md"
        >
          生成
        </Button>
        {error && (
          <Alert color="red" title="エラー">
            {error}
          </Alert>
        )}
        {imageUrl && <Image src={imageUrl} />}
      </Stack>
    </Container>
  );
}
