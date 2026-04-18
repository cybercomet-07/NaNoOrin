"use client"
import { useState } from "react"

interface Props {
  codeFiles: Record<string, string>
  runId: string
  status: string
}

export default function ArtifactPanel({ codeFiles, runId, status }: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const fileNames = Object.keys(codeFiles)
  const displayFile = activeFile || fileNames[0] || null

  const downloadAll = () => {
    // Create a JSON blob of all files for download
    const blob = new Blob([JSON.stringify(codeFiles, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `orin-ai-${runId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getFileColor = (filename: string) => {
    if (filename.endsWith(".py"))    return "text-[var(--terminal-blue)]"
    if (filename.endsWith(".txt"))   return "text-[var(--terminal-yellow)]"
    if (filename.endsWith(".yml") || filename.endsWith(".yaml")) return "text-orange-400"
    if (filename.endsWith(".md"))    return "text-purple-400"
    return "text-[var(--terminal-text)]"
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase tracking-widest">
          Artifacts ({fileNames.length})
        </h2>
        {status === "FINALIZED" && fileNames.length > 0 && (
          <button
            onClick={downloadAll}
            className="font-mono text-xs text-[var(--terminal-green)] 
                       hover:underline cursor-pointer"
          >
            ↓ download all
          </button>
        )}
      </div>

      {fileNames.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-xs text-[var(--terminal-gray)] text-center">
            {status === "RUNNING" ? "Waiting for Developer agent..." : "No files generated"}
          </p>
        </div>
      ) : (
        <>
          {/* File tabs */}
          <div className="flex flex-wrap gap-1 mb-2 shrink-0">
            {fileNames.map(name => (
              <button
                key={name}
                onClick={() => setActiveFile(name)}
                className={`font-mono text-xs px-2 py-1 rounded border transition-colors
                  ${(displayFile === name)
                    ? "border-[var(--terminal-green)] text-[var(--terminal-green)] bg-green-500/5"
                    : "border-[var(--terminal-border)] text-[var(--terminal-gray)] hover:border-[var(--terminal-gray)]"
                  } ${getFileColor(name)}`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* File content */}
          {displayFile && (
            <div className="flex-1 overflow-hidden flex flex-col 
                            border border-[var(--terminal-border)] rounded">
              <div className="px-3 py-1 border-b border-[var(--terminal-border)] 
                              bg-[#111] shrink-0">
                <span className={`font-mono text-xs ${getFileColor(displayFile)}`}>
                  {displayFile}
                </span>
                <span className="font-mono text-xs text-[var(--terminal-gray)] ml-2">
                  {codeFiles[displayFile]?.split("\n").length} lines
                </span>
              </div>
              <pre className="flex-1 overflow-auto p-3 font-mono text-xs 
                              text-[var(--terminal-text)] leading-relaxed whitespace-pre">
                {codeFiles[displayFile]}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}
