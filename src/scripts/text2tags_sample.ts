export {};

type TagScore = {
  tag: string;
  score: number;
};

type Text2TagsRequest = {
  text: string;
  aspect_ratio?: 'tall' | 'wide' | 'square' | null;
  rating?: 'general' | 'sensitive' | 'nsfw' | 'explicit' | null;
  length?: 'very_short' | 'short' | 'medium' | 'long' | 'very_long';
  translate_mode?: 'exact' | 'loose';
};

type Text2TagsResponse = {
  tags: string[];
  tags_str: string;
  tag_scores: TagScore[];
};

const text2tags = async (req: Text2TagsRequest): Promise<Text2TagsResponse> => {
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

const result = await text2tags({
  text: '金髪で青い目のツインテールの少女が座ってこっちを見ている',
  rating: 'general',
  aspect_ratio: 'tall',
  length: 'very_short',
  translate_mode: 'exact'
});

console.log('tags_str:', result.tags_str);
console.log('\ntag_scores:');
for (const { tag, score } of result.tag_scores) {
  console.log(`  ${tag}: ${score.toFixed(3)}`);
}
