/**
 * Curated small prompts that fit within Groq free-tier token budgets
 * (≈100k tokens/day per key on llama-3.3-70b). These prompts are intentionally
 * tiny so the Developer agent returns in 1–2 iterations and all tests pass.
 */

export interface DemoPrompt {
  id: string
  title: string
  subtitle: string
  prompt: string
  estTokens: number
  estSeconds: number
  tag: "API" | "DATA" | "UTIL"
}

export const DEMO_PROMPTS: DemoPrompt[] = [
  {
    id: "hello_api",
    title: "Hello API",
    subtitle: "Tiny FastAPI with one /hello endpoint",
    prompt:
      "Build a minimal FastAPI app with a single GET /hello endpoint that returns {\"message\": \"hello world\"}. Include pytest tests that verify the status code is 200 and the JSON body is exactly {\"message\": \"hello world\"}.",
    estTokens: 8000,
    estSeconds: 45,
    tag: "API",
  },
  {
    id: "todo_static",
    title: "Static Todo List",
    subtitle: "FastAPI GET /todos returning 3 hard-coded todos",
    prompt:
      "Build a minimal FastAPI app with a GET /todos endpoint that returns a hard-coded JSON list of exactly three todo objects, each with id (int), title (str), and done (bool). Include pytest tests that verify the endpoint returns 200 and exactly 3 todos with the correct keys.",
    estTokens: 10000,
    estSeconds: 55,
    tag: "API",
  },
  {
    id: "counter",
    title: "Visitor Counter",
    subtitle: "In-memory counter with GET and POST /count",
    prompt:
      "Build a minimal FastAPI app with an in-memory integer counter. Expose GET /count that returns {\"count\": N} and POST /count that increments the counter and returns the new value. Include pytest tests that verify the counter starts at 0, increments by 1 on POST, and is readable via GET.",
    estTokens: 12000,
    estSeconds: 60,
    tag: "API",
  },
  {
    id: "quote",
    title: "Random Quote",
    subtitle: "FastAPI GET /quote from a fixed list",
    prompt:
      "Build a minimal FastAPI app with a GET /quote endpoint that returns a random quote from a hard-coded list of five quotes. The response should be {\"quote\": \"...\", \"author\": \"...\"}. Include pytest tests that verify the endpoint returns 200 and the response shape has both keys with non-empty string values.",
    estTokens: 11000,
    estSeconds: 55,
    tag: "DATA",
  },
  {
    id: "echo",
    title: "Echo Service",
    subtitle: "POST /echo returns whatever body it receives",
    prompt:
      "Build a minimal FastAPI app with a POST /echo endpoint that accepts any JSON body and returns the exact same body back under the key 'echo'. Include pytest tests that POST a sample object and verify the response contains it under 'echo'.",
    estTokens: 9000,
    estSeconds: 50,
    tag: "UTIL",
  },
  {
    id: "calculator",
    title: "Calculator",
    subtitle: "FastAPI with /add, /subtract, /multiply, /divide",
    prompt:
      "Build a minimal FastAPI app with four endpoints: POST /add, POST /subtract, POST /multiply, POST /divide. Each accepts {\"a\": number, \"b\": number} and returns {\"result\": number}. Division by zero must return HTTP 400. Include pytest tests for each operation and for the divide-by-zero case.",
    estTokens: 14000,
    estSeconds: 75,
    tag: "UTIL",
  },
]
