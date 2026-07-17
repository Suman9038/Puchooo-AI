from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_ollama import OllamaEmbeddings
from dotenv import load_dotenv
from functools import lru_cache
load_dotenv()


class GetEmbeddingModels:
    @staticmethod
    @lru_cache(maxsize=1)
    def get_google_embedding_models():
        """Using google's embedding models"""
        return GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-001",
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_hf_embedding_models():
        """Using huggingface's embedding models"""
        return HuggingFaceEmbeddings(
           model_name="ibm-granite/granite-embedding-97m-multilingual-r2",
           cache_folder=".embeddings/.cache"
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_ollama_embedding_models():
        """Using ollama's embedding models"""
        return OllamaEmbeddings(
            model="embeddinggemma:300m",
        )
    