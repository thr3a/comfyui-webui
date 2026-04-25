# 1. 全体方針・コミュニケーション

- ユーザーは日本人です。コード内コメント・最終出力メッセージ・ユーザーへの質問は日本語でお願いします。
- 既存のコードコメントは、明示的な指示がない限り変更しない。
- `src/scripts` 以下の TypeScript コードを実行するときは `node --import tsx ./src/scripts/hello.ts`
- 指示されるまではAIのモデル名(gpt-4oなど)は勝手に変更しないこと
- https://deepwiki.com/mantinedev/mantine

ライブラリ概要

- 言語: TypeScript
- UI: React v19 / Mantine v9
- hook: Mantine の hook を使用
- Lint: biome v2
- ルーティング: react-router-dom（`BrowserRouter` + `Routes` + `Route`）を使用。ルート定義は `src/App.tsx`
- ビルドはvite v8

# 2. TypeScript / コーディングスタイル

- 型定義は `interface` ではなく 必ず `type` を使う。
- `any` 型は 絶対に使用しない。
- 型アサーション `as` は原則使用しない。やむを得ず `as` を使う場合は、なぜ必要かをコードコメントで説明すること。
- `class` 構文は 一切使用しない。
- 関数定義は すべてアロー関数 を使用する。
- 条件分岐は 早期リターンを用いてフラットに保つ。
- `try-catch` は乱用せず、必要最低限のみ使用する。

# 3. Mantine / スタイリング関連ルール

- 可能な限り、Mantine が提供する hook を優先的に利用する。
- `tsx` でスタイルを指定する際は、まず Mantine の Style props を使う。
  - Style props で表現できない場合のみ、`style` プロパティを使う。
- 例：

```tsx
// Style props を使う例
<Box mx="auto" maw={400} c="blue.6" bg="#fff">
</Box>

// Style props になく whiteSpace を指定したい場合は style を使う
<Text style={{ whiteSpace: 'nowrap' }}>
</Text>
```

- Radius、borderRadius などの丸みは、特別な指示がない限り設定しない。
- Mantine の Style props（`mb`, `py`, `fz` など）でサイズ指定をする場合は、可能な限り `xs`, `sm`, `md`, `lg`, `xl` のプリセットサイズを使う。例：`<Text size="sm">`
- 縦方向に要素が連続する場合、個々に `mb` を多用せず、基本的に `<Stack>` を使って縦間隔を調整する。
- 文字の太さ（`fw`）は `"bold"` のみ使用可能。数値（`400`, `700` など）は使用しない。

# 4. Mantine で使用可能な Style props 一覧

All Mantine components that have root element support the following style props:

| Prop    | CSS Property         | Theme key         |
| ------- | -------------------- | ----------------- |
| m       | margin               | theme.spacing     |
| mt      | marginTop            | theme.spacing     |
| mb      | marginBottom         | theme.spacing     |
| ml      | marginLeft           | theme.spacing     |
| mr      | marginRight          | theme.spacing     |
| ms      | marginInlineStart    | theme.spacing     |
| me      | marginInlineEnd      | theme.spacing     |
| mx      | marginInline         | theme.spacing     |
| my      | marginBlock          | theme.spacing     |
| p       | padding              | theme.spacing     |
| pt      | paddingTop           | theme.spacing     |
| pb      | paddingBottom        | theme.spacing     |
| pl      | paddingLeft          | theme.spacing     |
| pr      | paddingRight         | theme.spacing     |
| ps      | paddingInlineStart   | theme.spacing     |
| pe      | paddingInlineEnd     | theme.spacing     |
| px      | paddingInline        | theme.spacing     |
| py      | paddingBlock         | theme.spacing     |
| bd      | border               | –                 |
| bg      | background           | theme.colors      |
| c       | color                | –                 |
| opacity | opacity              | –                 |
| ff      | fontFamily           | –                 |
| fz      | fontSize             | theme.fontSizes   |
| fw      | fontWeight           | –                 |
| lts     | letterSpacing        | –                 |
| ta      | textAlign            | –                 |
| lh      | lineHeight           | theme.lineHeights |
| fs      | fontStyle            | –                 |
| tt      | textTransform        | –                 |
| td      | textDecoration       | –                 |
| w       | width                | theme.spacing     |
| miw     | minWidth             | theme.spacing     |
| maw     | maxWidth             | theme.spacing     |
| h       | height               | theme.spacing     |
| mih     | minHeight            | theme.spacing     |
| mah     | maxHeight            | theme.spacing     |
| bgsz    | backgroundSize       | –                 |
| bgp     | backgroundPosition   | –                 |
| bgr     | backgroundRepeat     | –                 |
| bga     | backgroundAttachment | –                 |
| pos     | position             | –                 |
| top     | top                  | –                 |
| left    | left                 | –                 |
| bottom  | bottom               | –                 |
| right   | right                | –                 |
| inset   | inset                | –                 |
| display | display              | –                 |
| flex    | flex                 | –                 |

