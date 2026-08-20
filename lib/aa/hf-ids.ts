/**
 * Curated Artificial Analysis slug → Hugging Face repo.
 * Highest-priority source for Hub details. Heuristics and Hub search
 * in `hf-resolve.ts` cover models that are not listed here.
 */
export interface HfMapping {
  hfId: string
  officialUrl?: string
  /** Ollama library tag, when a first-party or well-known mapping exists. */
  ollama?: string
}

function aliases(mapping: HfMapping, slugs: string[]): [string, HfMapping][] {
  return slugs.map((slug) => [slug, mapping])
}

const HF_ID_ENTRIES: [string, HfMapping][] = [
  // Llama
  ...aliases(
    { hfId: "meta-llama/Llama-4-Scout-17B-16E-Instruct", officialUrl: "https://www.llama.com", ollama: "llama4" },
    ["llama-4-scout", "llama-4-scout-instruct", "llama-4-scout-17b-16e-instruct"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-4-Maverick-17B-128E-Instruct", officialUrl: "https://www.llama.com", ollama: "llama4" },
    ["llama-4-maverick", "llama-4-maverick-instruct", "llama-4-maverick-17b-128e-instruct"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-3.3-70B-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3.3" },
    ["llama-3-3-instruct-70b", "llama-3-3-70b-instruct", "llama-3.3-instruct-70b", "llama-3.3-70b-instruct"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-3.1-405B-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3.1" },
    ["llama-3-1-instruct-405b", "llama-3-1-405b-instruct", "llama-3.1-instruct-405b"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-3.1-70B-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3.1" },
    ["llama-3-1-instruct-70b", "llama-3-1-70b-instruct", "llama-3.1-instruct-70b"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-3.1-8B-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3.1" },
    ["llama-3-1-instruct-8b", "llama-3-1-8b-instruct", "llama-3.1-instruct-8b"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-3.2-90B-Vision-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3.2-vision" },
    ["llama-3-2-90b-vision-instruct", "llama-3.2-90b-vision-instruct"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-3.2-11B-Vision-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3.2-vision" },
    ["llama-3-2-11b-vision-instruct", "llama-3.2-11b-vision-instruct"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-3.2-3B-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3.2" },
    ["llama-3-2-instruct-3b", "llama-3-2-3b-instruct", "llama-3.2-3b-instruct"],
  ),
  ...aliases(
    { hfId: "meta-llama/Llama-3.2-1B-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3.2" },
    ["llama-3-2-instruct-1b", "llama-3-2-1b-instruct", "llama-3.2-1b-instruct"],
  ),
  ...aliases(
    { hfId: "meta-llama/Meta-Llama-3-70B-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3" },
    ["llama-3-instruct-70b", "llama-3-70b-instruct", "llama-3-70b", "meta-llama-3-70b-instruct"],
  ),
  ...aliases(
    { hfId: "meta-llama/Meta-Llama-3-8B-Instruct", officialUrl: "https://www.llama.com", ollama: "llama3" },
    ["llama-3-instruct-8b", "llama-3-8b-instruct", "llama-3-8b", "meta-llama-3-8b-instruct"],
  ),

  // Qwen
  ...aliases(
    { hfId: "Qwen/Qwen3.8-2.4T-A95B", officialUrl: "https://qwenlm.github.io" },
    ["qwen3-8-2-4t-a95b", "qwen3.8-2.4t-a95b", "qwen3-8-2-4t-a95b-instruct", "qwen38-2-4t-a95b"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3.8-27B", officialUrl: "https://qwenlm.github.io" },
    ["qwen3-8-27b", "qwen3.8-27b", "qwen38-27b"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3.6-35B-A3B", officialUrl: "https://qwenlm.github.io" },
    ["qwen3-6-35b-a3b", "qwen3.6-35b-a3b", "qwen36-35b-a3b"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3.6-27B", officialUrl: "https://qwenlm.github.io" },
    ["qwen3-6-27b", "qwen3.6-27b", "qwen36-27b"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3.5-9B", officialUrl: "https://qwenlm.github.io" },
    ["qwen3-5-9b", "qwen3.5-9b", "qwen35-9b"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3-235B-A22B", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" },
    ["qwen3-235b-a22b", "qwen3-235b-a22b-instruct", "qwen3-235b"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3-235B-A22B-Thinking-2507", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" },
    ["qwen3-235b-a22b-thinking", "qwen3-235b-a22b-thinking-2507", "qwen3-235b-a22b-reasoning"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3-30B-A3B", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" },
    ["qwen3-30b-a3b", "qwen3-30b-a3b-instruct"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3-30B-A3B-Thinking-2507", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" },
    ["qwen3-30b-a3b-thinking", "qwen3-30b-a3b-thinking-2507", "qwen3-30b-a3b-reasoning"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3-235B-A22B-Instruct-2507", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" },
    ["qwen3-235b-a22b-instruct-2507", "qwen3-235b-a22b-2507"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3-Next-80B-A3B-Instruct", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" },
    ["qwen3-next-80b-a3b", "qwen3-next-80b-a3b-instruct"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3-Coder-480B-A35B-Instruct", officialUrl: "https://qwenlm.github.io" },
    ["qwen3-coder-480b-a35b", "qwen3-coder-480b-a35b-instruct", "qwen3-coder-480b"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen3-Coder-Next", officialUrl: "https://qwenlm.github.io" },
    ["qwen3-coder-next"],
  ),
  ...aliases({ hfId: "Qwen/Qwen3-32B", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" }, ["qwen3-32b"]),
  ...aliases({ hfId: "Qwen/Qwen3-14B", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" }, ["qwen3-14b"]),
  ...aliases({ hfId: "Qwen/Qwen3-8B", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" }, ["qwen3-8b"]),
  ...aliases({ hfId: "Qwen/Qwen3-4B", officialUrl: "https://qwenlm.github.io", ollama: "qwen3" }, ["qwen3-4b"]),
  ...aliases(
    { hfId: "Qwen/Qwen2.5-72B-Instruct", officialUrl: "https://qwenlm.github.io", ollama: "qwen2.5" },
    ["qwen2-5-72b-instruct", "qwen2.5-72b-instruct", "qwen2-5-instruct-72b"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen2.5-32B-Instruct", officialUrl: "https://qwenlm.github.io", ollama: "qwen2.5" },
    ["qwen2-5-32b-instruct", "qwen2.5-32b-instruct"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen2.5-14B-Instruct", officialUrl: "https://qwenlm.github.io", ollama: "qwen2.5" },
    ["qwen2-5-14b-instruct", "qwen2.5-14b-instruct"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen2.5-7B-Instruct", officialUrl: "https://qwenlm.github.io", ollama: "qwen2.5" },
    ["qwen2-5-7b-instruct", "qwen2.5-7b-instruct"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen2.5-Coder-32B-Instruct", officialUrl: "https://qwenlm.github.io", ollama: "qwen2.5-coder" },
    ["qwen2-5-coder-32b-instruct", "qwen2.5-coder-32b-instruct"],
  ),
  ...aliases({ hfId: "Qwen/QwQ-32B", officialUrl: "https://qwenlm.github.io", ollama: "qwq" }, ["qwq-32b"]),
  ...aliases(
    { hfId: "Qwen/Qwen2.5-Coder-7B-Instruct", officialUrl: "https://qwenlm.github.io", ollama: "qwen2.5-coder" },
    ["qwen2-5-coder-7b-instruct", "qwen2.5-coder-7b-instruct"],
  ),
  ...aliases(
    { hfId: "Qwen/Qwen2.5-3B-Instruct", officialUrl: "https://qwenlm.github.io", ollama: "qwen2.5" },
    ["qwen2-5-3b-instruct", "qwen2.5-3b-instruct"],
  ),

  // DeepSeek
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-V4-Pro-0813", officialUrl: "https://www.deepseek.com" },
    ["deepseek-v4-pro-0813", "deepseek-v4-pro-0813-reasoning", "deepseek-v4-pro-0813-reasoning-max-effort"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-V4-Pro", officialUrl: "https://www.deepseek.com" },
    ["deepseek-v4-pro", "deepseek-v4-pro-reasoning", "deepseek-v4-pro-reasoning-max-effort"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-V4-Flash-0731", officialUrl: "https://www.deepseek.com" },
    ["deepseek-v4-flash-0731", "deepseek-v4-flash-0731-reasoning"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-V4-Flash", officialUrl: "https://www.deepseek.com" },
    ["deepseek-v4-flash", "deepseek-v4-flash-reasoning"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-V3.2", officialUrl: "https://www.deepseek.com" },
    ["deepseek-v3-2", "deepseek-v3.2", "deepseek-v3-2-reasoning"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-V3.1", officialUrl: "https://www.deepseek.com" },
    ["deepseek-v3-1", "deepseek-v3.1", "deepseek-v3-1-reasoning"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-V3-0324", officialUrl: "https://www.deepseek.com" },
    ["deepseek-v3-0324", "deepseek-v3-0324-reasoning"],
  ),
  ...aliases({ hfId: "deepseek-ai/DeepSeek-V3", officialUrl: "https://www.deepseek.com" }, ["deepseek-v3"]),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-R1-0528", officialUrl: "https://www.deepseek.com", ollama: "deepseek-r1" },
    ["deepseek-r1-0528"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-R1", officialUrl: "https://www.deepseek.com", ollama: "deepseek-r1" },
    ["deepseek-r1"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", officialUrl: "https://www.deepseek.com", ollama: "deepseek-r1" },
    ["deepseek-r1-distill-qwen-32b", "deepseek-r1-distill-qwen-32b-reasoning"],
  ),
  ...aliases(
    { hfId: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B", officialUrl: "https://www.deepseek.com", ollama: "deepseek-r1" },
    ["deepseek-r1-distill-llama-70b"],
  ),

  // Mistral
  ...aliases(
    { hfId: "mistralai/Mistral-Large-3-675B-Instruct-2512", officialUrl: "https://mistral.ai", ollama: "mistral-large" },
    ["mistral-large-3", "mistral-large-3-675b-instruct-2512"],
  ),
  ...aliases(
    { hfId: "mistralai/Mistral-Large-Instruct-2411", officialUrl: "https://mistral.ai", ollama: "mistral-large" },
    ["mistral-large-2", "mistral-large-instruct-2411", "mistral-large-2411"],
  ),
  ...aliases(
    { hfId: "mistralai/Mistral-Small-3.2-24B-Instruct-2506", officialUrl: "https://mistral.ai", ollama: "mistral-small" },
    ["mistral-small-3-2", "mistral-small-3.2", "mistral-small-3-2-24b-instruct-2506"],
  ),
  ...aliases(
    { hfId: "mistralai/Mistral-Small-3.1-24B-Instruct-2503", officialUrl: "https://mistral.ai", ollama: "mistral-small" },
    ["mistral-small-3-1", "mistral-small-3.1", "mistral-small-3-1-24b-instruct-2503"],
  ),
  ...aliases(
    { hfId: "mistralai/Mistral-Small-24B-Instruct-2501", officialUrl: "https://mistral.ai", ollama: "mistral-small" },
    ["mistral-small-3", "mistral-small-2501", "mistral-small-24b-instruct-2501"],
  ),
  ...aliases(
    { hfId: "mistralai/Mixtral-8x22B-Instruct-v0.1", officialUrl: "https://mistral.ai", ollama: "mixtral" },
    ["mixtral-8x22b-instruct", "mixtral-8x22b"],
  ),
  ...aliases(
    { hfId: "mistralai/Mixtral-8x7B-Instruct-v0.1", officialUrl: "https://mistral.ai", ollama: "mixtral" },
    ["mixtral-8x7b-instruct", "mixtral-8x7b"],
  ),
  ...aliases(
    { hfId: "mistralai/Devstral-Small-2507", officialUrl: "https://mistral.ai" },
    ["devstral-small-2507", "devstral-small"],
  ),
  ...aliases({ hfId: "mistralai/Devstral-2", officialUrl: "https://mistral.ai" }, ["devstral-2"]),
  ...aliases(
    { hfId: "mistralai/Mistral-Nemo-Instruct-2407", officialUrl: "https://mistral.ai", ollama: "mistral-nemo" },
    ["mistral-nemo", "mistral-nemo-instruct", "mistral-nemo-instruct-2407"],
  ),
  ...aliases(
    { hfId: "mistralai/Mistral-7B-Instruct-v0.3", officialUrl: "https://mistral.ai", ollama: "mistral" },
    ["mistral-7b-instruct", "mistral-7b-instruct-v0-3", "mistral-7b"],
  ),
  ...aliases(
    { hfId: "mistralai/Codestral-22B-v0.1", officialUrl: "https://mistral.ai", ollama: "codestral" },
    ["codestral", "codestral-22b", "codestral-22b-v0-1"],
  ),
  ...aliases(
    { hfId: "mistralai/Magistral-Small-2506", officialUrl: "https://mistral.ai", ollama: "magistral" },
    ["magistral-small", "magistral-small-2506", "magistral"],
  ),
  ...aliases(
    { hfId: "mistralai/Ministral-8B-Instruct-2410", officialUrl: "https://mistral.ai", ollama: "ministral" },
    ["ministral-8b", "ministral-8b-instruct", "ministral-8b-instruct-2410"],
  ),

  // Gemma
  ...aliases(
    { hfId: "google/gemma-4-31B-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma4" },
    ["gemma-4-31b", "gemma-4-31b-it", "gemma-4-31b-instruct"],
  ),
  ...aliases(
    { hfId: "google/gemma-4-26B-A4B-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma4" },
    ["gemma-4-26b-a4b", "gemma-4-26b-a4b-it", "gemma-4-26b-a4b-instruct", "gemma-4-26b-a4b-reasoning"],
  ),
  ...aliases(
    { hfId: "google/gemma-3-27b-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma3" },
    ["gemma-3-27b", "gemma-3-27b-it", "gemma-3-27b-instruct"],
  ),
  ...aliases(
    { hfId: "google/gemma-3-12b-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma3" },
    ["gemma-3-12b", "gemma-3-12b-it", "gemma-3-12b-instruct"],
  ),
  ...aliases(
    { hfId: "google/gemma-3-4b-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma3" },
    ["gemma-3-4b", "gemma-3-4b-it", "gemma-3-4b-instruct"],
  ),
  ...aliases(
    { hfId: "google/gemma-3-1b-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma3" },
    ["gemma-3-1b", "gemma-3-1b-it", "gemma-3-1b-instruct"],
  ),
  ...aliases(
    { hfId: "google/gemma-3n-E4B-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma3n" },
    ["gemma-3n-e4b-instruct", "gemma-3n-e4b", "gemma-3n-e4b-it"],
  ),
  ...aliases(
    { hfId: "google/gemma-2-27b-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma2" },
    ["gemma-2-27b", "gemma-2-27b-it", "gemma-2-27b-instruct"],
  ),
  ...aliases(
    { hfId: "google/gemma-2-9b-it", officialUrl: "https://ai.google.dev/gemma", ollama: "gemma2" },
    ["gemma-2-9b", "gemma-2-9b-it", "gemma-2-9b-instruct"],
  ),

  // Phi
  ...aliases(
    { hfId: "microsoft/phi-4", officialUrl: "https://azure.microsoft.com/en-us/products/phi", ollama: "phi4" },
    ["phi-4"],
  ),
  ...aliases(
    { hfId: "microsoft/Phi-4-reasoning", officialUrl: "https://azure.microsoft.com/en-us/products/phi", ollama: "phi4" },
    ["phi-4-reasoning"],
  ),
  ...aliases(
    {
      hfId: "microsoft/Phi-4-mini-instruct",
      officialUrl: "https://azure.microsoft.com/en-us/products/phi",
      ollama: "phi4-mini",
    },
    ["phi-4-mini", "phi-4-mini-instruct"],
  ),
  ...aliases(
    { hfId: "microsoft/Phi-3.5-mini-instruct", officialUrl: "https://azure.microsoft.com/en-us/products/phi", ollama: "phi3.5" },
    ["phi-3-5-mini-instruct", "phi-3.5-mini-instruct"],
  ),
  ...aliases(
    { hfId: "microsoft/Phi-3-mini-4k-instruct", officialUrl: "https://azure.microsoft.com/en-us/products/phi", ollama: "phi3" },
    ["phi-3-mini", "phi-3-mini-instruct", "phi-3-mini-4k-instruct"],
  ),
  ...aliases(
    { hfId: "microsoft/Phi-3-medium-4k-instruct", officialUrl: "https://azure.microsoft.com/en-us/products/phi", ollama: "phi3" },
    ["phi-3-medium", "phi-3-medium-instruct", "phi-3-medium-4k-instruct"],
  ),

  // Yi
  ...aliases(
    { hfId: "01-ai/Yi-1.5-34B-Chat", officialUrl: "https://www.01.ai", ollama: "yi" },
    ["yi-1-5-34b-chat", "yi-1.5-34b-chat", "yi-34b"],
  ),
  ...aliases(
    { hfId: "01-ai/Yi-1.5-9B-Chat", officialUrl: "https://www.01.ai", ollama: "yi" },
    ["yi-1-5-9b-chat", "yi-1.5-9b-chat", "yi-9b"],
  ),
  ...aliases({ hfId: "01-ai/Yi-Lightning", officialUrl: "https://www.01.ai" }, ["yi-lightning"]),

  // GLM
  ...aliases({ hfId: "zai-org/GLM-5.2", officialUrl: "https://z.ai" }, ["glm-5-2", "glm-5.2", "glm-5-2-max"]),
  ...aliases({ hfId: "zai-org/GLM-5", officialUrl: "https://z.ai" }, ["glm-5", "glm-5-max"]),
  ...aliases({ hfId: "zai-org/GLM-4.6", officialUrl: "https://z.ai" }, ["glm-4-6", "glm-4.6"]),
  ...aliases({ hfId: "zai-org/GLM-4.5", officialUrl: "https://z.ai" }, ["glm-4-5", "glm-4.5"]),
  ...aliases({ hfId: "THUDM/glm-4-9b-chat", officialUrl: "https://z.ai" }, ["glm-4-9b", "glm-4-9b-chat"]),

  // gpt-oss
  ...aliases(
    { hfId: "openai/gpt-oss-120b", officialUrl: "https://openai.com/open-models", ollama: "gpt-oss" },
    [
      "gpt-oss-120b",
      "openai-gpt-oss-120b",
      "gpt-oss-120b-low",
      "gpt-oss-120b-medium",
      "gpt-oss-120b-high",
    ],
  ),
  ...aliases(
    { hfId: "openai/gpt-oss-20b", officialUrl: "https://openai.com/open-models", ollama: "gpt-oss" },
    ["gpt-oss-20b", "openai-gpt-oss-20b", "gpt-oss-20b-low", "gpt-oss-20b-medium", "gpt-oss-20b-high"],
  ),

  // Kimi
  ...aliases(
    { hfId: "moonshotai/Kimi-K3", officialUrl: "https://www.kimi.com" },
    ["kimi-k3", "kimi-k3-max", "kimi-k3-instruct"],
  ),
  ...aliases(
    { hfId: "moonshotai/Kimi-K2-Instruct", officialUrl: "https://www.kimi.com", ollama: "kimi-k2" },
    ["kimi-k2", "kimi-k2-instruct"],
  ),
  ...aliases(
    { hfId: "moonshotai/Kimi-K2-Thinking", officialUrl: "https://www.kimi.com", ollama: "kimi-k2" },
    ["kimi-k2-thinking", "kimi-k2-reasoning"],
  ),

  // MiniMax
  ...aliases({ hfId: "MiniMaxAI/MiniMax-M3", officialUrl: "https://www.minimax.io" }, ["minimax-m3", "minimax-m3-instruct"]),
  ...aliases({ hfId: "MiniMaxAI/MiniMax-M2", officialUrl: "https://www.minimax.io" }, ["minimax-m2"]),

  // OLMo / Granite / Nemotron / others
  ...aliases(
    { hfId: "allenai/OLMo-2-0325-32B-Instruct", officialUrl: "https://allenai.org/olmo" },
    ["olmo-2-32b", "olmo-2-0325-32b-instruct", "olmo-2-32b-instruct"],
  ),
  ...aliases(
    { hfId: "ibm-granite/granite-4.0-h-small", officialUrl: "https://www.ibm.com/granite", ollama: "granite4" },
    ["granite-4-0-h-small", "granite-4.0-h-small", "granite-4-h-small"],
  ),
  ...aliases(
    { hfId: "ibm-granite/granite-3.3-8b-instruct", officialUrl: "https://www.ibm.com/granite", ollama: "granite3.3" },
    ["granite-3-3-8b-instruct", "granite-3.3-8b-instruct"],
  ),
  ...aliases(
    {
      hfId: "nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16",
      officialUrl: "https://www.nvidia.com/en-us/ai-data-science/foundation-models/",
    },
    ["nemotron-3-5-lightning-30b-a3b", "nvidia-nemotron-3-5-lightning-30b-a3b"],
  ),
  ...aliases(
    {
      hfId: "nvidia/Llama-3_1-Nemotron-Ultra-253B-v1",
      officialUrl: "https://www.nvidia.com/en-us/ai-data-science/foundation-models/",
    },
    ["llama-3-1-nemotron-ultra-253b", "nemotron-ultra-253b"],
  ),
  ...aliases(
    { hfId: "databricks/dbrx-instruct", officialUrl: "https://www.databricks.com/blog/introducing-dbrx-new-state-art-open-llm" },
    ["dbrx-instruct", "dbrx"],
  ),
  ...aliases(
    { hfId: "tiiuae/falcon-180B-chat", officialUrl: "https://falconllm.tii.ae" },
    ["falcon-180b", "falcon-180b-chat"],
  ),
  ...aliases(
    { hfId: "HuggingFaceTB/SmolLM3-3B", officialUrl: "https://huggingface.co/HuggingFaceTB" },
    ["smollm3-3b", "smollm-3-3b"],
  ),

  // Cohere Command R, EXAONE, Apertus, Solar, InternLM, Liquid
  ...aliases(
    { hfId: "CohereForAI/c4ai-command-r-plus", officialUrl: "https://cohere.com" },
    ["command-r-plus", "c4ai-command-r-plus", "command-r-plus-08-2024"],
  ),
  ...aliases(
    { hfId: "CohereForAI/c4ai-command-r-v01", officialUrl: "https://cohere.com" },
    ["command-r", "c4ai-command-r", "command-r-v01", "command-r-08-2024"],
  ),
  ...aliases(
    { hfId: "LGAI-EXAONE/EXAONE-4.0-32B", officialUrl: "https://www.lgresearch.ai" },
    ["exaone-4-0-32b", "exaone-4-32b", "exaone-4", "exaone-4.0-32b"],
  ),
  ...aliases(
    { hfId: "LGAI-EXAONE/EXAONE-3.5-32B-Instruct", officialUrl: "https://www.lgresearch.ai" },
    ["exaone-3-5-32b", "exaone-3.5-32b", "exaone-3-5-32b-instruct"],
  ),
  ...aliases(
    { hfId: "swiss-ai/Apertus-70B-Instruct-2509", officialUrl: "https://www.swiss-ai.org" },
    ["apertus-70b", "apertus-70b-instruct", "apertus-70b-instruct-2509"],
  ),
  ...aliases(
    { hfId: "upstage/SOLAR-10.7B-Instruct-v1.0", officialUrl: "https://www.upstage.ai", ollama: "solar" },
    ["solar-10-7b-instruct", "solar-10.7b-instruct", "solar-10-7b"],
  ),
  ...aliases(
    { hfId: "internlm/internlm2_5-7b-chat", officialUrl: "https://internlm.intern-ai.org.cn" },
    ["internlm2-5-7b-chat", "internlm2.5-7b-chat", "internlm2-5-7b"],
  ),
  ...aliases(
    { hfId: "LiquidAI/LFM2-8B-A1B", officialUrl: "https://www.liquid.ai" },
    ["lfm2-8b-a1b", "lfm-2-8b-a1b", "lfm2-8b"],
  ),
]

export const HF_IDS: Record<string, HfMapping> = Object.fromEntries(HF_ID_ENTRIES)

export const ORG_OFFICIAL: Record<string, string> = {
  "meta-llama": "https://www.llama.com",
  Qwen: "https://qwenlm.github.io",
  "deepseek-ai": "https://www.deepseek.com",
  mistralai: "https://mistral.ai",
  google: "https://ai.google.dev/gemma",
  microsoft: "https://azure.microsoft.com/en-us/products/phi",
  openai: "https://openai.com/open-models",
  moonshotai: "https://www.kimi.com",
  "zai-org": "https://z.ai",
  THUDM: "https://z.ai",
  "01-ai": "https://www.01.ai",
  allenai: "https://allenai.org/olmo",
  "ibm-granite": "https://www.ibm.com/granite",
  nvidia: "https://www.nvidia.com/en-us/ai-data-science/foundation-models/",
  MiniMaxAI: "https://www.minimax.io",
  databricks: "https://www.databricks.com",
  tiiuae: "https://falconllm.tii.ae",
  HuggingFaceTB: "https://huggingface.co/HuggingFaceTB",
  HuggingFaceH4: "https://huggingface.co/HuggingFaceH4",
  CohereForAI: "https://cohere.com",
  CohereLabs: "https://cohere.com",
  internlm: "https://internlm.intern-ai.org.cn",
  LiquidAI: "https://www.liquid.ai",
  "LGAI-EXAONE": "https://www.lgresearch.ai",
  "swiss-ai": "https://www.swiss-ai.org",
  upstage: "https://www.upstage.ai",
  tencent: "https://hunyuan.tencent.com",
}

const ORG_OFFICIAL_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(ORG_OFFICIAL).map(([org, url]) => [org.toLowerCase(), url]),
)

export function officialUrlForHfId(hfId: string, mapping?: HfMapping): string | undefined {
  if (mapping?.officialUrl) return mapping.officialUrl
  const org = hfId.split("/")[0]
  if (!org) return undefined
  return ORG_OFFICIAL[org] ?? ORG_OFFICIAL_LOWER[org.toLowerCase()]
}
