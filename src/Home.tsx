import {
  Accordion,
  Alert,
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  Card,
  Divider,
  FileInput,
  Grid,
  Group,
  Image,
  Modal,
  NavLink,
  NumberInput,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip
} from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import {
  IconBolt,
  IconCheck,
  IconDownload,
  IconHistory,
  IconList,
  IconPencil,
  IconPhoto,
  IconPlayerStop,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconUpload,
  IconWand,
  IconX
} from '@tabler/icons-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { Workflow } from './utils';
import { injectPrompts, isWorkflow } from './utils';

type NavSection = 'generate' | 'history' | 'queue' | 'settings';

type StoredWorkflow = {
  id: string;
  name: string;
  json: Workflow;
};

type AppSettings = {
  serverUrl: string;
  defaultSteps: number;
  defaultCfg: number;
};

type GeneratedImage = {
  url: string;
  filename: string;
};

type DownloadableImage = {
  url: string;
  filename: string;
};

type ResultItem = {
  filename: string;
  subfolder: string;
  type: string;
};

type NodeOutput = {
  images?: ResultItem[];
};

type HistoryEntry = {
  outputs: Record<string, NodeOutput>;
  status: { status_str: string; completed: boolean };
};

// WebSocket メッセージの生パース用。data の中身はメッセージごとに異なるため Record<string, unknown> で受け取る
type WsRawMessage = {
  type: string;
  data: Record<string, unknown>;
};

type QueueRawItem = unknown[];

type ApiQueueResponse = {
  queue_running: QueueRawItem[];
  queue_pending: QueueRawItem[];
};

type ApiPromptResponse = {
  prompt_id?: string;
  error?: string;
};

type QueueItem = {
  promptId: string;
  status: 'running' | 'pending';
};

type GenerateFormStorage = {
  selectedWorkflowId: string | null;
  prompt: string;
  negativePrompt: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: 'http://127.0.0.1:8188',
  defaultSteps: 20,
  defaultCfg: 7
};

const buildViewUrl = (serverUrl: string, item: ResultItem): string => {
  const params = new URLSearchParams({ filename: item.filename, type: item.type });
  if (item.subfolder) params.set('subfolder', item.subfolder);
  return `${serverUrl}/api/view?${params.toString()}`;
};

const downloadImage = async ({ url, filename }: DownloadableImage) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('画像のダウンロードに失敗しました');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

// ---

type GenerateViewProps = {
  workflows: StoredWorkflow[];
  serverUrl: string;
  defaultSteps: number;
  defaultCfg: number;
  onAddWorkflow: (workflow: StoredWorkflow) => void;
};

const DEFAULT_GENERATE_FORM_STORAGE: GenerateFormStorage = {
  selectedWorkflowId: null,
  prompt: '',
  negativePrompt: ''
};

