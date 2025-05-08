# Suno 音乐生成器 MCP 服务器

这是一个基于 Model Context Protocol (MCP) 的服务器，它允许您通过调用工具来使用 Suno API 生成音乐。

## ✨ 特性

*   通过 MCP 与 Suno API 交互。
*   支持自定义模式（提供歌词、风格、标题）和灵感模式（提供描述）。
*   支持继续生成已有的歌曲片段。
*   自动轮询任务状态并在完成后返回音频 URL。
*   可配置的 API Key 和模型版本。

## 🚀 开始使用

### 📋 先决条件

*   [Node.js](https://nodejs.org/) (建议使用 LTS 版本)
*   [npm](https://www.npmjs.com/) (通常随 Node.js 一起安装) 或 [yarn](https://yarnpkg.com/)

### ⚙️ 安装

1.  克隆此仓库 (如果您还没有的话)：
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  安装项目依赖：
    ```bash
    npm install
    # 或者使用 yarn
    # yarn install
    ```

### 🔑 配置

1.  在项目根目录下创建一个名为 `config.env` 的文件。
2.  在该文件中添加您的 Suno API Key：
    ```env
    SunoKey=sk_YOUR_SUNO_API_KEY_HERE
    ```
    将 `sk_YOUR_SUNO_API_KEY_HERE` 替换为您真实的 Suno API Key。

### ▶️ 运行 MCP 服务器

要启动 MCP 服务器，请在项目根目录下运行：

```bash
npm start
# 或者，如果您在 package.json 中定义了 "dev" 脚本并希望使用 ts-node-dev 进行热重载开发：
# npm run dev
# 或者直接运行编译后的 JavaScript 文件：
# node build/index.js
```

服务器启动后，它将通过标准输入/输出 (stdio) 与兼容的 MCP 客户端进行通信。

### 🔌 在 MCP 客户端中部署

要在您的 MCP 客户端（例如一个支持 MCP 的 AI 助手或开发工具）中使用此服务器，您通常需要在客户端的配置文件中添加一个服务器条目。以下是一个示例配置，请根据您的客户端具体要求进行调整：

```json
{
  "YOUR_UNIQUE_SERVER_ID": { // 替换为您客户端生成的唯一 ID
    "name": "Suno-MCP",     // 您为此服务器指定的名称
    "type": "stdio",        // 通信类型，对于此服务器是 "stdio"
    "description": "让AI唱歌", // 服务器的简短描述
    "isActive": true,       // 是否激活此服务器
    "command": "node",      // 用于启动服务器的命令
    "args": [
      "<path-to-your-project>/MCP-Suno/build/index.js" // 指向编译后的 index.js 文件的绝对或相对路径
    ],
    "env": {
      // 环境变量可以传递给服务器进程
      // 如果您在此处设置了 SunoKey，它可能会覆盖 config.env 中的值
      // "SunoKey": "sk_YOUR_SUNO_API_KEY_FROM_CLIENT_CONFIG"
    },
    "cwd": "<path-to-your-project>/MCP-Suno" // 可选：设置服务器的工作目录，通常是项目根目录
  }
}
```

**重要提示:**

*   **`YOUR_UNIQUE_SERVER_ID`**: 这通常由您的 MCP 客户端自动生成或要求您提供一个唯一的标识符。
*   **`command`**: 对于 Node.js 项目，通常是 `node`。
*   **`args`**: 数组中的第一个参数应该是到编译后的 `build/index.js` 文件的路径。请确保将 `<path-to-your-project>` 替换为您的实际项目路径。
*   **`env`**: 您可以在这里设置环境变量。服务器脚本 ([`index.ts`](index.ts:22)) 会尝试从项目根目录下的 `config.env` 文件加载 `SunoKey`。如果客户端配置中的 `env` 也设置了 `SunoKey`，其行为（是否覆盖）可能取决于 Node.js 处理环境变量的优先级和 `dotenv` 包的配置。为了确保 `SunoKey` 被正确加载，建议主要通过项目根目录下的 `config.env` 文件进行配置，如“[🔑 配置](#-配置)”部分所述。
*   **`cwd`**: 设置工作目录为项目根目录（包含 `build` 文件夹和 `config.env` 的目录）通常是个好主意，以确保相对路径（如 `../config.env` 相对于 `build/index.js`）能正确解析。

请查阅您的 MCP 客户端文档以获取有关如何添加和配置 MCP 服务器的详细说明。

## 🛠️ 工具说明

此 MCP 服务器提供以下工具：

### `generate_music_suno`

使用 Suno API 生成歌曲。

**描述：**
```
Generates a song using the Suno API. Provide lyrics, style, and title for custom mode, or a description for inspiration mode. Returns the audio URL upon completion. Polling for results may take a few minutes.

When returning an audio URL, please use the following HTML format for user convenience:
```html
<audio controls>
  <source src="YOUR_AUDIO_URL_HERE" type="audio/mpeg">
</audio>
<br>
<a href="YOUR_AUDIO_URL_HERE" download="SONG_TITLE.mp3">
  点击这里下载喵！
</a>
```
```

**输入参数 (`inputSchema`):**

*   `prompt` (string): 歌词内容。自定义模式下必需。示例: `'[Verse 1]\nUnder the starry sky...'`
*   `tags` (string): 音乐风格标签，逗号分隔。自定义模式下必需。示例: `'acoustic, folk, pop'`
*   `title` (string): 歌曲标题。自定义模式下必需。示例: `'Starry Night Serenade'`
*   `mv` (string, 可选): 模型版本。可选值: `"chirp-v3-0"`, `"chirp-v3-5"`, `"chirp-v4"`。默认为 `'chirp-v4'`。
*   `make_instrumental` (boolean, 可选): 是否生成纯音乐。默认为 `false`。
*   `gpt_description_prompt` (string, 可选): 灵感模式的描述。如果提供此参数，则 `prompt`, `tags`, 和 `title` 不是用户严格要求的。示例: `'A cheerful upbeat song about a sunny day.'`
*   `task_id` (string, 可选): 要继续的先前歌曲的任务 ID。如果提供，则 `continue_at` 和 `continue_clip_id` 也需要。
*   `continue_at` (number, 可选): 从歌曲的哪个时间点（秒）开始继续。需要 `task_id` 和 `continue_clip_id`。
*   `continue_clip_id` (string, 可选): 要继续的歌曲片段的剪辑 ID。需要 `task_id` 和 `continue_at`。

**验证逻辑:**
*   如果未提供 `gpt_description_prompt`，则 `prompt`, `tags`, 和 `title` 都是必需的。
*   如果提供了 `task_id`，则 `continue_at` 和 `continue_clip_id` 也必须提供。

**输出:**
成功时，返回一个包含音频 URL 的文本内容。如果发生错误，将返回错误信息。

## 💡 示例 MCP 请求

**生成自定义歌曲:**
```json
{
  "type": "call_tool",
  "params": {
    "name": "generate_music_suno",
    "arguments": {
      "prompt": "[Verse 1]\nIn the digital realm, where code streams flow,\nA kitty coder, with a vibrant glow.\n[Chorus]\nMeow, meow, MCP, oh so grand,\nGenerating tunes across the land!",
      "tags": "electronic, upbeat, synthwave",
      "title": "MCP Kitty's Anthem",
      "mv": "chirp-v4"
    }
  }
}
```

**使用灵感模式生成歌曲:**
```json
{
  "type": "call_tool",
  "params": {
    "name": "generate_music_suno",
    "arguments": {
      "gpt_description_prompt": "A lofi chill beat for late night coding sessions",
      "mv": "chirp-v3-5"
    }
  }
}
```

**继续生成歌曲:**
```json
{
  "type": "call_tool",
  "params": {
    "name": "generate_music_suno",
    "arguments": {
      "task_id": "your_previous_task_id_here",
      "continue_at": 60,
      "continue_clip_id": "your_previous_clip_id_here",
      "mv": "chirp-v4"
      // prompt, tags, title might be needed by Suno API for continuation,
      // or it might infer from the original task.
      // Check Suno API documentation for specifics on continuation.
    }
  }
}
```

## 🤝 贡献

欢迎提交 Pull Request 或 Issue 来改进此项目！

## 📄 许可证

(根据您的项目选择一个许可证，例如 MIT, Apache 2.0 等)
例如: This project is licensed under the MIT License.