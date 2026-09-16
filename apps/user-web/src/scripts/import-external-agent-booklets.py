#!/usr/bin/env python3
"""
一次性导入外部 Agent 小册到 content-local/（个人学习归档）。

- 菜鸟教程 AI Agent：抓取索引页顺序 + 各页正文转 Markdown
- AgentGuide：从 GitHub raw 拉取 docs/**/*.md

用法（仓库根）：
  python3 apps/react-web/src/scripts/import-external-agent-booklets.py

注意：仅供个人离线阅读归档，各小册 meta.json 注明来源与链接。
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

try:
    import html2text
except ImportError:
    print("请先安装: pip3 install html2text", file=sys.stderr)
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]  # scripts -> src -> react-web -> apps -> 仓库根
CONTENT_LOCAL = REPO_ROOT / "content-local"
AGENT_LAB_SRC = REPO_ROOT.parent / "personal-agent-lab" / "study" / "booklets" / "ai-agent-engineering"

RUNOOB_INDEX = "https://www.runoob.com/ai-agent/"
RUNOOB_BASE = "https://www.runoob.com"
AGENTGUIDE_API = "https://api.github.com/repos/adongwanai/AgentGuide/git/trees/main?recursive=1"
AGENTGUIDE_RAW = "https://raw.githubusercontent.com/adongwanai/AgentGuide/main"

SKIP_MD_NAMES = {"README.md"}


def fetch(url: str, retries: int = 3) -> str:
    """优先 curl（规避部分环境 SSL 问题），失败再 urllib。"""
    last_err: Exception | None = None
    for i in range(retries):
        try:
            proc = subprocess.run(
                ["curl", "-sL", "--max-time", "90", url],
                capture_output=True,
                text=True,
                check=True,
            )
            return proc.stdout
        except Exception as e:
            last_err = e
            time.sleep(1 + i)
    # fallback
    req = urllib.request.Request(url, headers={"User-Agent": "personal-hub-booklet-import/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


class RunoobSidebarParser:
    """保留占位，侧栏解析已改用正则。"""
    pass


def extract_runoob_article(html: str) -> tuple[str, str]:
    """返回 (title, markdown_body)。"""
    title_m = re.search(r"<title>([^<|]+)", html)
    title = title_m.group(1).strip() if title_m else "未命名"

    # 主内容区：article-body
    body_m = re.search(
        r'<div[^>]*class="article-body[^"]*"[^>]*>(.*)</div>\s*<!--\s*article-body',
        html,
        re.DOTALL | re.IGNORECASE,
    )
    if not body_m:
        body_m = re.search(
            r'<div[^>]*class="article-body[^"]*"[^>]*>(.*?)<div[^>]*class="previous-next',
            html,
            re.DOTALL | re.IGNORECASE,
        )
    if not body_m:
        body_m = re.search(
            r'<div[^>]*id="content"[^>]*>(.*?)<div[^>]*class="pre-next-page',
            html,
            re.DOTALL | re.IGNORECASE,
        )
    fragment = body_m.group(1) if body_m else html

    converter = html2text.HTML2Text()
    converter.body_width = 0
    converter.ignore_links = False
    converter.ignore_images = False
    md = converter.handle(fragment).strip()

    # 清理站点导航残留
    md = re.sub(r"\n{3,}", "\n\n", md)
    footer = (
        f"\n\n---\n\n"
        f"> 本章整理自 [菜鸟教程 AI Agent]({RUNOOB_BASE}/ai-agent/)，仅供个人学习归档。\n"
    )
    return title, md + footer


def get_runoob_chapters() -> list[tuple[str, str, str]]:
    index_html = fetch(RUNOOB_INDEX)
    # 侧栏链接：article-sidebar 内 a 标签
    links: list[tuple[str, str]] = []
    sidebar_m = re.search(r'class="article-sidebar"(.*?)class="article-body', index_html, re.DOTALL)
    block = sidebar_m.group(1) if sidebar_m else index_html
    for href, text in re.findall(
        r'href="(/ai-agent/[^"]+\.html)"[^>]*>([^<]+)<', block
    ):
        text = re.sub(r"\s+", " ", text).strip()
        if text and href not in [x[0] for x in links]:
            links.append((href, text))

    if not links:
        # fallback: 全页 unique links
        for href in re.findall(r'href="(/ai-agent/[^"]+\.html)"', index_html):
            if href not in [x[0] for x in links] and href != "/ai-agent/ai-agent-tutorial.html":
                slug = href.rsplit("/", 1)[-1].replace(".html", "")
                links.append((href, slug))

    chapters: list[tuple[str, str, str]] = []
    for href, nav_title in links:
        url = RUNOOB_BASE + href
        print(f"[runoob] {nav_title} <- {url}")
        page_html = fetch(url)
        title, md = extract_runoob_article(page_html)
        chapters.append((href, nav_title or title, md))
        time.sleep(0.4)
    return chapters


def write_runoob_booklet() -> None:
    out_dir = CONTENT_LOCAL / "菜鸟教程 AI Agent 教程"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    meta = {
        "title": "菜鸟教程 AI Agent 教程",
        "author": "菜鸟教程（整理归档）",
        "summary": "整理自 runoob.com/ai-agent 全站教程（概念、工具、Python 实战、框架入门等），供 Personal Hub 离线阅读。",
        "categorySlug": "ai",
        "tags": ["agent", "runoob", "reference", "python"],
        "sourceUrl": "https://www.runoob.com/ai-agent/ai-agent-tutorial.html",
    }
    (out_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    intro = """# 如何使用本归档小册

