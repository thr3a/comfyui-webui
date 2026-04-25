import {
  Accordion,
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
import { useDisclosure } from '@mantine/hooks';
import {
  IconBolt,
  IconDownload,
  IconHistory,
  IconList,
  IconPhoto,
  IconPlayerStop,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconUpload,
  IconWand
} from '@tabler/icons-react';
import { useState } from 'react';

type NavSection = 'generate' | 'history' | 'queue' | 'settings';

type MockWorkflow = {
  id: string;
  name: string;
};

type MockHistoryItem = {
  id: string;
  prompt: string;
  model: string;
  steps: number;
  cfg: number;
  timestamp: string;
  status: 'success' | 'error';
  hue: number;
};

type MockQueueItem = {
  id: string;
  prompt: string;
  status: 'running' | 'pending';
  progress: number;
  step: number;
  totalSteps: number;
};

const INITIAL_MOCK_WORKFLOWS: MockWorkflow[] = [
  { id: 'w1', name: 'txt2img_basic.json' },
  { id: 'w2', name: 'txt2img_hires.json' },
  { id: 'w3', name: 'img2img_refiner.json' },
  { id: 'w4', name: 'sdxl_turbo.json' }
];

const MOCK_SAMPLERS = ['euler', 'euler_ancestral', 'dpm_2', 'dpm_2_ancestral', 'ddim', 'uni_pc'];
const MOCK_SCHEDULERS = ['normal', 'karras', 'exponential', 'simple'];

const MOCK_HISTORY: MockHistoryItem[] = [
  {
    id: 'h1',
    prompt: 'a beautiful landscape with mountains and lake at sunset, photorealistic',
    model: 'dreamshaper_8.safetensors',
    steps: 20,
    cfg: 7,
    timestamp: '2026-04-26 14:32',
    status: 'success',
    hue: 210
  },
  {
    id: 'h2',
    prompt: 'portrait of a young woman, anime style, detailed eyes, soft lighting',
    model: 'v1-5-pruned-emaonly.safetensors',
    steps: 28,
    cfg: 7.5,
    timestamp: '2026-04-26 13:15',
    status: 'success',
    hue: 30
  },
  {
    id: 'h3',
    prompt: 'cyberpunk city at night, neon lights, rain, cinematic',
    model: 'realisticVisionV60B1.safetensors',
    steps: 30,
    cfg: 8,
    timestamp: '2026-04-26 12:01',
    status: 'success',
    hue: 280
  },
  {
    id: 'h4',
    prompt: 'cute cat sitting on a wooden floor, warm sunlight',
    model: 'dreamshaper_8.safetensors',
    steps: 20,
    cfg: 6,
    timestamp: '2026-04-26 11:44',
    status: 'success',
    hue: 50
  },
  {
    id: 'h5',
    prompt: 'fantasy castle on a floating island, clouds, dramatic sky',
    model: 'sd_xl_base_1.0.safetensors',
    steps: 25,
    cfg: 7,
    timestamp: '2026-04-26 10:20',
    status: 'success',
    hue: 160
  },
  {
    id: 'h6',
    prompt: 'abstract art, colorful geometric shapes, minimalist',
    model: 'v1-5-pruned-emaonly.safetensors',
    steps: 15,
    cfg: 5,
    timestamp: '2026-04-26 09:55',
    status: 'error',
    hue: 0
  },
  {
    id: 'h7',
    prompt: 'old town street in Paris, watercolor painting style',
    model: 'dreamshaper_8.safetensors',
    steps: 22,
    cfg: 7,
    timestamp: '2026-04-25 23:10',
    status: 'success',
    hue: 340
  },
  {
    id: 'h8',
    prompt: 'robot in a flower field, studio ghibli style, vibrant colors',
    model: 'dreamshaper_8.safetensors',
    steps: 20,
    cfg: 7,
    timestamp: '2026-04-25 22:30',
    status: 'success',
    hue: 120
  }
];

const MOCK_QUEUE: MockQueueItem[] = [
  {
    id: 'q1',
    prompt: 'dragon flying over ocean waves, epic fantasy art',
    status: 'running',
    progress: 65,
    step: 13,
    totalSteps: 20
  },
  {
    id: 'q2',
    prompt: 'cozy coffee shop interior, warm lighting, bokeh',
    status: 'pending',
    progress: 0,
    step: 0,
    totalSteps: 25
  },
  {
    id: 'q3',
    prompt: 'space station orbiting earth, realistic, 8k',
    status: 'pending',
    progress: 0,
    step: 0,
    totalSteps: 30
  }
];

const ImagePlaceholder = ({ hue, h = 200 }: { hue: number; h?: number }) => (
  <Box
    h={h}
    style={{
      background: `hsl(${hue}, 35%, 45%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <IconPhoto size={40} color='rgba(255,255,255,0.4)' />
  </Box>
);

type GenerateViewProps = {
  workflows: MockWorkflow[];
  onAddWorkflow: (workflow: MockWorkflow) => void;
};

const MOCK_IMAGE_HUES = [210, 30, 280, 50, 160, 340, 120, 60, 200, 90];

const GenerateView = ({ workflows, onAddWorkflow }: GenerateViewProps) => {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(1);
  const [imageCount, setImageCount] = useState<string>('1');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(workflows[0]?.id ?? null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<number[]>([]);

  const handleFileUpload = (file: File | null) => {
    if (!file) return;
    const newWorkflow: MockWorkflow = {
      id: `w-${Date.now()}`,
      name: file.name
    };
    onAddWorkflow(newWorkflow);
    setSelectedWorkflowId(newWorkflow.id);
    setUploadedFileName(file.name);
  };

  const handleGenerate = () => {
    const count = Number(imageCount);
    setGenerating(true);
    setGenerated(false);
    setGeneratedImages([]);
    setCurrentProgress(0);
    setTotalProgress(0);
    setCurrentStep(0);
    setCurrentImageIndex(1);

    let step = 0;
    let imgIdx = 1;
    const total = 20;
    const timer = setInterval(() => {
      step += 1;
      setCurrentStep(step);
      setCurrentProgress(Math.round(step / total * 100));
      setTotalProgress(Math.round(((imgIdx - 1) * total + step) / (count * total) * 100));
      if (step >= total) {
        const hue = MOCK_IMAGE_HUES[(imgIdx - 1) % MOCK_IMAGE_HUES.length];
        setGeneratedImages((prev) => [...prev, hue]);
        if (imgIdx >= count) {
          clearInterval(timer);
          setGenerating(false);
          setGenerated(true);
        } else {
          imgIdx += 1;
          step = 0;
          setCurrentImageIndex(imgIdx);
          setCurrentStep(0);
          setCurrentProgress(0);
        }
      }
    }, 150);
  };

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack>
          <Select
            label='ワークフロー API JSON'
            placeholder='ワークフローを選択'
            data={workflows.map((w) => ({ value: w.id, label: w.name }))}
            value={selectedWorkflowId}
            onChange={setSelectedWorkflowId}
          />
          <FileInput
            label='JSON をアップロード'
            placeholder='JSONファイルを選択...'
            accept='.json'
            leftSection={<IconUpload size={16} />}
            description='アップロードするとワークフロー一覧に追加されます'
            onChange={handleFileUpload}
          />
          {uploadedFileName && (
            <Text size='xs' c='teal'>
              {uploadedFileName} を追加しました
            </Text>
          )}
          <Textarea
            label='プロンプト'
            placeholder='生成したい画像の説明を入力...'
            rows={6}
            defaultValue='a beautiful landscape with mountains and lake at sunset, photorealistic, high detail, 8k'
          />
          <Textarea
            label='ネガティブプロンプト'
            placeholder='除外したい要素を入力...'
            rows={3}
            defaultValue='blurry, low quality, watermark, text, ugly, deformed'
          />

          <Accordion variant='separated'>
            <Accordion.Item value='basic'>
              <Accordion.Control>基本設定</Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  <Select
                    label='生成枚数'
                    data={Array.from({ length: 10 }, (_, i) => String(i + 1))}
                    value={imageCount}
                    onChange={(v) => setImageCount(v ?? '1')}
                  />
                  <Grid>
                    <Grid.Col span={6}>
                      <NumberInput label='幅' defaultValue={512} step={64} min={64} max={2048} />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <NumberInput label='高さ' defaultValue={512} step={64} min={64} max={2048} />
                    </Grid.Col>
                  </Grid>
                  <Box>
                    <Text size='sm' mb={4}>
                      ステップ数: 20
                    </Text>
                    <Slider
                      defaultValue={20}
                      min={1}
                      max={150}
                      marks={[{ value: 20 }, { value: 50 }, { value: 100 }]}
                    />
                  </Box>
                  <Box>
                    <Text size='sm' mb={4}>
                      CFG スケール: 7.0
                    </Text>
                    <Slider defaultValue={7} min={1} max={30} step={0.5} />
                  </Box>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value='sampler'>
              <Accordion.Control>サンプラー設定</Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  <Select label='サンプラー' data={MOCK_SAMPLERS} defaultValue='euler_ancestral' />
                  <Select label='スケジューラー' data={MOCK_SCHEDULERS} defaultValue='karras' />
                  <NumberInput
                    label='シード'
                    defaultValue={-1}
                    min={-1}
                    description='-1 でランダム'
                    rightSection={
                      <Tooltip label='ランダムシード'>
                        <Box style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <IconRefresh size={16} />
                        </Box>
                      </Tooltip>
                    }
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <Button
            size='lg'
            leftSection={<IconWand size={18} />}
            onClick={handleGenerate}
            loading={generating}
            disabled={generating}
            fullWidth
          >
            {generating ? `生成中... (画像 ${currentImageIndex}/${imageCount}, ステップ ${currentStep}/20)` : `生成（${imageCount}枚）`}
          </Button>
          {generating && (
            <Button variant='outline' color='red' leftSection={<IconPlayerStop size={16} />} size='sm'>
              中断
            </Button>
          )}
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack>
          <Card withBorder p={0} style={{ overflow: 'hidden' }}>
            {generatedImages.length > 0 || generating ? (
              <Stack p='md'>
                {generated && (
                  <Group justify='space-between'>
                    <Text size='sm' fw='bold'>
                      生成完了 — {imageCount}枚
                    </Text>
                    <Button variant='light' size='xs' leftSection={<IconDownload size={14} />}>
                      すべて保存
                    </Button>
                  </Group>
                )}
                {generating && (
                  <Box>
                    <Group justify='space-between' mb={4}>
                      <Text size='xs' c='dimmed'>
                        全体: {imageCount}枚中 {generatedImages.length + 1}枚目
                      </Text>
                      <Text size='xs' c='dimmed'>{totalProgress}%</Text>
                    </Group>
                    <Progress value={totalProgress} size='xs' color='gray' mb='xs' />
                  </Box>
                )}
                <SimpleGrid cols={Number(imageCount) === 1 ? 1 : 2}>
                  {generatedImages.map((hue, i) => (
                    <Card key={i} withBorder p={0} style={{ overflow: 'hidden' }}>
                      <ImagePlaceholder hue={hue} h={Number(imageCount) === 1 ? 360 : 160} />
                      <Group p='xs' justify='space-between'>
                        <Text size='xs' c='dimmed' style={{ fontFamily: 'monospace' }}>
                          output_{String(42 + i).padStart(5, '0')}.png
                        </Text>
                        <Group gap={4}>
                          <Button variant='subtle' size='xs' p={4}>
                            <IconDownload size={14} />
                          </Button>
                          <Button variant='subtle' color='red' size='xs' p={4}>
                            <IconTrash size={14} />
                          </Button>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                  {generating && (
                    <Card withBorder p={0} style={{ overflow: 'hidden' }}>
                      <Box
                        h={Number(imageCount) === 1 ? 360 : 160}
                        bg='gray.1'
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 12
                        }}
                      >
                        <IconBolt size={36} color='var(--mantine-color-blue-6)' />
                        <Text c='dimmed' size='sm'>生成中...</Text>
                      </Box>
                      <Box p='xs'>
                        <Group justify='space-between' mb={4}>
                          <Text size='xs' c='dimmed'>
                            ステップ {currentStep}/20
                          </Text>
                          <Text size='xs' c='dimmed'>{currentProgress}%</Text>
                        </Group>
                        <Progress value={currentProgress} animated size='sm' />
                      </Box>
                    </Card>
                  )}
                </SimpleGrid>
              </Stack>
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

const HistoryView = () => {
  const [filter, _setFilter] = useState<string | null>(null);

  const filtered = filter ? MOCK_HISTORY.filter((h) => h.status === filter) : MOCK_HISTORY;

  return (
    <Stack>
      <Group>
        <Title order={4}>履歴 / ギャラリー</Title>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing='sm'>
        {filtered.map((item) => (
          <Card key={item.id} withBorder p={0} style={{ overflow: 'hidden', cursor: 'pointer' }}>
            <Box style={{ position: 'relative' }}>
              {item.status === 'error' ? (
                <Box h={160} bg='red.1' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text c='red.6' size='sm'>
                    エラー
                  </Text>
                </Box>
              ) : (
                <ImagePlaceholder hue={item.hue} h={160} />
              )}
              {item.status === 'error' && (
                <Badge color='red' style={{ position: 'absolute', top: 6, right: 6 }} size='xs'>
                  エラー
                </Badge>
              )}
            </Box>
            <Stack p='xs' gap={4}>
              <Text size='xs' lineClamp={2} c='dark.0'>
                {item.prompt}
              </Text>
              <Text size='xs' c='dimmed'>
                {item.timestamp}
              </Text>
              <Text size='xs' c='dimmed'>
                {item.steps}ステップ / CFG {item.cfg}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
};

const QueueView = () => (
  <Stack>
    <Group>
      <Title order={4}>キュー管理</Title>
      <Badge variant='light'>{MOCK_QUEUE.length} 件</Badge>
    </Group>

    <Stack>
      {MOCK_QUEUE.map((item) => (
        <Card key={item.id} withBorder>
          <Group justify='space-between' mb='xs'>
            <Group gap='xs'>
              <Badge color={item.status === 'running' ? 'blue' : 'gray'} variant='light'>
                {item.status === 'running' ? '実行中' : '待機中'}
              </Badge>
              <Text size='xs' c='dimmed' style={{ fontFamily: 'monospace' }}>
                {item.id}
              </Text>
            </Group>
            <Button variant='subtle' color='red' size='xs' leftSection={<IconTrash size={14} />}>
              削除
            </Button>
          </Group>

          <Text size='sm' mb='xs' lineClamp={2}>
            {item.prompt}
          </Text>

          {item.status === 'running' && (
            <Box>
              <Group justify='space-between' mb={4}>
                <Text size='xs' c='dimmed'>
                  ステップ {item.step} / {item.totalSteps}
                </Text>
                <Text size='xs' c='dimmed'>
                  {item.progress}%
                </Text>
              </Group>
              <Progress value={item.progress} animated color='blue' size='sm' />
            </Box>
          )}
        </Card>
      ))}
    </Stack>

    <Divider />
    <Group>
      {/* <Button variant='light' color='red' size='sm' leftSection={<IconTrash size={14} />}>
        キューをすべてクリア
      </Button> */}
    </Group>
  </Stack>
);

type SettingsViewProps = {
  workflows: MockWorkflow[];
  onDeleteWorkflow: (id: string) => void;
};

const SettingsView = ({ workflows, onDeleteWorkflow }: SettingsViewProps) => (
  <Stack maw={480}>
    <Title order={4}>設定</Title>

    <TextInput
      label='ComfyUI サーバー URL'
      defaultValue='http://127.0.0.1:8188'
      description='ComfyUI が起動しているホストとポートを指定'
    />

    <NumberInput label='デフォルトステップ数' defaultValue={20} min={1} max={150} />

    <NumberInput label='デフォルト CFG スケール' defaultValue={7} min={1} max={30} step={0.5} />

    <Button size='md' w='fit-content'>
      保存
    </Button>

    <Divider />

    <Title order={5}>ワークフロー API JSON 一覧</Title>
    {workflows.length === 0 ? (
      <Text size='sm' c='dimmed'>
        登録されているワークフローはありません
      </Text>
    ) : (
      <Stack gap='xs'>
        {workflows.map((wf) => (
          <Group key={wf.id} justify='space-between'>
            <Text size='sm'>{wf.name}</Text>
            <Button
              variant='subtle'
              color='red'
              size='xs'
              leftSection={<IconTrash size={14} />}
              onClick={() => onDeleteWorkflow(wf.id)}
            >
              削除
            </Button>
          </Group>
        ))}
      </Stack>
    )}
  </Stack>
);

export default function MockPage() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [activeSection, setActiveSection] = useState<NavSection>('generate');
  const [workflows, setWorkflows] = useState<MockWorkflow[]>(INITIAL_MOCK_WORKFLOWS);

  const handleDeleteWorkflow = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  };

  const handleAddWorkflow = (workflow: MockWorkflow) => {
    setWorkflows((prev) => [...prev, workflow]);
  };

  const navItems: { section: NavSection; label: string; icon: React.ReactNode }[] = [
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
        <Group h='100%' px='md' justify='space-between'>
          <Group gap='sm'>
            <Burger opened={opened} onClick={toggle} hiddenFrom='sm' size='sm' />
            <IconWand size={22} />
            <Title order={4} style={{ whiteSpace: 'nowrap' }}>
              ComfyUI WebUI
            </Title>
          </Group>
          <Group gap='xs'>
            <Badge variant='light' color='blue' leftSection={<IconList size={12} />}>
              キュー: {MOCK_QUEUE.length}件
            </Badge>
          </Group>
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
        {activeSection === 'generate' && <GenerateView workflows={workflows} onAddWorkflow={handleAddWorkflow} />}
        {activeSection === 'history' && <HistoryView />}
        {activeSection === 'queue' && <QueueView />}
        {activeSection === 'settings' && <SettingsView workflows={workflows} onDeleteWorkflow={handleDeleteWorkflow} />}
      </AppShell.Main>
    </AppShell>
  );
}
