# MTG Deep Agent

A Magic: The Gathering assistant powered by LangGraph Deep Agents, Scryfall API, and Azure OpenAI.

## Features

### Deep Agent Capabilities
- **Planning & Task Management**: Automatic todo lists for complex deck building and research tasks
- **Memory System**: Persistent storage for user preferences, strategies, and insights across sessions
- **Specialized Subagents**: Delegate to expert agents for focused tasks:
  - **Research Specialist**: Deep dives into card options and meta analysis
  - **Combo Evaluator**: Analyzes card interactions, synergies, and nonbos
  - **Brainstorming Agent**: Generates creative deck ideas and unconventional strategies
  - **Price Analyst**: Budget optimization and price comparison

### MTG-Specific Features
- **Comprehensive Scryfall Integration**: 18+ tools for card search, rulings, prices, and more
- **Natural Language Query Builder**: Converts plain English to Scryfall syntax
- **Format-Aware Recommendations**: Automatically sorts by EDHREC rank (Commander) or price (competitive)
- **Graceful Error Handling**: Helpful messages with suggestions when cards aren't found

### Infrastructure
- **LangGraph**: Stateful agent orchestration framework
- **Azure OpenAI**: Integration with Azure OpenAI services (GPT-5.1)
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

## Usage

### Run with LangGraph Dev Server (Recommended)

The agent is configured for deployment with `langgraph.json`. To run locally:

```bash
uv run langgraph dev --no-browser --port 8123
```

This starts the LangGraph Studio server where you can interact with the agent through a web interface at http://localhost:8123.

### Run with Python Script

For quick testing without the dev server:

```bash
uv run -m src.app
```

## Project Structure

```
.
├── src/                      # Source code directory
│   ├── agent.py             # Main MTG Deep Agent with middleware & subagents
│   ├── app.py               # Simple CLI for local testing
│   ├── config/
│   │   ├── __init__.py      # Config module exports
│   │   ├── config.py        # Environment variable configuration
│   │   └── deployments.py   # Azure OpenAI deployment configurations
│   └── tools/
│       ├── __init__.py      # Tools module exports
│       ├── scryfall.py      # 18 Scryfall API tools
│       └── query_builder.py # Natural language to Scryfall query converter
├── scripts/                  # Utility scripts (not part of core app)
│   └── download_scryfall_docs.py  # Scryfall API docs crawler
├── docker-compose.yml       # Postgres with pgvector setup
├── langgraph.json           # LangGraph deployment configuration
├── tmp/                      # Temporary files (gitignored)
│   ├── cache/               # Cached HTML files
│   └── markdown/            # Converted markdown files
├── .env.example             # Example environment variables
├── pyproject.toml           # Project dependencies
└── README.md                # This file
```

## How It Works

The MTG Deep Agent uses LangGraph's deep agent architecture with three layers of middleware:

### 1. TodoList Middleware
- Automatically creates and maintains todo lists for complex tasks
- Example: "Build a Commander deck" → breaks into research, card selection, interaction checks, budget analysis
- Tracks progress and updates as new information is discovered

### 2. Filesystem Middleware
- **Ephemeral storage** (per-thread): `/research/`, `/working/` for temporary card lists and analysis
- **Persistent storage** (cross-thread): `/memories/` for user preferences, strategies, and insights
- Example: Stores user's format preference, budget constraints, and previously researched synergies

### 3. Subagent Middleware
Four specialized subagents handle focused tasks:

| Subagent | Purpose | Key Tools |
|----------|---------|-----------|
| **research_specialist** | Deep card research & meta analysis | All Scryfall tools + query builder |
| **combo_evaluator** | Analyzes interactions, synergies, nonbos | Card lookup, rulings, legality checks |
| **brainstorming** | Creative deck ideas & strategies | Random cards, filtered search, discovery |
| **price_analyst** | Budget optimization & value analysis | Price comparison, budget alternatives |

### Workflow Example

```
User: "Help me build a budget Commander deck around Zaxara"

Agent:
1. Creates todo list: research commander → find synergies → check budget → optimize
2. Stores user preference: "budget: <$100" to /memories/user_preferences.txt
3. Delegates to research_specialist: "Find X-spell payoffs for Zaxara under $5"
4. Delegates to combo_evaluator: "Check if Freed from the Real + Zaxara goes infinite"
5. Delegates to price_analyst: "Compare budget mana doublers"
6. Synthesizes findings from filesystem and provides recommendations
```

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

