# Yemaolv星际先锋 - 部署指南

这是一个基于 React + Vite + Tailwind CSS 开发的太空战机游戏。你可以轻松地将其部署到 GitHub 并同步到 Vercel。

## 🚀 部署到 Vercel 的步骤

### 1. 上传代码到 GitHub
1. 在 GitHub 上创建一个新的仓库。
2. 在本地项目中初始化 git（如果你还没有做的话）：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
3. 将本地代码推送到 GitHub：
   ```bash
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git branch -M main
   git push -u origin main
   ```

### 2. 在 Vercel 中导入项目
1. 登录 [Vercel](https://vercel.com/)。
2. 点击 **"Add New"** -> **"Project"**。
3. 导入你刚刚创建的 GitHub 仓库。
4. 在 **"Environment Variables"** (环境变量) 部分，添加以下变量：
   - `GEMINI_API_KEY`: 你的 Google Gemini API 密钥（虽然目前游戏逻辑主要在本地，但保留此项以备未来扩展）。
5. 点击 **"Deploy"**。

## 🛠 本地开发

1. 安装依赖：
   ```bash
   npm install
   ```
2. 启动开发服务器：
   ```bash
   npm run dev
   ```
3. 构建生产版本：
   ```bash
   npm run build
   ```

## 🖼 替换游戏素材 (本地开发)

你可以通过在本地替换图片来个性化你的游戏：

1. 在项目根目录创建 `public/assets/` 文件夹。
2. 将你的图片放入该文件夹，并命名为：
   - `player.png`: 玩家战机
   - `enemy_basic.png`: 基础敌机
   - `enemy_fast.png`: 快速敌机
   - `enemy_heavy.png`: 重型敌机
3. 重新启动开发服务器，游戏将自动加载这些图片。如果图片缺失，系统会自动回退到默认的几何图形。

## 🎮 游戏特性
- **多种敌机**：基础型、快速型、重型。
- **道具系统**：三向子弹 (T) 与 能量护盾 (S)。
- **关卡升级**：难度随关卡提升。
- **成就系统**：5 种独特成就。
- **全平台支持**：支持鼠标、键盘和移动端触摸控制。