const GenerateView = ({ workflows, serverUrl, defaultSteps, defaultCfg, onAddWorkflow }: GenerateViewProps) => {
  // useLocalStorage は非同期ハイドレーションのため、useState で初期化すると defaultValue を取り込んでしまう。
  // フォーム値はここで保持する単一のソースとして直接読み書きする。
  const [storedGenerateForm, setStoredGenerateForm] = useLocalStorage<GenerateFormStorage>({
    key: 'comfyui_generate_form',
    defaultValue: DEFAULT_GENERATE_FORM_STORAGE
  });
  const updateForm = useCallback(
    (patch: Partial<GenerateFormStorage>) => {
      setStoredGenerateForm((prev) => ({ ...prev, ...patch }));
    },
    [setStoredGenerateForm]
  );
  const prompt = storedGenerateForm.prompt;
  const negativePrompt = storedGenerateForm.negativePrompt;
  const selectedWorkflowId =
    storedGenerateForm.selectedWorkflowId &&
    workflows.some((workflow) => workflow.id === storedGenerateForm.selectedWorkflowId)
      ? storedGenerateForm.selectedWorkflowId
      : (workflows[0]?.id ?? null);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentImageProgress, setCurrentImageProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(defaultSteps);
  const [completedCount, setCompletedCount] = useState(0);
  const [imageCount, setImageCount] = useState(1);
  const [steps, setSteps] = useState(defaultSteps);
  const [cfg, setCfg] = useState(defaultCfg);
  const [seed, setSeed] = useState(-1);
  const clientId = useRef(crypto.randomUUID());
  const wsRef = useRef<WebSocket | null>(null);
  // クロージャ内から最新の completedCount を参照するための ref
  const completedCountRef = useRef(0);

  const totalProgress = Math.round((completedCount * 100 + currentImageProgress) / imageCount);

  const handleFileUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed: unknown = JSON.parse(e.target?.result as string);
        if (!isWorkflow(parsed)) {
          setError('有効なComfyUIワークフローJSONではありません');
          return;
        }
        const newWorkflow: StoredWorkflow = { id: `w-${Date.now()}`, name: file.name, json: parsed };
        onAddWorkflow(newWorkflow);
        updateForm({ selectedWorkflowId: newWorkflow.id });
        setError(null);
      } catch {
        setError('JSONの解析に失敗しました');
      }
    };
    reader.readAsText(file);
  };

  const extractImages = (output: unknown): GeneratedImage[] => {
    if (typeof output !== 'object' || output === null) return [];
    // output は Record<string, unknown> として安全にアクセスするため as を使用
    const images = (output as Record<string, unknown>).images;
    if (!Array.isArray(images)) return [];
    const result: GeneratedImage[] = [];
    for (const img of images) {
      if (typeof img !== 'object' || img === null) continue;
      // WebSocket output の各 image オブジェクトへの汎用アクセスのため as を使用
      const rec = img as Record<string, unknown>;
      const filename = rec.filename;
      const type = rec.type;
      const subfolder = rec.subfolder;
      if (typeof filename !== 'string' || typeof type !== 'string') continue;
      result.push({
        url: buildViewUrl(serverUrl, { filename, type, subfolder: typeof subfolder === 'string' ? subfolder : '' }),
        filename
      });
    }
    return result;
  };

  const handleGenerate = async () => {
    const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);
    if (!selectedWorkflow) {
      setError('ワークフローを選択してください');
      return;
    }

    const count = imageCount;
    setGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setCurrentImageProgress(0);
    setCurrentStep(0);
    setTotalSteps(steps);
    setCompletedCount(0);
    completedCountRef.current = 0;

    const baseWf = injectPrompts(selectedWorkflow.json, prompt, negativePrompt);

    try {
      // count 枚分のプロンプトをキューに投入
      const ourIds = new Set<string>();
      for (let i = 0; i < count; i++) {
        const wf: Workflow = structuredClone(baseWf);
        for (const node of Object.values(wf)) {
          if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
            node.inputs.steps = steps;
            node.inputs.cfg = cfg;
            // seed=-1 は毎回ランダム、指定値の場合は i をオフセットして各枚異なるシードにする
            const resolvedSeed = seed === -1 ? Math.floor(Math.random() * 2 ** 32) : seed + i;
            node.inputs.seed = resolvedSeed;
            node.inputs.noise_seed = resolvedSeed;
          }
        }
        // Response.json() returns any; typed variable avoids explicit cast
        const res = await fetch(`${serverUrl}/api/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: wf, client_id: clientId.current })
        });
        const data: ApiPromptResponse = await res.json();
        if (!res.ok || !data.prompt_id) {
          setError(typeof data.error === 'string' ? data.error : 'プロンプトの送信に失敗しました');
          setGenerating(false);
          return;
        }
        ourIds.add(data.prompt_id);
      }

      const wsUrl = serverUrl.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'));
      const ws = new WebSocket(`${wsUrl}/ws?clientId=${clientId.current}`);
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent<string>) => {
        // JSON.parse の返り値は unknown のため、外部 WebSocket メッセージ受信時のみ as を使用
        const msg = JSON.parse(event.data) as WsRawMessage;
        const d = msg.data;
        if (typeof d.prompt_id !== 'string' || !ourIds.has(d.prompt_id)) return;

        if (msg.type === 'progress') {
          const value = d.value;
          const max = d.max;
          if (typeof value === 'number' && typeof max === 'number') {
            setCurrentStep(value);
            setTotalSteps(max);
            setCurrentImageProgress(Math.round((value / max) * 100));
          }
          return;
        }

        if (msg.type === 'executed') {
          const newImages = extractImages(d.output);
          if (newImages.length > 0) {
            setGeneratedImages((prev) => [...prev, ...newImages]);
          }
          return;
        }

        if (msg.type === 'execution_success') {
          ourIds.delete(d.prompt_id);
          completedCountRef.current += 1;
          setCompletedCount(completedCountRef.current);
          setCurrentImageProgress(0);
          setCurrentStep(0);
          if (ourIds.size === 0) {
            setGenerating(false);
            ws.close();
          }
          return;
        }

        if (msg.type === 'execution_error') {
          const errMsg = d.exception_message;
          setError(typeof errMsg === 'string' ? errMsg : '実行中にエラーが発生しました');
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

  const handleStop = async () => {
    try {
      await fetch(`${serverUrl}/api/interrupt`, { method: 'POST' });
    } catch {
      // ignore
    }
    wsRef.current?.close();
    setGenerating(false);
  };

  const handleDownload = async (image: DownloadableImage) => {
    try {
      await downloadImage(image);
    } catch {
      setError('画像のダウンロードに失敗しました');
    }
  };

  const currentImageIndex = completedCount + 1;
  const isDone = !generating && generatedImages.length > 0;

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack>
          <Select
            label='ワークフロー API JSON'
            placeholder='ワークフローを選択'
            data={workflows.map((w) => ({ value: w.id, label: w.name }))}
            value={selectedWorkflowId}
            onChange={(v) => updateForm({ selectedWorkflowId: v })}
          />
          <FileInput
            label='JSON をアップロード'
            placeholder='JSONファイルを選択...'
            accept='.json'
            leftSection={<IconUpload size={16} />}
            description='アップロードするとワークフロー一覧に追加されます'
            onChange={handleFileUpload}
          />
          <Textarea
            label='プロンプト'
            placeholder='生成したい画像の説明を入力...'
            rows={6}
            value={prompt}
            onChange={(e) => updateForm({ prompt: e.currentTarget.value })}
          />
          <Textarea
            label='ネガティブプロンプト'
            placeholder='除外したい要素を入力...'
            rows={3}
            value={negativePrompt}
            onChange={(e) => updateForm({ negativePrompt: e.currentTarget.value })}
          />

          <Accordion variant='separated' defaultValue='basic'>
            <Accordion.Item value='basic'>
              <Accordion.Control>基本設定</Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  <Select
                    label='生成枚数'
                    data={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 枚` }))}
                    value={String(imageCount)}
                    onChange={(v) => setImageCount(Number(v ?? '1'))}
                  />
                  <Box>
                    <Text size='sm' mb={4}>
                      ステップ数: {steps}
                    </Text>
                    <Slider
                      value={steps}
                      onChange={setSteps}
                      min={1}
                      max={150}
                      marks={[{ value: 20 }, { value: 50 }, { value: 100 }]}
                    />
                  </Box>
                  <Box>
                    <Text size='sm' mb={4}>
                      CFG スケール: {cfg}
                    </Text>
                    <Slider value={cfg} onChange={setCfg} min={1} max={30} step={0.5} />
                  </Box>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value='seed'>
              <Accordion.Control>シード</Accordion.Control>
              <Accordion.Panel>
                <NumberInput
                  label='シード'
                  value={seed}
                  onChange={(v) => setSeed(typeof v === 'number' ? v : -1)}
                  min={-1}
                  description='-1 でランダム（複数枚の場合は各枚ごとに異なるシード）'
                  rightSection={
                    <Tooltip label='ランダムシード'>
                      <Box
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={() => setSeed(-1)}
                      >
                        <IconRefresh size={16} />
                      </Box>
                    </Tooltip>
                  }
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          {error && (
            <Alert color='red' title='エラー'>
              {error}
            </Alert>
          )}

          <Button
            size='lg'
            leftSection={<IconWand size={18} />}
            onClick={handleGenerate}
            loading={generating}
            disabled={generating || !selectedWorkflowId}
            fullWidth
          >
            {generating
              ? `${imageCount}枚中 ${currentImageIndex}枚目 — ステップ ${currentStep}/${totalSteps}`
              : `生成（${imageCount}枚）`}
          </Button>
          {generating && (
            <Button
              variant='outline'
              color='red'
              leftSection={<IconPlayerStop size={16} />}
              size='sm'
              onClick={handleStop}
            >
              中断
            </Button>
          )}
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack>
          {generating && (
            <Card withBorder p='md'>
              <Stack gap='xs'>
                <Group justify='space-between'>
                  <Text size='xs' c='dimmed'>
                    全体: {imageCount}枚中 {currentImageIndex}枚目
                  </Text>
                  <Text size='xs' c='dimmed'>
                    {totalProgress}%
                  </Text>
                </Group>
                <Progress value={totalProgress} size='xs' color='gray' />
                <Group justify='space-between'>
                  <Text size='xs' c='dimmed'>
                    現在の画像: ステップ {currentStep}/{totalSteps}
                  </Text>
                  <Text size='xs' c='dimmed'>
                    {currentImageProgress}%
                  </Text>
                </Group>
                <Progress value={currentImageProgress} animated size='sm' />
              </Stack>
            </Card>
          )}

          <Card withBorder p={0} style={{ overflow: 'hidden' }}>
            {generatedImages.length > 0 ? (
              <Stack p='md'>
                {isDone && (
                  <Text size='sm' fw='bold'>
                    生成完了 — {generatedImages.length} 枚
                  </Text>
                )}
                <SimpleGrid cols={generatedImages.length === 1 ? 1 : 2}>
                  {generatedImages.map((img, i) => (
                    <Card key={i} withBorder p={0} style={{ overflow: 'hidden' }}>
                      <Image src={img.url} />
                      <Group p='xs' justify='space-between'>
                        <Text size='xs' c='dimmed' style={{ fontFamily: 'monospace' }}>
                          {img.filename}
                        </Text>
                        <Button variant='subtle' size='xs' p={4} onClick={() => void handleDownload(img)}>
                          <IconDownload size={14} />
                        </Button>
                      </Group>
                    </Card>
                  ))}
                  {generating && (
                    <Card withBorder p={0} style={{ overflow: 'hidden' }}>
                      <Box
                        h={160}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                      >
                        <IconBolt size={32} color='var(--mantine-color-blue-6)' />
                        <Text c='dimmed' size='xs'>
                          生成中...
                        </Text>
                      </Box>
                    </Card>
                  )}
                </SimpleGrid>
              </Stack>
            ) : generating ? (
              <Box
                h={400}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12
                }}
              >
                <IconBolt size={48} color='var(--mantine-color-blue-6)' />
                <Text c='dimmed' size='sm'>
                  生成中...
                </Text>
              </Box>
            ) : (
              <Box h={400} bg='gray.1' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Stack align='center'>
                  <IconPhoto size={48} color='var(--mantine-color-gray-4)' />
                  <Text c='dimmed' size='sm'>
                    生成された画像がここに表示されます
                  </Text>
                </Stack>
              </Box>
            )}
          </Card>
        </Stack>
      </Grid.Col>
    </Grid>
  );
};