# 5. Mantineの色一覧

dark.0: #C9C9C9
dark.1: #b8b8b8
dark.2: #828282
dark.3: #696969
dark.4: #424242
dark.5: #3b3b3b
dark.6: #2e2e2e
dark.7: #242424
dark.8: #1f1f1f
dark.9: #141414
gray.0: #f8f9fa
gray.1: #f1f3f5
gray.2: #e9ecef
gray.3: #dee2e6
gray.4: #ced4da
gray.5: #adb5bd
gray.6: #868e96
gray.7: #495057
gray.8: #343a40
gray.9: #212529
red.0: #fff5f5
red.1: #ffe3e3
red.2: #ffc9c9
red.3: #ffa8a8
red.4: #ff8787
red.5: #ff6b6b
red.6: #fa5252
red.7: #f03e3e
red.8: #e03131
red.9: #c92a2a
pink.0: #fff0f6
pink.1: #ffdeeb
pink.2: #fcc2d7
pink.3: #faa2c1
pink.4: #f783ac
pink.5: #f06595
pink.6: #e64980
pink.7: #d6336c
pink.8: #c2255c
pink.9: #a61e4d
grape.0: #f8f0fc
grape.1: #f3d9fa
grape.2: #eebefa
grape.3: #e599f7
grape.4: #da77f2
grape.5: #cc5de8
grape.6: #be4bdb
grape.7: #ae3ec9
grape.8: #9c36b5
grape.9: #862e9c
violet.0: #f3f0ff
violet.1: #e5dbff
violet.2: #d0bfff
violet.3: #b197fc
violet.4: #9775fa
violet.5: #845ef7
violet.6: #7950f2
violet.7: #7048e8
violet.8: #6741d9
violet.9: #5f3dc4
indigo.0: #edf2ff
indigo.1: #dbe4ff
indigo.2: #bac8ff
indigo.3: #91a7ff
indigo.4: #748ffc
indigo.5: #5c7cfa
indigo.6: #4c6ef5
indigo.7: #4263eb
indigo.8: #3b5bdb
indigo.9: #364fc7
blue.0: #e7f5ff
blue.1: #d0ebff
blue.2: #a5d8ff
blue.3: #74c0fc
blue.4: #4dabf7
blue.5: #339af0
blue.6: #228be6
blue.7: #1c7ed6
blue.8: #1971c2
blue.9: #1864ab
cyan.0: #e3fafc
cyan.1: #c5f6fa
cyan.2: #99e9f2
cyan.3: #66d9e8
cyan.4: #3bc9db
cyan.5: #22b8cf
cyan.6: #15aabf
cyan.7: #1098ad
cyan.8: #0c8599
cyan.9: #0b7285
teal.0: #e6fcf5
teal.1: #c3fae8
teal.2: #96f2d7
teal.3: #63e6be
teal.4: #38d9a9
teal.5: #20c997
teal.6: #12b886
teal.7: #0ca678
teal.8: #099268
teal.9: #087f5b
green.0: #ebfbee
green.1: #d3f9d8
green.2: #b2f2bb
green.3: #8ce99a
green.4: #69db7c
green.5: #51cf66
green.6: #40c057
green.7: #37b24d
green.8: #2f9e44
green.9: #2b8a3e
lime.0: #f4fce3
lime.1: #e9fac8
lime.2: #d8f5a2
lime.3: #c0eb75
lime.4: #a9e34b
lime.5: #94d82d
lime.6: #82c91e
lime.7: #74b816
lime.8: #66a80f
lime.9: #5c940d
yellow.0: #fff9db
yellow.1: #fff3bf
yellow.2: #ffec99
yellow.3: #ffe066
yellow.4: #ffd43b
yellow.5: #fcc419
yellow.6: #fab005
yellow.7: #f59f00
yellow.8: #f08c00
yellow.9: #e67700
orange.0: #fff4e6
orange.1: #ffe8cc
orange.2: #ffd8a8
orange.3: #ffc078
orange.4: #ffa94d
orange.5: #ff922b
orange.6: #fd7e14
orange.7: #f76707
orange.8: #e8590c
orange.9: #d9480f