本册 **非原创**，内容由脚本从 [菜鸟教程 AI Agent 专题](https://www.runoob.com/ai-agent/) 抓取并转为 Markdown，仅供 **个人学习** 在 Personal Hub 中阅读。

- 版权与内容归属菜鸟教程 / runoob.com
- 若需分享或商用，请访问原站并遵守其条款
- 与《AI Agent 工程实战》小册分工：本册偏概念与工具广度；工程实战偏 TypeScript 动手与生产闭环

## 章节顺序

按原站侧栏顺序排列，共若干章（以 sync:booklets 同步结果为准）。
"""
    (out_dir / "00-如何使用本归档小册.md").write_text(intro, encoding="utf-8")

    chapters = get_runoob_chapters()
    for idx, (href, nav_title, md) in enumerate(chapters, start=1):
        slug = href.rsplit("/", 1)[-1].replace(".html", "")
        filename = f"{idx:02d}-{slug}.md"
        heading = nav_title or slug
        content = f"# {heading}\n\n{md.lstrip('#').strip() if md.startswith('#') else md}\n"
        (out_dir / filename).write_text(content, encoding="utf-8")

    print(f"[runoob] 写入 {len(chapters)} 章 -> {out_dir}")


def get_agentguide_paths() -> list[str]:
    data = json.loads(fetch(AGENTGUIDE_API))
    paths = sorted(
        t["path"]
        for t in data.get("tree", [])
        if t["path"].startswith("docs/") and t["path"].endswith(".md")
    )
    # 跳过各目录 README，保留正文
    return [p for p in paths if not p.endswith("/README.md")]


def write_agentguide_booklet() -> None:
    out_dir = CONTENT_LOCAL / "AgentGuide AI Agent 开发指南"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    meta = {
        "title": "AgentGuide AI Agent 开发指南",
        "author": "adongwanai / AgentGuide（整理归档）",
        "summary": "整理自 GitHub adongwanai/AgentGuide 仓库 docs/ 全量 Markdown（理论、技术栈、实战、面试、路线），供离线阅读。",
        "categorySlug": "ai",
        "tags": ["agent", "AgentGuide", "reference", "interview", "rag"],
        "sourceUrl": "https://github.com/adongwanai/AgentGuide",
    }
    (out_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    intro = """# 如何使用本归档小册

本册内容来自开源项目 [AgentGuide](https://github.com/adongwanai/AgentGuide)（`docs/` 目录），由导入脚本复制为 Markdown 章节，仅供 **个人学习**。

- 原项目协议与版权声明以 GitHub 仓库为准
- 章节文件名保留原仓库相对路径信息，便于回原仓库对照更新
- 与《AI Agent 工程实战》互补：本册覆盖理论/面试/路线更广；工程实战小册偏 TypeScript 实现与验收
"""
    (out_dir / "00-如何使用本归档小册.md").write_text(intro, encoding="utf-8")

    paths = get_agentguide_paths()
    for idx, path in enumerate(paths, start=1):
        raw_url = f"{AGENTGUIDE_RAW}/{path}"
        print(f"[agentguide] {path}")
        body = fetch(raw_url)
        rel = path.replace("docs/", "").replace("/", "__")
        if rel.endswith(".md"):
            rel = rel[:-3]
        filename = f"{idx:02d}-{rel}.md"
        header = (
            f"> 原文：[AgentGuide/{path}]({AGENTGUIDE_RAW}/{path})\n\n"
        )
        (out_dir / filename).write_text(header + body.strip() + "\n", encoding="utf-8")
        time.sleep(0.15)

    print(f"[agentguide] 写入 {len(paths)} 章 -> {out_dir}")


def migrate_agent_lab_booklet() -> None:
    dst = CONTENT_LOCAL / "AI Agent 工程实战"
    wrong = CONTENT_LOCAL / "AI Agent 入门与实践指南"
    if wrong.exists():
        shutil.rmtree(wrong)
        print(f"[agent-lab] 已删除误建小册: {wrong.name}")

    if not AGENT_LAB_SRC.is_dir():
        raise SystemExit(f"未找到源小册: {AGENT_LAB_SRC}")

    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(AGENT_LAB_SRC, dst)

    # 章节评分总表 → 00C 前缀保证排序
    score_table = dst / "章节评分总表.md"
    if score_table.exists():
        score_table.rename(dst / "00C-章节评分总表.md")

    meta_path = dst / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    meta["author"] = "Personal Hub（源自 personal-agent-lab）"
    meta["summary"] = (
        meta.get("summary", "")
        + " 实验代码见同级 personal-agent-lab 仓库；阅读与动手的分工见各章说明。"
    )
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    notice = dst / "00-如何使用本小册.md"
    if notice.exists():
        extra = (
            "\n\n---\n\n"
            "## Personal Hub 阅读说明\n\n"
            "- 本册由 `personal-agent-lab/study/booklets/ai-agent-engineering` 迁入\n"
            "- 章末 `pnpm --filter @personal-agent-lab/...` 实验需在 **personal-agent-lab** 仓库执行\n"
            "- 概念广度可参考同目录《菜鸟教程 AI Agent 教程》《AgentGuide AI Agent 开发指南》\n"
        )
        notice.write_text(notice.read_text(encoding="utf-8") + extra, encoding="utf-8")

    print(f"[agent-lab] 已迁移 -> {dst}")


def main() -> None:
    CONTENT_LOCAL.mkdir(parents=True, exist_ok=True)
    # agent-lab 已迁移则跳过（支持断点续跑）
    dst = CONTENT_LOCAL / "AI Agent 工程实战"
    if not dst.is_dir():
        migrate_agent_lab_booklet()
    else:
        print(f"[agent-lab] 已存在，跳过: {dst.name}")
    write_runoob_booklet()
    write_agentguide_booklet()
    print("\n完成。请运行: pnpm sync:booklets")


if __name__ == "__main__":
    main()
