from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEndpoint,HuggingFacePipeline
from langchain_openrouter import ChatOpenRouter
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from langchain_core.callbacks import BaseCallbackHandler
from app.core.config import settings
from dotenv import load_dotenv
from functools import lru_cache
load_dotenv()

class LLMModels:
    @staticmethod
    @lru_cache(maxsize=1)
    def get_google_llm():
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            verbose=False,
            temperature=0.7,
            google_api_key=settings.GOOGLE_API_KEY
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
        return ChatOpenRouter(
            model="meta-llama/llama-3.3-70b-instruct:free",
            verbose=False,
            temperature=0.7,
            openrouter_api_key=settings.OPENROUTER_API_KEY
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_groq_llm():
        return ChatGroq(
            model="openai/gpt-oss-120b",
            verbose=False,
            temperature=0.3,
            groq_api_key=settings.GROQ_API_KEY
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_ollama_model():
        return ChatOllama(
            model="llama3.2:latest",
            temperature=0.7,
            verbose=False
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_fallback_router_llm():
        primary = LLMModels.get_groq_llm()

        fallbacks = [
            LLMModels.get_google_llm(),
            LLMModels.get_openrouter_llm(),
            LLMModels.get_ollama_model(),
        ]
        
        return primary.with_fallbacks(fallbacks)

    @staticmethod
    def get_model_name():
        return "GPT-OSS 120B (Groq)"


class DynamicModelTracker(BaseCallbackHandler):
    """
    Dynamically tracks which model actually responds,
    even when fallback models are triggered during runtime.
    """
    def __init__(self):
        super().__init__()
        self.active_model = "GPT-OSS 120B (Groq)"

    def on_llm_start(self, serialized, prompts, **kwargs):
        name = serialized.get("name") or serialized.get("id", ["unknown"])[-1]
        inv = kwargs.get("invocation_params", {})
        model_id = inv.get("model") or inv.get("model_name") or name

        if "Groq" in name or "groq" in str(model_id).lower():
            self.active_model = "GPT-OSS 120B (Groq)"
        elif "Google" in name or "Gemini" in name or "gemini" in str(model_id).lower():
            self.active_model = "Gemini 2.5 Flash"
        elif "OpenRouter" in name or "openrouter" in str(model_id).lower():
            self.active_model = "Llama 3.3 70B (OpenRouter)"
        elif "Ollama" in name or "ollama" in str(model_id).lower():
            self.active_model = "Llama 3.2 (Ollama)"
        else:
            self.active_model = str(name)