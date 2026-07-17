from qdrant_client import QdrantClient
from qdrant_client.models import (Distance, VectorParams, Filter, FieldCondition, MatchValue)
from langchain_qdrant import QdrantVectorStore
from app.rag_pipeline.embedding import GetEmbeddingModels
from app.core.config import settings
from app.core.logger import logger


class QdrantService:
    _instance = None
    _collection_checked = False

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(QdrantService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_initialized") and self._initialized:
            return
            
        self.client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT
        )   
        self.embedding= GetEmbeddingModels.get_ollama_embedding_models()

        self.collection_name= settings.QDRANT_COLLECTION

        self.create_collection()

        self.vector_store= QdrantVectorStore(
            client=self.client,
            collection_name=self.collection_name,
            embedding=self.embedding
        )
        self._initialized = True

    def create_collection(self):
        if QdrantService._collection_checked:
            return
            
        logger.info(f"Checking/Creating collection {self.collection_name} in Qdrant...")
        collection = self.client.get_collections()

        existing =[
            c.name for c in collection.collections
        ]

        if self.collection_name in existing:
            logger.info(f"Collection already exists: {self.collection_name}. Skipping setup.")
            QdrantService._collection_checked = True
            return

        logger.info(
            f"Creating collection: "
            f"{self.collection_name}"
        )
        
        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=settings.EMBEDDING_DIMENSION,
                distance=Distance.COSINE,
            )
        )
        QdrantService._collection_checked = True

    def add_documents(self, documents):
        logger.info(
            f"Adding {len(documents)} "
            f"documents to Qdrant"
        )
        self.vector_store.add_documents(documents)

    def get_retriever(self):
        retriever = self.vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={ 
                "k": 5,
                "fetch_k": 10
            }
        )

        return retriever

    def get_video_retriever(self,video_id:str):
        logger.info(f"retrieving video {video_id}")
        
        retriever = self.vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": 5,
                "fetch_k": 10,
                "filter": Filter(
                    must=[
                        FieldCondition(
                            key="metadata.video_id",
                            match=MatchValue(value=str(video_id))
                        )
                    ]
                )
            }
        )
            
        return retriever

    def delete_video_documents(self,video_id:str):
        logger.info(
            f"Deleting vector for video {video_id}"
        )
        self.client.delete(
        collection_name=self.collection_name,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="metadata.video_id",
                    match=MatchValue(
                        value=str(video_id)
                    )
                )
            ]
        )
    )

    

        