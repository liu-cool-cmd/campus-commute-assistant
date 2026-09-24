# 工作约定

对于任何修改，请遵循以下流程：

1. 先检查相关代码、配置和现有实现。
2. 向我提供简洁的实施方案，不要立即修改文件。
3. 在我明确回复“确认”、“Proceed”、“开始”或其他明确同意之前，不要执行会改变项目状态的操作。
4. 只有在我确认方案后，才开始实施。
5. 在方案阶段可以自由进行只读调查和诊断。

## 在我确认前禁止执行的操作

包括但不限于：

- 创建、修改或删除文件
- 使用 `prettier --write`
- 自动格式化并写回文件
- 安装、升级或删除依赖
- `git add`
- `git commit`
- `git stash`
- `git checkout`
- `git switch`
- `git merge`
- `git rebase`
- `git reset`
- `git clean`
- 任何其他会改变 Git 工作区、暂存区或仓库状态的操作

## 在方案阶段允许执行的操作

可以直接执行只读操作，例如：

- 搜索和读取文件
- `grep`
- `find`
- `cat`
- `ls`
- `git status`
- `git diff`
- `git log`
- `git show`
- `git grep`
- `git ls-files`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- 测试命令，只要测试本身不会修改项目文件
- 质量门中的构建命令（`npm run build`、`gradlew assembleDebug` 等），允许写入被 gitignore 覆盖的构建产物（`dist/`、`android/app/build/`），不改变 Git 工作区、暂存区或仓库状态

## 提交实施方案时

请保持简洁，只需要说明：

1. 当前问题或根因
2. 准备如何修改
3. 预计修改哪些文件
4. 有哪些重要风险、假设或需要我决定的地方

然后停止，等待我的确认。

不要在提交方案后自动继续实施。
