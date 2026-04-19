"use client"
import { useMemo, useState } from "react"
import { AlertTriangle, FileCode } from "lucide-react"

interface Props {
  codeFiles: Record<string, string>
  runId: string
  status: string
  /** The original prompt for this run — used to infer a scaffold preview when no real files exist. */
  prompt?: string | null
}

type ScaffoldFile = {
  name: string
  content: string
}

/**
 * Infer a small, prompt-aware scaffold so users see a realistic project tree
 * even on a failed run. This is intentionally tiny and language-aware, not a
 * full template.
 */
function inferScaffold(prompt: string | null | undefined): ScaffoldFile[] {
  const p = (prompt ?? "").toLowerCase()

  const has = (...needles: string[]) => needles.some((n) => p.includes(n))
  const isFastapi = has("fastapi", "flask") || (has("python") && has("api"))
  const isReactFrontend = has("react", "next.js", "nextjs", "frontend")
  const isNodeApi = has("node", "express") && !isFastapi

  // Default to a FastAPI skeleton (our demo prompts overwhelmingly target this).
  if (isFastapi || (!isReactFrontend && !isNodeApi)) {
    return [
      {
        name: "app.py",
        content:
          "# Placeholder scaffold — the Developer agent didn't complete.\n" +
          "# A successful run would fill this with the real FastAPI app.\n\n" +
          "from fastapi import FastAPI\n\n" +
          "app = FastAPI()\n\n" +
          "@app.get(\"/\")\n" +
          "def root():\n" +
          "    return {\"message\": \"hello world\"}\n",
      },
      {
        name: "test_app.py",
        content:
          "# Placeholder scaffold for pytest tests.\n" +
          "from fastapi.testclient import TestClient\n" +
          "from app import app\n\n" +
          "client = TestClient(app)\n\n" +
          "def test_root():\n" +
          "    r = client.get(\"/\")\n" +
          "    assert r.status_code == 200\n",
      },
      {
        name: "requirements.txt",
        content: "fastapi\nuvicorn\npytest\nhttpx\n",
      },
      {
        name: "README.md",
        content:
          "# Project (scaffold preview)\n\n" +
          "This is a placeholder tree shown because the run didn't finish. " +
          "Retry the run from the chat on the left to generate the real files.\n",
      },
    ]
  }

  if (isNodeApi) {
    return [
      {
        name: "index.js",
        content:
          "// Placeholder scaffold — the Developer agent didn't complete.\n" +
          "const express = require('express')\n" +
          "const app = express()\n" +
          "app.get('/', (_req, res) => res.json({ message: 'hello world' }))\n" +
          "app.listen(3000)\n",
      },
      {
        name: "package.json",
        content:
          "{\n" +
          '  "name": "orin-scaffold",\n' +
          '  "version": "0.0.1",\n' +
          '  "main": "index.js",\n' +
          '  "dependencies": { "express": "^4.19.0" }\n' +
          "}\n",
      },
      {
        name: "README.md",
        content:
          "# Project (scaffold preview)\n\nRun failed. Retry to generate the real files.\n",
      },
    ]
  }

  // React / generic frontend
  return [
    {
      name: "src/App.tsx",
      content:
        "// Placeholder scaffold — the Developer agent didn't complete.\n" +
        "export default function App() {\n" +
        "  return <h1>Hello from Orin scaffold</h1>\n" +
        "}\n",
    },
    {
      name: "src/main.tsx",
      content:
        "import React from 'react'\n" +
        "import ReactDOM from 'react-dom/client'\n" +
        "import App from './App'\n\n" +
        "ReactDOM.createRoot(document.getElementById('root')!).render(<App />)\n",
    },
    {
      name: "package.json",
      content:
        "{\n" +
        '  "name": "orin-scaffold",\n' +
        '  "version": "0.0.1",\n' +
        '  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" }\n' +
        "}\n",
    },
    {
      name: "README.md",
      content:
        "# Project (scaffold preview)\n\nRun failed. Retry to generate the real files.\n",
    },
  ]
}

