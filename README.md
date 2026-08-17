# dsh-shortcuts — 输入框快捷短语插件

<img width="1926" height="278" alt="image" src="https://github.com/user-attachments/assets/8928d0c2-356c-41b7-a61c-c9663a153d41" />



为 DeepSeek Harness（dsh）Web 界面的输入框提供「快捷短语 / 快捷标签」功能：在输入卡片工具行的左侧显示一排彩虹色键盘键帽样式的短语标签。

## 功能

- **一键填充**：点击标签 → 输入框草稿被替换为该短语，焦点回到输入框、光标落在末尾（不自动发送）
- **悬停删除**：鼠标悬停标签时，右上角出现小 `×`，点击删除该短语
- **快速新增**：行尾 `+` → 行内小输入框；`Enter` 提交、`Esc` 取消、失焦时有内容则提交、失焦为空则取消
- **数量与长度限制**：最多 **8** 个短语、每个最多 **7** 个字符
- **彩虹键帽配色**：红橙黄绿青蓝紫粉 8 色循环，带荧光与按下动效，深浅主题均可用
- **持久化**：短语保存在浏览器 `localStorage`（键 `dsh:quick-phrases`），跨会话、跨标签页共享
- **默认短语**：首次使用按界面语言给出「继续 / 你还在吗」（英文 `Continue / Still there?`）；一旦你增删过短语，以保存的列表为准（删空也保持为空）
- **中英文界面**：提示文案随 dsh 语言设置（`quickPhrases` 词表命名空间）

## 安装到 web profile

```bash
# 1a. 直接从 GitHub 安装（dsh plugin 直接转发给 profile 目录下的 pnpm，支持任意 pnpm 依赖规格）
dsh plugin --profile web add github:laoshi1991/dsh-shortcuts

# 1b. 或克隆后本地安装（在本插件源码目录执行）
# git clone https://github.com/laoshi1991/dsh-shortcuts && cd dsh-shortcuts
# dsh plugin --profile web add "file:$(pwd)"

# 2. 在 ~/.dsh/profiles/web/cordis.patch.yml 追加启用项：
#    - insert:
#        - id: dsh-shortcuts
#          name: 'dsh-shortcuts'

# 3. 重启 dsh web 生效
```

修改 `client.js` 后重新安装一次即可（`file:` 依赖是拷贝安装，不会自动跟随源码）：

```bash
dsh plugin --profile web update dsh-shortcuts   # 或重新 add，然后重启 dsh web
```

卸载：删除 `cordis.patch.yml` 中的 insert 项（可选：`dsh plugin --profile web remove dsh-shortcuts`），重启即可恢复原状。

## 兼容性

- 在 `@deepseek-ai/dsh` **0.1.0-rc.6** 上开发并验证。依赖 web 外壳的 client 插件加载机制与 `conversation.input.left` 插槽；rc 系列版本间接口可能变动，跨版本使用请以实际验证为准。
- 无运行时依赖、无需构建：`client.js` 即浏览器侧产物，安装后即可用。

## 开发

```bash
node test/smoke.mjs   # 冒烟测试：自动从全局 dsh 安装解析 react；也可设 DSH_ROOT 指向 @deepseek-ai/dsh 包目录
```

- `scripts/restart-web.sh`：等待旧 `dsh web` 退出后原位重启的开发脚本，可用 `DSH_BIN` / `DSH_WEB_CWD` / `DSH_WEB_PORT` 环境变量覆盖（默认：PATH 上的 `dsh`、`$HOME`、3080）。

## 实现说明

- 浏览器侧（`client.js`，即构建产物本身，无需构建）向外壳模块加载器注册一个模块：
  - 通过 `ctx.locale.register("quickPhrases", …)` 注册词表；
  - 通过 `ctx.slots.inject("conversation.input.left", …)` 在 ui-conversation 声明的输入工具行插槽上注册列表条目（`id: quick-phrases`，`order: 100`）；
  - 组件经框架标准工具包拿到 `inputActions.setDraft()`（输入状态机唯一公开草稿写入路径）与 `t` 词表座位，不触碰任何私有接口；
  - 样式以带 `data-plugin-css` 的 `<style>` 标签注入，色彩用固定 rgba、背景/边框用 `--dsw-*` 设计令牌，适配深浅主题。
- 宿主侧（`lib/index.js`）为无操作插件，仅满足加载器每个条目一个入口的约定。
- `package.json` 的 `dsh.client` 声明（`platform: web`、`immediately: true`）让宿主在启动图中发现并在启动时拉取浏览器半包。

## 已知边界

- 短语点击是「替换整段草稿」，不会追加到已有内容后面。
- 标签仅在已有会话的输入卡片中显示（空工作区 hero 状态无草稿，不显示）。
- 会话运行中标签仍可点击：填入的短语像手打内容一样进入排队 / steering 流程。
- 多个浏览器窗口同时编辑短语时，后写者覆盖（无跨窗口同步，与 localStorage 语义一致）。
