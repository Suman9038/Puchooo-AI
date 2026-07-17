from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_classic.chains import create_history_aware_retriever, create_retrieval_chain
from langchain_core.prompts import PromptTemplate
from app.rag_pipeline.prompt import PromptFactory
from app.core.logger import logger

class RagChain:
    @staticmethod
    def build_chain(llm,retriever):
        logger.info(
            "Building RAG chain..."
        )

        history_aware_retriever = create_history_aware_retriever(
            llm,
            retriever,
            PromptFactory.contextual_question_prompt()
        )

        document_prompt = PromptTemplate.from_template(
            "Timestamp [{start_time}s]: {page_content}"
        )
        
        document_chain= create_stuff_documents_chain(
            llm,
            PromptFactory.qa_prompt(),
            document_prompt=document_prompt
        )

        rag_chain = create_retrieval_chain(
            history_aware_retriever,
            document_chain
        )

        logger.info(
            "RAG chain built successfully"
        )
        
        return rag_chain