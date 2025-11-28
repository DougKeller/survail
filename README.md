# MTG LangGraph Application

A basic LangGraph application with Azure OpenAI, Postgres checkpointer, and LangSmith tracing.

## Features

- **LangGraph**: Stateful agent orchestration framework
- **Azure OpenAI**: Integration with Azure OpenAI services using deployment configurations
- **Postgres Checkpointer**: Persistent state management with pgvector support
- **LangSmith**: Observability and tracing for debugging and monitoring
- **Deployment Configurations**: Centralized configuration for multiple Azure OpenAI deployments

## Prerequisites

1. **Docker and Docker Compose**: For running Postgres with pgvector
   - Install from [docker.com](https://www.docker.com/)

2. **Azure OpenAI Account**: You need Azure OpenAI resources with deployed models
   - The app uses two deployments:
     - GPT 5.1: `https://sondereastus2.openai.azure.com/`
     - Text Embedding 3 Large: `https://sondertest2.openai.azure.com/`
   - Both use the same API key: `AZURE_OPENAI_API_KEY`

3. **LangSmith Account** (optional but recommended):
   - Sign up at [smith.langchain.com](https://smith.langchain.com)
   - Get your API key from the settings page
   - See [LangSmith documentation](https://docs.langchain.com/langsmith/) for more info

## Installation

This project uses `uv` as the package manager.

1. Install dependencies:
```bash
uv sync
```

2. Install additional dependencies if needed:
```bash
uv add python-dotenv langgraph-checkpoint-postgres psycopg[binary,pool]
```

## Setup

1. **Start Postgres with pgvector**:
```bash
docker-compose up -d
```

This will start a Postgres container with pgvector extension on port 5432.

2. **Configure environment variables**:

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key (shared for both deployments)
- `DATABASE_URL`: Postgres connection string
- `LANGSMITH_API_KEY`: (Optional) Your LangSmith API key
- `LANGSMITH_TRACING`: (Optional) Set to `true` to enable tracing

### Environment Variables

**Required:**
- `AZURE_OPENAI_API_KEY`: API key for Azure OpenAI (shared across deployments)
- `DATABASE_URL`: Postgres connection string (e.g., `postgresql://postgres:postgres@localhost:5432/langgraph?sslmode=disable`)

**Optional:**
- `LANGSMITH_API_KEY`: LangSmith API key for tracing
- `LANGSMITH_TRACING`: Set to `true` to enable tracing
- `LANGSMITH_PROJECT`: Project name for LangSmith (default: `mtg-langgraph-app`)
- `LANGSMITH_WORKSPACE_ID`: Workspace ID if using multiple workspaces

## Usage

1. **Start Postgres** (if not already running):
```bash
docker-compose up -d
```

2. **Run the application**:
```bash
uv run -m src.app
```

Or:

```bash
python -m src.app
```

Alternatively, you can run it directly (requires PYTHONPATH to include the project root):
```bash
PYTHONPATH=. python src/app.py
```

## Project Structure

```
.
├── src/                      # Source code directory
│   ├── app.py               # Main LangGraph application
│   └── config/
│       ├── __init__.py      # Config module exports
│       ├── config.py        # Environment variable configuration
│       └── deployments.py   # Azure OpenAI deployment configurations
├── scripts/                  # Utility scripts (not part of core app)
│   └── download_scryfall_docs.py  # Scryfall API docs crawler
├── docker-compose.yml       # Postgres with pgvector setup
├── tmp/                      # Temporary files (gitignored)
│   ├── cache/               # Cached HTML files
│   └── markdown/            # Converted markdown files
├── .env.example             # Example environment variables
├── pyproject.toml           # Project dependencies
└── README.md                # This file
```

## How It Works

The application creates a LangGraph agent that:

1. **State Management**: Uses `AgentState` to track conversation messages
2. **Postgres Checkpointer**: Persists state to Postgres database with pgvector support
3. **Deployment Configurations**: Uses centralized configs from `config/deployments.py`
   - GPT 5.1: Primary chat model
   - Text Embedding 3 Large: For embeddings (available for future use)
4. **Agent Node**: Processes user messages and generates responses using Azure OpenAI
5. **Tracing**: Automatically sends traces to LangSmith when configured

## Deployment Configurations

The app uses deployment configurations defined in `config/deployments.py`:

- **GPT 5.1**: 
  - Endpoint: `https://sondereastus2.openai.azure.com/`
  - Deployment: `dev-gpt-5.1`
  - Model: `gpt-5.1`

- **Text Embedding 3 Large**:
  - Endpoint: `https://sondertest2.openai.azure.com/`
  - Deployment: `dev-text-embedding-3-large`
  - Model: `text-embedding-3-large`

Both deployments share the same `AZURE_OPENAI_API_KEY` from your `.env` file.

## LangSmith Integration

When `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` are set, the application will:

- Automatically trace all LLM calls
- Log state transitions
- Provide visibility into agent execution
- Enable debugging and monitoring in the LangSmith UI

View your traces at: https://smith.langchain.com

## Next Steps

- Add tools to the agent for more functionality
- Implement multi-agent workflows
- Add streaming support
- Deploy to LangSmith Deployment for production

## References

- [LangGraph Documentation](https://docs.langchain.com/langgraph)
- [Azure OpenAI Documentation](https://docs.langchain.com/integrations/providers/microsoft)
- [LangSmith Documentation](https://docs.langchain.com/langsmith)