// ---

type HistoryViewProps = {
  serverUrl: string;
};

type HistoryItem = {
  promptId: string;
  images: ResultItem[];
  status: string;
};

const HistoryView = ({ serverUrl }: HistoryViewProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${serverUrl}/api/history?max_items=50`);
      const data: Record<string, HistoryEntry> = await res.json();
      const items: HistoryItem[] = Object.entries(data).map(([promptId, entry]) => {
        const images: ResultItem[] = [];
        for (const nodeOutput of Object.values(entry.outputs)) {
          if (nodeOutput.images) images.push(...nodeOutput.images);
        }
        return { promptId, images, status: entry.status?.status_str ?? 'success' };
      });
      setHistory(items.reverse());
    } catch {
      setError('履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDownload = async (image: DownloadableImage) => {
    try {
      await downloadImage(image);
    } catch {
      setError('画像のダウンロードに失敗しました');
    }
  };

  if (loading) return <Text>読み込み中...</Text>;
  if (error)
    return (
      <Alert color='red' title='エラー'>
        {error}
      </Alert>
    );

  return (
    <Stack>
      <Group>
        <Title order={4}>履歴 / ギャラリー</Title>
        <Button variant='subtle' size='xs' onClick={loadHistory} leftSection={<IconRefresh size={14} />}>
          更新
        </Button>
      </Group>

      {history.length === 0 ? (
        <Text c='dimmed' size='sm'>
          履歴がありません
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing='sm'>
          {history.map((item) => (
            <Card key={item.promptId} withBorder p={0} style={{ overflow: 'hidden' }}>
              {item.images.length > 0 ? (
                <Image src={buildViewUrl(serverUrl, item.images[0])} h={160} fit='cover' />
              ) : (
                <Box
                  h={160}
                  bg={item.status === 'error' ? 'red.1' : 'gray.1'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text c={item.status === 'error' ? 'red.6' : 'dimmed'} size='sm'>
                    {item.status === 'error' ? 'エラー' : '画像なし'}
                  </Text>
                </Box>
              )}
              <Stack p='xs' gap={4}>
                <Group justify='space-between' align='flex-start' gap='xs'>
                  <Text size='xs' c='dimmed' style={{ fontFamily: 'monospace', flex: 1 }}>
                    {item.promptId.slice(0, 8)}...
                  </Text>
                  {item.images[0] && (
                    <Button
                      variant='subtle'
                      size='xs'
                      p={4}
                      onClick={() =>
                        void handleDownload({
                          url: buildViewUrl(serverUrl, item.images[0]),
                          filename: item.images[0].filename
                        })
                      }
                    >
                      <IconDownload size={14} />
                    </Button>
                  )}
                </Group>
                {item.status === 'error' && (
                  <Badge color='red' size='xs'>
                    エラー
                  </Badge>
                )}
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
};

// ---

type QueueViewProps = {
  serverUrl: string;
};

const QueueView = ({ serverUrl }: QueueViewProps) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${serverUrl}/api/queue`);
      const data: ApiQueueResponse = await res.json();

      const running: QueueItem[] = (data.queue_running ?? []).flatMap((item) => {
        if (typeof item[1] !== 'string') return [];
        return [{ promptId: item[1], status: 'running' as const }];
      });
      const pending: QueueItem[] = (data.queue_pending ?? []).flatMap((item) => {
        if (typeof item[1] !== 'string') return [];
        return [{ promptId: item[1], status: 'pending' as const }];
      });
      setQueue([...running, ...pending]);
    } catch {
      setError('キューの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleDelete = async (promptId: string) => {
    await fetch(`${serverUrl}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: [promptId] })
    });
    loadQueue();
  };

  const handleClearAll = async () => {
    await fetch(`${serverUrl}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true })
    });
    loadQueue();
  };

  if (loading) return <Text>読み込み中...</Text>;
  if (error)
    return (
      <Alert color='red' title='エラー'>
        {error}
      </Alert>
    );

  return (
    <Stack>
      <Group>
        <Title order={4}>キュー管理</Title>
        <Badge variant='light'>{queue.length} 件</Badge>
        <Button variant='subtle' size='xs' onClick={loadQueue} leftSection={<IconRefresh size={14} />}>
          更新
        </Button>
      </Group>

      {queue.length === 0 ? (
        <Text c='dimmed' size='sm'>
          キューは空です
        </Text>
      ) : (
        <Stack>
          {queue.map((item) => (
            <Card key={item.promptId} withBorder>
              <Group justify='space-between'>
                <Group gap='xs'>
                  <Badge color={item.status === 'running' ? 'blue' : 'gray'} variant='light'>
                    {item.status === 'running' ? '実行中' : '待機中'}
                  </Badge>
                  <Text size='xs' c='dimmed' style={{ fontFamily: 'monospace' }}>
                    {item.promptId.slice(0, 8)}...
                  </Text>
                </Group>
                <Button
                  variant='subtle'
                  color='red'
                  size='xs'
                  leftSection={<IconTrash size={14} />}
                  onClick={() => handleDelete(item.promptId)}
                  disabled={item.status === 'running'}
                >
                  削除
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Divider />
      <Button
        variant='light'
        color='red'
        size='sm'
        leftSection={<IconTrash size={14} />}
        onClick={handleClearAll}
        w='fit-content'
      >
        キューをすべてクリア
      </Button>
    </Stack>
  );
};

// ---

type SettingsViewProps = {
  settings: AppSettings;
  onSaveSettings: (s: AppSettings) => void;
  workflows: StoredWorkflow[];
  onDeleteWorkflow: (id: string) => void;
  onRenameWorkflow: (id: string, name: string) => void;
};

const SettingsView = ({
  settings,
  onSaveSettings,
  workflows,
  onDeleteWorkflow,
  onRenameWorkflow
}: SettingsViewProps) => {
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [defaultSteps, setDefaultSteps] = useState(settings.defaultSteps);
  const [defaultCfg, setDefaultCfg] = useState(settings.defaultCfg);
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = (wf: StoredWorkflow) => {
    setEditingId(wf.id);
    setEditingName(wf.name);
  };

  const commitEdit = () => {
    if (editingId && editingName.trim()) {
      onRenameWorkflow(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = () => {
    onSaveSettings({ serverUrl, defaultSteps, defaultCfg });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const confirmDeleteWorkflow = workflows.find((w) => w.id === confirmDeleteId);

  return (
    <>
      <Modal
        opened={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title='ワークフローの削除'
        size='sm'
      >
        <Stack>
          <Text size='sm'>「{confirmDeleteWorkflow?.name}」を削除しますか？この操作は元に戻せません。</Text>
          <Group justify='flex-end'>
            <Button variant='default' size='sm' onClick={() => setConfirmDeleteId(null)}>
              キャンセル
            </Button>
            <Button
              color='red'
              size='sm'
              leftSection={<IconTrash size={14} />}
              onClick={() => {
                if (confirmDeleteId) onDeleteWorkflow(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              削除
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Stack maw={480}>
        <Title order={4}>設定</Title>

        <TextInput
          label='ComfyUI サーバー URL'
          value={serverUrl}
          onChange={(e) => setServerUrl(e.currentTarget.value)}
          description='ComfyUI が起動しているホストとポートを指定'
        />
        <NumberInput
          label='デフォルトステップ数'
          value={defaultSteps}
          onChange={(v) => setDefaultSteps(typeof v === 'number' ? v : 20)}
          min={1}
          max={150}
        />
        <NumberInput
          label='デフォルト CFG スケール'
          value={defaultCfg}
          onChange={(v) => setDefaultCfg(typeof v === 'number' ? v : 7)}
          min={1}
          max={30}
          step={0.5}
        />

        <Button size='md' w='fit-content' onClick={handleSave} color={saved ? 'teal' : 'blue'}>
          {saved ? '保存しました' : '保存'}
        </Button>

        <Divider />

        <Title order={5}>ワークフロー API JSON 一覧</Title>
        {workflows.length === 0 ? (
          <Text size='sm' c='dimmed'>
            登録されているワークフローはありません
          </Text>
        ) : (
          <Stack gap='xs'>
            {workflows.map((wf) =>
              editingId === wf.id ? (
                <Group key={wf.id}>
                  <TextInput
                    value={editingName}
                    onChange={(e) => setEditingName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    size='xs'
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <Button variant='subtle' color='teal' size='xs' p={4} onClick={commitEdit}>
                    <IconCheck size={14} />
                  </Button>
                  <Button variant='subtle' color='gray' size='xs' p={4} onClick={cancelEdit}>
                    <IconX size={14} />
                  </Button>
                </Group>
              ) : (
                <Group key={wf.id} justify='space-between'>
                  <Text size='sm' style={{ flex: 1 }}>
                    {wf.name}
                  </Text>
                  <Group gap={4}>
                    <Button variant='subtle' color='gray' size='xs' p={4} onClick={() => startEdit(wf)}>
                      <IconPencil size={14} />
                    </Button>
                    <Button
                      variant='subtle'
                      color='red'
                      size='xs'
                      leftSection={<IconTrash size={14} />}
                      onClick={() => setConfirmDeleteId(wf.id)}
                    >
                      削除
                    </Button>
                  </Group>
                </Group>
              )
            )}
          </Stack>
        )}
      </Stack>
    </>
  );
};

// ---

export default function Home() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [activeSection, setActiveSection] = useState<NavSection>('generate');

  const [workflows, setWorkflows] = useLocalStorage<StoredWorkflow[]>({
    key: 'comfyui_workflows',
    defaultValue: []
  });

  const [settings, setSettings] = useLocalStorage<AppSettings>({
    key: 'comfyui_settings',
    defaultValue: DEFAULT_SETTINGS
  });

  const handleDeleteWorkflow = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  };

  const handleRenameWorkflow = (id: string, name: string) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
  };

  const handleAddWorkflow = (workflow: StoredWorkflow) => {
    setWorkflows((prev) => [...prev, workflow]);
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  const navItems: { section: NavSection; label: string; icon: ReactNode }[] = [
    { section: 'generate', label: '画像生成', icon: <IconWand size={18} /> },
    { section: 'history', label: '履歴 / ギャラリー', icon: <IconHistory size={18} /> },
    { section: 'queue', label: 'キュー管理', icon: <IconList size={18} /> },
    { section: 'settings', label: '設定', icon: <IconSettings size={18} /> }
  ];

  const handleNav = (section: NavSection) => {
    setActiveSection(section);
    close();
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding='md'
    >
      <AppShell.Header>
        <Group h='100%' px='md'>
          <Burger opened={opened} onClick={toggle} hiddenFrom='sm' size='sm' />
          <IconWand size={22} />
          <Title order={4} style={{ whiteSpace: 'nowrap' }}>
            ComfyUI WebUI
          </Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p='xs'>
        <ScrollArea>
          <Stack gap={4}>
            {navItems.map((item) => (
              <NavLink
                key={item.section}
                label={item.label}
                leftSection={item.icon}
                active={activeSection === item.section}
                onClick={() => handleNav(item.section)}
              />
            ))}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        {activeSection === 'generate' && (
          <GenerateView
            workflows={workflows}
            serverUrl={settings.serverUrl}
            defaultSteps={settings.defaultSteps}
            defaultCfg={settings.defaultCfg}
            onAddWorkflow={handleAddWorkflow}
          />
        )}
        {activeSection === 'history' && <HistoryView serverUrl={settings.serverUrl} />}
        {activeSection === 'queue' && <QueueView serverUrl={settings.serverUrl} />}
        {activeSection === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            workflows={workflows}
            onDeleteWorkflow={handleDeleteWorkflow}
            onRenameWorkflow={handleRenameWorkflow}
          />
        )}
      </AppShell.Main>
    </AppShell>
  );
}
