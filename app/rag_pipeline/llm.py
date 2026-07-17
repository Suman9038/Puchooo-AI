from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEndpoint,HuggingFacePipeline
from langchain_openrouter import ChatOpenRouter
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
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
            verbose=True,
            temperature=0.7,
            google_api_key=settings.GOOGLE_API_KEY
        )
    @staticmethod
    @lru_cache(maxsize=1)
    def get_hf_llm():
        return HuggingFaceEndpoint(
            repo_id="Qwen/Qwen2.5-1.5B-Instruct",
            task="text-generation",
            verbose=True,
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
            model="google/gemma-4-31b-it:free",
            verbose=True,
            temperature=0.7,
            openrouter_api_key=settings.OPENROUTER_API_KEY
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_groq_llm():
        return ChatGroq(
            # model="groq/compound",
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            verbose=True,
            temperature=0.3,
            groq_api_key=settings.GROQ_API_KEY
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_ollama_model():
        return ChatOllama(
            # model="llama3.2:latest",
            model="qwen3:4b",
            temperature=0.7,
            verbose=True
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_fallback_router_llm():
        primary = LLMModels.get_groq_llm()

        fallbacks=[
            LLMModels.get_google_llm(),
            LLMModels.get_openrouter_llm(),
            LLMModels.get_ollama_model(),
            # LLMModels.get_hf_llm(),
        ]
        
        # print("\n" + "="*50)
        # print(f"🤖 LLM ROUTER CONFIGURED 🤖")
        # print(f"Primary: {type(primary).__name__} (Groq)")
        # print(f"Fallbacks: {[type(f).__name__ for f in fallbacks]}")
        # print("="*50 + "\n")
        
        return primary.with_fallbacks(fallbacks)