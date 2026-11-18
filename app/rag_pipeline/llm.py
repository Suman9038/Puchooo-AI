from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEndpoint,HuggingFacePipeline
from langchain_openrouter import ChatOpenRouter
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from langchain_core.callbacks import BaseCallbackHandler
from app.core.config import settings
from app.core.logger import logger
from dotenv import load_dotenv
from functools import lru_cache
import os
load_dotenv()

class LLMModels:
    @staticmethod
    @lru_cache(maxsize=1)
    def get_google_llm():
        google_api_key = settings.GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY")
        if not google_api_key:
            return None
        gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        return ChatGoogleGenerativeAI(
            model=gemini_model,
            verbose=False,
            temperature=0.7,
            google_api_key=google_api_key
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_hf_llm():
        return HuggingFaceEndpoint(
            repo_id="Qwen/Qwen2.5-1.5B-Instruct",
            task="text-generation",
            verbose=False,
            temperature=0.7,
            huggingfacehub_api_token=settings.HUGGINGFACEHUB_ACCESS_TOKEN
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_hf_local_llm():
        return HuggingFacePipeline.from_model_id(
            model_id="Qwen/Qwen2.5-0.5B-Instruct",
            task="text-generation",
            pipeline_kwargs=dict(
                temperature=0.5,
                max_new_tokens=100,
            )
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_openrouter_llm():
        openrouter_api_key = settings.OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY")
        if not openrouter_api_key:
            return None
        openrouter_model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
        return ChatOpenRouter(
            model=openrouter_model,
            verbose=False,
            temperature=0.7,
            openrouter_api_key=openrouter_api_key
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_groq_llm():
        if not settings.GROQ_API_KEY:
            return None
        groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        return ChatGroq(
            model=groq_model,
            verbose=False,
            temperature=0.3,
            groq_api_key=settings.GROQ_API_KEY
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_ollama_model():
        ollama_base_url = os.getenv("OLLAMA_BASE_URL") or os.getenv("OLLAMA_HOST") or "http://localhost:11434"
        ollama_model = os.getenv("OLLAMA_MODEL", "hf.co/unsloth/Qwen3.5-4B-GGUF:Q4_K_M")
        return ChatOllama(
            base_url=ollama_base_url,
            model=ollama_model,
            temperature=0.7,
            verbose=False
        )

    @staticmethod
    def get_model_by_name(provider: str):
        p = provider.strip().lower()
        if p == "groq":
            return LLMModels.get_groq_llm()
        elif p in ("gemini", "google"):
            return LLMModels.get_google_llm()
        elif p == "openrouter":
            return LLMModels.get_openrouter_llm()
        elif p in ("ollama", "local"):
            return LLMModels.get_ollama_model()
        return None

    @staticmethod
    @lru_cache(maxsize=1)
    def get_fallback_router_llm():
        """
        Dynamic LLM Fallback Router:
        - VPS / Production Mode: Groq -> Gemini -> OpenRouter -> Ollama
        - Local Development Mode: Groq -> Ollama -> Gemini -> OpenRouter
        - Custom Chain: Configurable via LLM_FALLBACK_CHAIN env var
        """
        app_env = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).strip().lower()
        custom_chain = os.getenv("LLM_FALLBACK_CHAIN")

        if custom_chain:
            providers = [p.strip().lower() for p in custom_chain.split(",") if p.strip()]
        elif app_env in ("production", "prod", "vps"):
            # VPS chain: Groq -> Gemini -> OpenRouter -> Ollama
            providers = ["groq", "gemini", "openrouter", "ollama"]
        else:
            # Local Dev chain: Groq -> Ollama -> Gemini -> OpenRouter
            providers = ["groq", "ollama", "gemini", "openrouter"]

        # If PRIMARY_LLM is explicitly specified and in providers, ensure it is first
        primary_choice = os.getenv("PRIMARY_LLM")
        if primary_choice and primary_choice.lower() in providers:
            p_clean = primary_choice.lower()
            providers.remove(p_clean)
            providers.insert(0, p_clean)

        # Resolve available models (skipping unconfigured/missing keys)
        configured_models = []
        for name in providers:
            try:
                model_inst = LLMModels.get_model_by_name(name)
                if model_inst is not None:
                    configured_models.append((name, model_inst))
            except Exception as exc:
                logger.warning(f"Note: LLM provider '{name}' could not be initialized ({exc})")

        if not configured_models:
            raise ValueError(
                "No LLM models could be initialized. Please check your API keys (GROQ_API_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY) or local Ollama."
            )

        primary_name, primary_model = configured_models[0]
        fallback_models = [m for _, m in configured_models[1:]]

        chain_str = " -> ".join([name.capitalize() for name, _ in configured_models])
        logger.info(f"Active LLM Fallback Router ({app_env} mode): {chain_str}")

        if fallback_models:
            return primary_model.with_fallbacks(fallback_models)
        return primary_model

    @staticmethod
    def get_model_name():
        return os.getenv("GROQ_MODEL", "Llama 3.3 70B (Groq)")


class DynamicModelTracker(BaseCallbackHandler):
    """
    Dynamically tracks which model actually responds,
    even when fallback models are triggered during runtime.
    """
    def __init__(self):
        super().__init__()
        self.active_model = "Groq (Llama 3.3 70B)"

    def on_llm_start(self, serialized, prompts, **kwargs):
        name = serialized.get("name") or serialized.get("id", ["unknown"])[-1]
        inv = kwargs.get("invocation_params", {})
        model_id = inv.get("model") or inv.get("model_name") or name

        if "Groq" in name or "groq" in str(model_id).lower():
            self.active_model = "Groq (Llama 3.3 70B)"
        elif "Google" in name or "Gemini" in name or "gemini" in str(model_id).lower():
            self.active_model = "Google (Gemini 2.5 Flash)"
        elif "OpenRouter" in name or "openrouter" in str(model_id).lower():
            self.active_model = "OpenRouter (Llama 3.3 70B)"
        elif "Ollama" in name or "ollama" in str(model_id).lower():
            self.active_model = "Ollama (Qwen 3.5 4B)"
        else:
            self.active_model = str(name)