export default function ArtifactPanel({ codeFiles, runId, status, prompt }: Props) {
  const realFileNames = Object.keys(codeFiles)
  const hasRealFiles = realFileNames.length > 0

  // Only show a scaffold once the run reached a terminal state with 0 files.
  const shouldShowScaffold =
    !hasRealFiles && (status === "FAILED" || status === "PANIC")

  const scaffold = useMemo(
    () => (shouldShowScaffold ? inferScaffold(prompt) : []),
    [shouldShowScaffold, prompt],
  )

  const scaffoldMap = useMemo(
    () => Object.fromEntries(scaffold.map((f) => [f.name, f.content])),
    [scaffold],
  )

  const displayMap: Record<string, string> = hasRealFiles ? codeFiles : scaffoldMap
  const fileNames = Object.keys(displayMap)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const displayFile = activeFile || fileNames[0] || null

  const downloadAll = () => {
    const blob = new Blob([JSON.stringify(codeFiles, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `orin-ai-${runId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getFileColor = (filename: string) => {
    if (filename.endsWith(".py")) return "text-[var(--terminal-blue)]"
    if (filename.endsWith(".txt")) return "text-[var(--terminal-yellow)]"
    if (filename.endsWith(".yml") || filename.endsWith(".yaml"))
      return "text-orange-400"
    if (filename.endsWith(".md")) return "text-purple-400"
    if (filename.endsWith(".ts") || filename.endsWith(".tsx"))
      return "text-sky-400"
    if (filename.endsWith(".js") || filename.endsWith(".json"))
      return "text-amber-400"
    return "text-[var(--terminal-text)]"
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase tracking-widest">
          {hasRealFiles
            ? `Artifacts (${fileNames.length})`
            : shouldShowScaffold
              ? "Scaffold Preview"
              : "Artifacts (0)"}
        </h2>
        {status === "FINALIZED" && hasRealFiles && (
          <button
            onClick={downloadAll}
            className="font-mono text-xs text-[var(--terminal-green)] hover:underline cursor-pointer"
          >
            ↓ download all
          </button>
        )}
      </div>

      {shouldShowScaffold && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90 font-mono shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Scaffold preview — this run didn&apos;t finish, so no real files were
            generated. The tree below is an inferred placeholder. Use the chat
            on the left and say &quot;do it again&quot; to retry.
          </span>
        </div>
      )}

      {fileNames.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-xs text-[var(--terminal-gray)] text-center">
            {status === "RUNNING"
              ? "Waiting for Developer agent..."
              : "No files generated"}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[180px_1fr] gap-3">
          {/* Left: file tree */}
          <aside className="overflow-y-auto border border-[var(--terminal-border)] rounded bg-[#0a0a0a]/60">
            <div className="px-2 py-1.5 border-b border-[var(--terminal-border)] text-[10px] font-mono uppercase tracking-widest text-[var(--terminal-gray)]">
              {hasRealFiles ? "Files" : "Placeholder tree"}
            </div>
            <ul className="py-1">
              {fileNames.map((name) => {
                const isActive = displayFile === name
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => setActiveFile(name)}
                      className={`w-full flex items-center gap-2 px-2 py-1 text-left font-mono text-xs transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-[var(--terminal-gray)] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <FileCode
                        className={`w-3 h-3 shrink-0 ${getFileColor(name)}`}
                      />
                      <span className="truncate">{name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {/* Right: file viewer */}
          {displayFile && (
            <div className="flex flex-col min-h-0 border border-[var(--terminal-border)] rounded overflow-hidden">
              <div className="px-3 py-1 border-b border-[var(--terminal-border)] bg-[#111] shrink-0 flex items-center gap-2">
                <span className={`font-mono text-xs ${getFileColor(displayFile)}`}>
                  {displayFile}
                </span>
                <span className="font-mono text-xs text-[var(--terminal-gray)]">
                  · {displayMap[displayFile]?.split("\n").length} lines
                </span>
                {!hasRealFiles && (
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-amber-300/80">
                    preview
                  </span>
                )}
              </div>
              <pre className="flex-1 overflow-auto p-3 font-mono text-xs text-[var(--terminal-text)] leading-relaxed whitespace-pre">
                {displayMap[displayFile]}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
