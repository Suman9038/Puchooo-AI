<div align="center">
  <h1>✨ Puchooo AI</h1>
  <p><strong>Chat with Any YouTube Video in Real-Time</strong></p>
</div>

<br />

<div align="center">
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/LangChain-121212?style=for-the-badge" alt="LangChain" />
  <img src="https://img.shields.io/badge/Qdrant-FF5252?style=for-the-badge" alt="Qdrant" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</div>

<br />

## 📖 About The Project

**Puchooo AI** solves the problem of endlessly scrubbing through long YouTube videos to find specific answers. Whether you are an active learner, a developer watching tech talks, or a researcher taking notes from a documentary, Puchooo AI lets you **have a conversation with the video**.

Instead of wasting time, simply ask a question and get a precise, context-aware answer instantly, complete with the timestamp from the video!

## 🚀 Key Features

- **💬 Real-Time Chat:** Ask natural language questions and get accurate answers grounded in the video's transcript.
- **⚡ Instant Summarization:** Click a single button to get a comprehensive summary of any long video.
- **⏱️ Timestamp References:** Every answer includes exact source timestamps (e.g., "From 1:12:34"), so you can jump right to the relevant part in the video.
- **🌐 Web App & Extension:** Use the standalone web application or install the Chrome Extension for a seamless, inline experience on YouTube.
- **🔄 Session Persistence:** Your chat history is saved for the duration of your browser session, allowing you to ask follow-up questions seamlessly.

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind CSS
- **Backend:** FastAPI (Python)
- **AI & RAG:** LangChain, OpenAI / Groq / Gemini (via LLMs)
- **Vector Database:** Qdrant (In-memory / Local)
- **Database & Cache:** PostgreSQL, Redis
- **Data Ingestion:** `youtube-transcript-api`

## ⚙️ How It Works

1. **Input:** You provide a YouTube URL.
2. **Fetch:** The system securely fetches the transcript of the video.
3. **Chunk & Embed:** The text is chunked into logical segments, embedded using state-of-the-art models, and stored in a Qdrant vector database.
4. **Query:** When you ask a question, the RAG (Retrieval-Augmented Generation) pipeline fetches the most relevant context and generates a precise answer using an LLM.

## 💻 Local Setup & Installation

### Prerequisites
- Python 3.9+
- Node.js (for the frontend)
- PostgreSQL & Redis (running locally or via Docker)

### 1. Clone the repository
```bash
git clone https://github.com/Suman9038/Puchooo-AI.git
cd Puchooo-AI
```

### 2. Environment Variables
We use a `.env` file to manage API keys and database connections.
```bash
cp .env.example .env
```
*Open the `.env` file and fill in your API keys (Google, Groq, OpenRouter, etc.) and your local database credentials.*

### 3. Backend Setup
We use Poetry for dependency management.
```bash
# Install dependencies
poetry install

# Activate the virtual environment
poetry shell

# Run database migrations
alembic upgrade head

# Start the FastAPI server
uvicorn app.main:app --reload
```

### 4. Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
